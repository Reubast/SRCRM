<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['id', 'user_id', 'task_id', 'entry_date', 'minutes', 'note'])]
class TimeEntry extends Model
{
    protected $table = 'task_time_entries';

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return [
            'entry_date' => 'date:Y-m-d',
            'minutes' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'taskId' => $this->task_id,
            'date' => $this->entry_date->format('Y-m-d'),
            'minutes' => (int) $this->minutes,
            'note' => (string) $this->note,
            'createdAt' => Task::iso($this->created_at),
        ];
    }
}
