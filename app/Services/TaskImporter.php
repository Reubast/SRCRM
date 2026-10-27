<?php

namespace App\Services;

use App\Models\Task;
use App\Models\TaskColumn;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\TaskSchema;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Импорт набора колонок, задач и трудозатрат в аккаунт пользователя.
 *
 * Идентификаторы из файла сохраняются, если свободны. Если id уже занят
 * (например, другим пользователем), запись получает новый UUID, а ссылки
 * на неё внутри файла переписываются.
 */
class TaskImporter
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{columns: int, tasks: int, timeEntries: int}
     */
    public function import(User $user, array $payload, bool $replace): array
    {
        return DB::transaction(function () use ($user, $payload, $replace): array {
            if ($replace) {
                TimeEntry::query()->where('user_id', $user->id)->delete();
                Task::query()->where('user_id', $user->id)->delete();
                TaskColumn::query()->where('user_id', $user->id)->delete();
            }

            $columns = $this->prepareColumns($payload['columns'] ?? []);
            $tasks = $this->prepareTasks($payload['tasks'] ?? [], array_keys($columns));
            $entries = $this->prepareEntries($payload['timeEntries'] ?? [], array_keys($tasks));

            $columnIds = $this->freeIds(TaskColumn::class, array_keys($columns));
            $taskIds = $this->freeIds(Task::class, array_keys($tasks));
            $entryIds = $this->freeIds(TimeEntry::class, array_keys($entries));

            foreach ($columns as $oldId => $column) {
                TaskColumn::query()->create([
                    'id' => $columnIds[$oldId],
                    'user_id' => $user->id,
                    'title' => $column['title'],
                    'position' => $column['order'],
                    'is_done' => $column['isDone'],
                ]);
            }

            // Сначала корневые задачи, затем подзадачи, чтобы не нарушить внешний ключ.
            $ordered = collect($tasks)->sortBy(fn (array $task) => $task['parentId'] === null ? 0 : 1);

            foreach ($ordered as $oldId => $task) {
                Task::query()->create([
                    'id' => $taskIds[$oldId],
                    'user_id' => $user->id,
                    'parent_id' => $task['parentId'] === null ? null : $taskIds[$task['parentId']],
                    'task_column_id' => $columnIds[$task['columnId']],
                    'title' => $task['title'],
                    'description' => $task['description'],
                    'priority' => $task['priority'],
                    'start_at' => $task['startAt'],
                    'deadline' => $task['deadline'],
                    'completed' => $task['completed'],
                    'position' => $task['order'],
                    'color' => $task['color'],
                    'created_at' => $task['createdAt'],
                    'updated_at' => $task['updatedAt'],
                ]);
            }

            foreach ($entries as $oldId => $entry) {
                TimeEntry::query()->create([
                    'id' => $entryIds[$oldId],
                    'user_id' => $user->id,
                    'task_id' => $taskIds[$entry['taskId']],
                    'entry_date' => $entry['date'],
                    'minutes' => $entry['minutes'],
                    'note' => $entry['note'],
                    'created_at' => $entry['createdAt'],
                ]);
            }

            return [
                'columns' => count($columns),
                'tasks' => count($tasks),
                'timeEntries' => count($entries),
            ];
        });
    }

    /**
     * @param  array<int, mixed>  $raw
     * @return array<string, array{title: string, order: float, isDone: bool}>
     */
    private function prepareColumns(array $raw): array
    {
        $columns = [];

        foreach (array_values($raw) as $index => $item) {
            if (! is_array($item) || ! TaskSchema::isValidId($item['id'] ?? null)) {
                continue;
            }

            if (isset($columns[$item['id']])) {
                continue;
            }

            $title = is_string($item['title'] ?? null) ? trim($item['title']) : '';

            $columns[$item['id']] = [
                'title' => mb_substr($title !== '' ? $title : 'Колонка '.($index + 1), 0, 120),
                'order' => is_numeric($item['order'] ?? null) ? (float) $item['order'] : (float) $index,
                'isDone' => ($item['isDone'] ?? false) === true,
            ];
        }

        if ($columns === []) {
            throw ValidationException::withMessages([
                'columns' => 'В файле нет ни одной колонки.',
            ]);
        }

        return $columns;
    }

    /**
     * @param  array<int, mixed>  $raw
     * @param  array<int, string>  $columnIds
     * @return array<string, array<string, mixed>>
     */
    private function prepareTasks(array $raw, array $columnIds): array
    {
        $fallbackColumn = $columnIds[0];
        $valid = [];

        foreach ($raw as $item) {
            if (! is_array($item) || ! TaskSchema::isValidId($item['id'] ?? null)) {
                continue;
            }

            if (! isset($valid[$item['id']])) {
                $valid[$item['id']] = $item;
            }
        }

        $tasks = [];

        foreach ($valid as $id => $item) {
            $parentId = $item['parentId'] ?? null;

            // Глубина вложенности — одна: родитель должен быть корневой задачей.
            if (! is_string($parentId) || ! isset($valid[$parentId]) || $parentId === $id) {
                $parentId = null;
            } elseif (is_string($valid[$parentId]['parentId'] ?? null)) {
                $parentId = null;
            }

            $columnId = is_string($item['columnId'] ?? null) && in_array($item['columnId'], $columnIds, true)
                ? $item['columnId']
                : $fallbackColumn;

            $priority = is_string($item['priority'] ?? null) && in_array($item['priority'], TaskSchema::PRIORITIES, true)
                ? $item['priority']
                : 'medium';

            $color = is_string($item['color'] ?? null) && preg_match(TaskSchema::COLOR_PATTERN, $item['color'])
                ? $item['color']
                : null;

            $description = is_string($item['description'] ?? null) ? $item['description'] : '';

            $title = is_string($item['title'] ?? null) ? trim($item['title']) : '';

            $tasks[$id] = [
                'parentId' => $parentId,
                'columnId' => $columnId,
                'title' => mb_substr($title !== '' ? $title : 'Без названия', 0, 255),
                'description' => mb_substr($description, 0, TaskSchema::MAX_DESCRIPTION),
                'priority' => $priority,
                'startAt' => TaskSchema::parseDate($item['startAt'] ?? null),
                'deadline' => TaskSchema::parseDate($item['deadline'] ?? null),
                'completed' => ($item['completed'] ?? false) === true,
                'order' => is_numeric($item['order'] ?? null) ? (float) $item['order'] : 0.0,
                'color' => $color,
                'createdAt' => TaskSchema::parseDate($item['createdAt'] ?? null) ?? Carbon::now(),
                'updatedAt' => TaskSchema::parseDate($item['updatedAt'] ?? null) ?? Carbon::now(),
            ];
        }

        return $tasks;
    }

    /**
     * @param  array<int, mixed>  $raw
     * @param  array<int, string>  $taskIds
     * @return array<string, array<string, mixed>>
     */
    private function prepareEntries(array $raw, array $taskIds): array
    {
        $entries = [];

        foreach ($raw as $item) {
            if (! is_array($item) || ! TaskSchema::isValidId($item['id'] ?? null)) {
                continue;
            }

            $taskId = $item['taskId'] ?? null;

            if (! is_string($taskId) || ! in_array($taskId, $taskIds, true) || isset($entries[$item['id']])) {
                continue;
            }

            $date = is_string($item['date'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $item['date'])
                ? $item['date']
                : Carbon::now()->format('Y-m-d');

            $entries[$item['id']] = [
                'taskId' => $taskId,
                'date' => $date,
                'minutes' => TaskSchema::clampMinutes($item['minutes'] ?? 30),
                'note' => mb_substr(is_string($item['note'] ?? null) ? trim($item['note']) : '', 0, 500),
                'createdAt' => TaskSchema::parseDate($item['createdAt'] ?? null) ?? Carbon::now(),
            ];
        }

        return $entries;
    }

    /**
     * Возвращает карту «исходный id → id для записи». Занятые id заменяются на новые UUID.
     *
     * @param  class-string<\Illuminate\Database\Eloquent\Model>  $model
     * @param  array<int, string>  $ids
     * @return array<string, string>
     */
    private function freeIds(string $model, array $ids): array
    {
        $taken = $model::query()->whereIn('id', $ids)->pluck('id')->flip();
        $map = [];

        foreach ($ids as $id) {
            $map[$id] = $taken->has($id) ? (string) Str::uuid() : $id;
        }

        return $map;
    }
}
