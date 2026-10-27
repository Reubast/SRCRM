<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaskColumn;
use App\Models\User;
use App\Services\TaskImporter;
use App\Support\TaskSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskStateController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->ensureDefaultColumns($user);

        return response()->json($this->state($user));
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($user): void {
            $user->timeEntries()->delete();
            $user->tasks()->delete();
            $user->taskColumns()->delete();
        });

        $this->ensureDefaultColumns($user);

        return response()->json($this->state($user));
    }

    public function import(Request $request, TaskImporter $importer): JsonResponse
    {
        $data = $request->validate([
            'mode' => ['required', Rule::in(['merge', 'replace'])],
            'payload' => ['required', 'array'],
            'payload.columns' => ['present', 'array', 'max:200'],
            'payload.tasks' => ['present', 'array', 'max:20000'],
            'payload.timeEntries' => ['nullable', 'array', 'max:50000'],
        ]);

        $user = $request->user();
        $counts = $importer->import($user, $data['payload'], $data['mode'] === 'replace');

        $this->ensureDefaultColumns($user);

        return response()->json([
            'imported' => $counts,
            ...$this->state($user),
        ]);
    }

    /**
     * @return array{columns: array<int, array<string, mixed>>, tasks: array<int, array<string, mixed>>, timeEntries: array<int, array<string, mixed>>}
     */
    public function state(User $user): array
    {
        return [
            'columns' => $user->taskColumns()->orderBy('position')->get()->map->toApi()->values()->all(),
            'tasks' => $user->tasks()->orderBy('position')->get()->map->toApi()->values()->all(),
            'timeEntries' => $user->timeEntries()
                ->orderBy('entry_date', 'desc')
                ->orderBy('created_at', 'desc')
                ->get()
                ->map->toApi()
                ->values()
                ->all(),
        ];
    }

    private function ensureDefaultColumns(User $user): void
    {
        if ($user->taskColumns()->exists()) {
            return;
        }

        foreach (TaskSchema::defaultColumns() as $index => $column) {
            TaskColumn::query()->create([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'user_id' => $user->id,
                'title' => $column['title'],
                'position' => $index,
                'is_done' => $column['isDone'],
            ]);
        }
    }
}
