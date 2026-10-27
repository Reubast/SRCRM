<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\TaskColumn;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_read_state(): void
    {
        $this->getJson('/api/state')->assertUnauthorized();
    }

    public function test_new_user_gets_default_columns(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/state')->assertOk();

        $this->assertCount(3, $response->json('columns'));
        $this->assertTrue(collect($response->json('columns'))->contains(fn ($c) => $c['isDone'] === true));
    }

    public function test_tasks_are_isolated_between_users(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $columnId = $this->actingAs($alice)->getJson('/api/state')->json('columns.0.id');
        $this->actingAs($alice)->postJson('/api/tasks', [
            'id' => 'task-alice',
            'columnId' => $columnId,
            'title' => 'Личная задача Алисы',
            'priority' => 'high',
            'order' => 1,
        ])->assertCreated();

        $this->assertSame(1, Task::query()->where('user_id', $alice->id)->count());

        $bobState = $this->actingAs($bob)->getJson('/api/state')->assertOk();
        $this->assertSame([], $bobState->json('tasks'));

        $this->actingAs($bob)->patchJson('/api/tasks/task-alice', ['title' => 'Взлом'])->assertNotFound();
        $this->actingAs($bob)->deleteJson('/api/tasks/task-alice')->assertNotFound();

        $this->assertSame('Личная задача Алисы', Task::query()->find('task-alice')->title);
    }

    public function test_cannot_reference_other_users_column_or_task(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $aliceColumn = $this->actingAs($alice)->getJson('/api/state')->json('columns.0.id');
        $bobColumn = $this->actingAs($bob)->getJson('/api/state')->json('columns.0.id');

        $this->actingAs($alice)->postJson('/api/tasks', [
            'id' => 'task-root',
            'columnId' => $aliceColumn,
            'title' => 'Корень',
            'priority' => 'low',
            'order' => 1,
        ])->assertCreated();

        $this->actingAs($bob)->postJson('/api/tasks', [
            'id' => 'task-bob',
            'columnId' => $aliceColumn,
            'title' => 'Чужая колонка',
            'priority' => 'low',
            'order' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('columnId');

        $this->actingAs($bob)->postJson('/api/tasks', [
            'id' => 'task-bob-sub',
            'columnId' => $bobColumn,
            'parentId' => 'task-root',
            'title' => 'Подзадача чужой задачи',
            'priority' => 'low',
            'order' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('parentId');

        $this->actingAs($bob)->postJson('/api/time-entries', [
            'id' => 'entry-bob',
            'taskId' => 'task-root',
            'date' => '2026-10-27',
            'minutes' => 30,
        ])->assertUnprocessable();

        $this->assertSame(0, TimeEntry::query()->count());
    }

    public function test_subtasks_are_one_level_deep(): void
    {
        $user = User::factory()->create();
        $columnId = $this->actingAs($user)->getJson('/api/state')->json('columns.0.id');

        $base = ['columnId' => $columnId, 'priority' => 'medium', 'order' => 1];

        $this->actingAs($user)->postJson('/api/tasks', $base + ['id' => 'root', 'title' => 'Корень'])->assertCreated();
        $this->actingAs($user)->postJson('/api/tasks', $base + ['id' => 'child', 'title' => 'Ребёнок', 'parentId' => 'root'])->assertCreated();
        $this->actingAs($user)->postJson('/api/tasks', $base + ['id' => 'grand', 'title' => 'Внук', 'parentId' => 'child'])
            ->assertUnprocessable()->assertJsonValidationErrors('parentId');
    }

    public function test_deleting_task_removes_subtasks_and_time_entries(): void
    {
        $user = User::factory()->create();
        $columnId = $this->actingAs($user)->getJson('/api/state')->json('columns.0.id');

        $base = ['columnId' => $columnId, 'priority' => 'medium', 'order' => 1];
        $this->actingAs($user)->postJson('/api/tasks', $base + ['id' => 'root', 'title' => 'Корень'])->assertCreated();
        $this->actingAs($user)->postJson('/api/tasks', $base + ['id' => 'child', 'title' => 'Ребёнок', 'parentId' => 'root'])->assertCreated();
        $this->actingAs($user)->postJson('/api/time-entries', [
            'id' => 'entry-1', 'taskId' => 'child', 'date' => '2026-10-27', 'minutes' => 45,
        ])->assertCreated();

        $this->actingAs($user)->deleteJson('/api/tasks/root')->assertOk();

        $this->assertSame(0, Task::query()->where('user_id', $user->id)->count());
        $this->assertSame(0, TimeEntry::query()->count());
    }

    public function test_deleting_column_moves_tasks_to_first_remaining_column(): void
    {
        $user = User::factory()->create();
        $state = $this->actingAs($user)->getJson('/api/state')->json();
        $backlog = $state['columns'][0]['id'];
        $done = $state['columns'][2]['id'];

        $this->actingAs($user)->postJson('/api/tasks', [
            'id' => 'task-x', 'columnId' => $done, 'title' => 'Выполненная', 'priority' => 'low', 'order' => 1,
        ])->assertCreated();

        $this->actingAs($user)->deleteJson("/api/columns/{$done}")->assertOk();

        $this->assertSame($backlog, Task::query()->find('task-x')->task_column_id);
        $this->assertNull(TaskColumn::query()->find($done));
    }

    public function test_cannot_delete_last_column(): void
    {
        $user = User::factory()->create();
        $columns = $this->actingAs($user)->getJson('/api/state')->json('columns');

        $this->actingAs($user)->deleteJson("/api/columns/{$columns[0]['id']}")->assertOk();
        $this->actingAs($user)->deleteJson("/api/columns/{$columns[1]['id']}")->assertOk();

        $this->actingAs($user)->deleteJson("/api/columns/{$columns[2]['id']}")->assertUnprocessable();
    }

    public function test_import_merge_keeps_existing_data_and_remaps_taken_ids(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $aliceColumn = $this->actingAs($alice)->getJson('/api/state')->json('columns.0.id');
        $this->actingAs($alice)->postJson('/api/tasks', [
            'id' => 'shared-id', 'columnId' => $aliceColumn, 'title' => 'Алисина', 'priority' => 'low', 'order' => 1,
        ])->assertCreated();

        $payload = [
            'app' => 'taskflow',
            'version' => 2,
            'columns' => [['id' => 'bob-col', 'title' => 'Бэклог', 'order' => 0, 'isDone' => false]],
            'tasks' => [
                ['id' => 'shared-id', 'parentId' => null, 'title' => 'Бобова', 'description' => '', 'columnId' => 'bob-col',
                    'priority' => 'high', 'startAt' => null, 'deadline' => '2026-10-30T10:00:00.000Z', 'completed' => false, 'order' => 1],
                ['id' => 'bob-sub', 'parentId' => 'shared-id', 'title' => 'Подзадача', 'description' => '', 'columnId' => 'bob-col',
                    'priority' => 'high', 'startAt' => null, 'deadline' => null, 'completed' => true, 'order' => 2],
            ],
            'timeEntries' => [
                ['id' => 'shared-id', 'taskId' => 'shared-id', 'date' => '2026-10-27', 'minutes' => 90, 'note' => 'тест'],
            ],
        ];

        $response = $this->actingAs($bob)->postJson('/api/state/import', [
            'mode' => 'merge',
            'payload' => $payload,
        ])->assertOk();

        $this->assertSame(['columns' => 1, 'tasks' => 2, 'timeEntries' => 1], $response->json('imported'));

        // Алиса не затронута.
        $aliceTask = Task::query()->find('shared-id');
        $this->assertSame($alice->id, $aliceTask->user_id);
        $this->assertSame('Алисина', $aliceTask->title);

        // У Боба задача получила новый id, подзадача и запись времени ссылаются на неё.
        $bobTask = Task::query()->where('user_id', $bob->id)->where('title', 'Бобова')->firstOrFail();
        $this->assertNotSame('shared-id', $bobTask->id);
        $this->assertSame($bobTask->id, Task::query()->where('title', 'Подзадача')->value('parent_id'));
        $this->assertSame($bobTask->id, TimeEntry::query()->where('user_id', $bob->id)->value('task_id'));
    }

    public function test_import_replace_wipes_previous_data(): void
    {
        $user = User::factory()->create();
        $columnId = $this->actingAs($user)->getJson('/api/state')->json('columns.0.id');
        $this->actingAs($user)->postJson('/api/tasks', [
            'id' => 'old-task', 'columnId' => $columnId, 'title' => 'Старая', 'priority' => 'low', 'order' => 1,
        ])->assertCreated();

        $this->actingAs($user)->postJson('/api/state/import', [
            'mode' => 'replace',
            'payload' => [
                'columns' => [['id' => 'c1', 'title' => 'Одна', 'order' => 0, 'isDone' => true]],
                'tasks' => [['id' => 't1', 'title' => 'Новая', 'columnId' => 'c1', 'priority' => 'high', 'order' => 0]],
                'timeEntries' => [],
            ],
        ])->assertOk();

        $this->assertNull(Task::query()->find('old-task'));
        $this->assertSame(['Новая'], Task::query()->where('user_id', $user->id)->pluck('title')->all());
    }

    public function test_validation_rejects_bad_input(): void
    {
        $user = User::factory()->create();
        $columnId = $this->actingAs($user)->getJson('/api/state')->json('columns.0.id');

        $this->actingAs($user)->postJson('/api/tasks', [
            'id' => 'bad id with spaces',
            'columnId' => $columnId,
            'title' => 'x',
            'priority' => 'urgent',
            'order' => 1,
            'color' => 'red',
        ])->assertUnprocessable()->assertJsonValidationErrors(['id', 'priority', 'color']);

        $this->actingAs($user)->postJson('/api/time-entries', [
            'id' => 'entry-bad', 'taskId' => 'nope', 'date' => '27.10.2026', 'minutes' => 0,
        ])->assertUnprocessable()->assertJsonValidationErrors(['date', 'minutes']);
    }
}
