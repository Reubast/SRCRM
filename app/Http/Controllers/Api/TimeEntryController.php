<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TimeEntry;
use App\Support\TaskSchema;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeEntryController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'id' => ['required', 'string', 'max:36', $this->idRule(), 'unique:task_time_entries,id'],
            'taskId' => ['required', 'string', 'max:36'],
            'date' => ['required', 'date_format:Y-m-d'],
            'minutes' => ['required', 'numeric', 'min:1', 'max:'.TaskSchema::MAX_MINUTES],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        if (! $user->tasks()->whereKey($data['taskId'])->exists()) {
            return response()->json(['message' => 'Задача не найдена.', 'errors' => [
                'taskId' => ['Задача не найдена.'],
            ]], 422);
        }

        $entry = TimeEntry::query()->create([
            'id' => $data['id'],
            'user_id' => $user->id,
            'task_id' => $data['taskId'],
            'entry_date' => $data['date'],
            'minutes' => TaskSchema::clampMinutes($data['minutes']),
            'note' => trim((string) ($data['note'] ?? '')),
        ]);

        return response()->json($entry->refresh()->toApi(), 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $request->user()->timeEntries()->findOrFail($id)->delete();

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
