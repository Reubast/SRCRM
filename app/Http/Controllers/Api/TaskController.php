<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\TaskSchema;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TaskController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'id' => ['required', 'string', 'max:36', $this->idRule(), 'unique:tasks,id'],
            'parentId' => ['nullable', 'string', 'max:36'],
            'columnId' => ['required', 'string', 'max:36'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:'.TaskSchema::MAX_DESCRIPTION],
            'priority' => ['required', Rule::in(TaskSchema::PRIORITIES)],
            'startAt' => ['nullable', 'date'],
            'deadline' => ['nullable', 'date'],
            'completed' => ['sometimes', 'boolean'],
            'order' => ['required', 'numeric'],
            'color' => ['nullable', 'string', 'max:9', $this->colorRule()],
        ]);

        $this->assertColumnOwned($user, $data['columnId']);
        $this->assertParentAllowed($user, $data['parentId'] ?? null, $data['id']);

        $task = Task::query()->create([
            'id' => $data['id'],
            'user_id' => $user->id,
            'parent_id' => $data['parentId'] ?? null,
            'task_column_id' => $data['columnId'],
            'title' => trim($data['title']),
            'description' => $data['description'] ?? '',
            'priority' => $data['priority'],
            'start_at' => TaskSchema::parseDate($data['startAt'] ?? null),
            'deadline' => TaskSchema::parseDate($data['deadline'] ?? null),
            'completed' => (bool) ($data['completed'] ?? false),
            'position' => (float) $data['order'],
            'color' => $data['color'] ?? null,
        ]);

        return response()->json($task->toApi(), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $task = $user->tasks()->findOrFail($id);

        $data = $request->validate([
            'parentId' => ['sometimes', 'nullable', 'string', 'max:36'],
            'columnId' => ['sometimes', 'required', 'string', 'max:36'],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:'.TaskSchema::MAX_DESCRIPTION],
            'priority' => ['sometimes', 'required', Rule::in(TaskSchema::PRIORITIES)],
            'startAt' => ['sometimes', 'nullable', 'date'],
            'deadline' => ['sometimes', 'nullable', 'date'],
            'completed' => ['sometimes', 'boolean'],
            'order' => ['sometimes', 'required', 'numeric'],
            'color' => ['sometimes', 'nullable', 'string', 'max:9', $this->colorRule()],
        ]);

        if (array_key_exists('columnId', $data)) {
            $this->assertColumnOwned($user, $data['columnId']);
        }

        if (array_key_exists('parentId', $data)) {
            $this->assertParentAllowed($user, $data['parentId'], $task->id);
        }

        $attributes = [];

        foreach ([
            'parentId' => 'parent_id',
            'columnId' => 'task_column_id',
            'description' => 'description',
            'priority' => 'priority',
            'completed' => 'completed',
            'color' => 'color',
        ] as $input => $column) {
            if (array_key_exists($input, $data)) {
                $attributes[$column] = $data[$input];
            }
        }

        if (array_key_exists('title', $data)) {
            $attributes['title'] = trim($data['title']);
        }

        if (array_key_exists('order', $data)) {
            $attributes['position'] = (float) $data['order'];
        }

        if (array_key_exists('startAt', $data)) {
            $attributes['start_at'] = TaskSchema::parseDate($data['startAt']);
        }

        if (array_key_exists('deadline', $data)) {
            $attributes['deadline'] = TaskSchema::parseDate($data['deadline']);
        }

        if (array_key_exists('completed', $data)) {
            $attributes['completed'] = (bool) $data['completed'];
        }

        if ($attributes !== []) {
            $task->update($attributes);
        }

        return response()->json($task->refresh()->toApi());
    }

    /**
     * Удаляет задачу вместе с подзадачами и трудозатратами.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $task = $request->user()->tasks()->findOrFail($id);

        DB::transaction(function () use ($task): void {
            $ids = [$task->id, ...$task->subtasks()->pluck('id')->all()];

            TimeEntry::query()->whereIn('task_id', $ids)->delete();
            Task::query()->whereIn('id', $ids)->delete();
        });

        return response()->json(['ok' => true]);
    }

    private function assertColumnOwned(User $user, string $columnId): void
    {
        if (! $user->taskColumns()->whereKey($columnId)->exists()) {
            throw ValidationException::withMessages([
                'columnId' => 'Колонка не найдена.',
            ]);
        }
    }

    /**
     * Вложенность только на один уровень: родитель — корневая задача этого же пользователя.
     */
    private function assertParentAllowed(User $user, ?string $parentId, string $taskId): void
    {
        if ($parentId === null) {
            return;
        }

        if ($parentId === $taskId) {
            throw ValidationException::withMessages(['parentId' => 'Задача не может быть своим родителем.']);
        }

        $parent = $user->tasks()->whereKey($parentId)->first();

        if (! $parent) {
            throw ValidationException::withMessages(['parentId' => 'Родительская задача не найдена.']);
        }

        if ($parent->parent_id !== null) {
            throw ValidationException::withMessages(['parentId' => 'Подзадачи можно создавать только у корневой задачи.']);
        }

        if (Task::query()->where('parent_id', $taskId)->exists()) {
            throw ValidationException::withMessages(['parentId' => 'У задачи с подзадачами не может быть родителя.']);
        }
    }

    private function idRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! TaskSchema::isValidId($value)) {
                $fail('Некорректный идентификатор.');
            }
        };
    }

    private function colorRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value !== null && ! (is_string($value) && preg_match(TaskSchema::COLOR_PATTERN, $value))) {
                $fail('Некорректный цвет.');
            }
        };
    }
}
