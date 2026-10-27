<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskColumn;
use App\Support\TaskSchema;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaskColumnController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'id' => ['required', 'string', 'max:36', $this->idRule(), 'unique:task_columns,id'],
            'title' => ['required', 'string', 'max:120'],
            'order' => ['required', 'numeric'],
            'isDone' => ['sometimes', 'boolean'],
        ]);

        $column = TaskColumn::query()->create([
            'id' => $data['id'],
            'user_id' => $user->id,
            'title' => trim($data['title']),
            'position' => (float) $data['order'],
            'is_done' => (bool) ($data['isDone'] ?? false),
        ]);

        return response()->json($column->toApi(), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $column = $request->user()->taskColumns()->findOrFail($id);

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'order' => ['sometimes', 'required', 'numeric'],
            'isDone' => ['sometimes', 'boolean'],
        ]);

        $attributes = [];

        if (array_key_exists('title', $data)) {
            $attributes['title'] = trim($data['title']);
        }

        if (array_key_exists('order', $data)) {
            $attributes['position'] = (float) $data['order'];
        }

        if (array_key_exists('isDone', $data)) {
            $attributes['is_done'] = (bool) $data['isDone'];
        }

        $column->update($attributes);

        return response()->json($column->refresh()->toApi());
    }

    /**
     * Удаляет колонку. Задачи переезжают в первую оставшуюся колонку по порядку.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $column = $user->taskColumns()->findOrFail($id);

        $remaining = $user->taskColumns()
            ->whereKeyNot($column->id)
            ->orderBy('position')
            ->get();

        if ($remaining->isEmpty()) {
            throw ValidationException::withMessages([
                'id' => 'Нельзя удалить последнюю колонку.',
            ]);
        }

        DB::transaction(function () use ($user, $column, $remaining): void {
            Task::query()
                ->where('user_id', $user->id)
                ->where('task_column_id', $column->id)
                ->update(['task_column_id' => $remaining->first()->id]);

            $column->delete();
        });

        return response()->json(['ok' => true]);
    }

    private function idRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! TaskSchema::isValidId($value)) {
                $fail('Некорректный идентификатор.');
            }
        };
    }
}
