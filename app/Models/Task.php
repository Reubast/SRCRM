<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'id',
    'user_id',
    'parent_id',
    'task_column_id',
    'title',
    'description',
    'priority',
    'start_at',
    'deadline',
    'completed',
    'position',
    'color',
])]
class Task extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return [
            'start_at' => 'immutable_datetime',
            'deadline' => 'immutable_datetime',
            'completed' => 'boolean',
            'position' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function column(): BelongsTo
    {
        return $this->belongsTo(TaskColumn::class, 'task_column_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function subtasks(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class, 'task_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'parentId' => $this->parent_id,
            'title' => $this->title,
            'description' => (string) $this->description,
            'columnId' => $this->task_column_id,
            'priority' => $this->priority,
            'startAt' => self::iso($this->start_at),
            'deadline' => self::iso($this->deadline),
            'completed' => (bool) $this->completed,
            'order' => (float) $this->position,
            'color' => $this->color,
            'createdAt' => self::iso($this->created_at),
            'updatedAt' => self::iso($this->updated_at),
        ];
    }

    public static function iso(?\DateTimeInterface $date): ?string
    {
        if ($date === null) {
            return null;
        }

        return CarbonImmutable::instance($date)->utc()->format('Y-m-d\TH:i:s.v\Z');
    }
}
