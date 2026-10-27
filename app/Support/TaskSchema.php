<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Throwable;

final class TaskSchema
{
    public const PRIORITIES = ['low', 'medium', 'high'];

    /** Идентификаторы генерирует браузер (UUID v4 или запасной вариант). */
    public const ID_PATTERN = '/^[A-Za-z0-9-]{1,36}$/';

    public const COLOR_PATTERN = '/^#[0-9a-fA-F]{6}$/';

    public const MAX_DESCRIPTION = 16_000_000;

    public const MAX_MINUTES = 1440;

    /**
     * @return array<int, array{title: string, isDone: bool}>
     */
    public static function defaultColumns(): array
    {
        return [
            ['title' => 'Бэклог', 'isDone' => false],
            ['title' => 'В работе', 'isDone' => false],
            ['title' => 'Выполнено', 'isDone' => true],
        ];
    }

    public static function isValidId(mixed $value): bool
    {
        return is_string($value) && preg_match(self::ID_PATTERN, $value) === 1;
    }

    public static function parseDate(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->utc();
        } catch (Throwable) {
            return null;
        }
    }

    public static function clampMinutes(mixed $value): int
    {
        $minutes = is_numeric($value) ? (int) round((float) $value) : 0;

        return max(1, min(self::MAX_MINUTES, $minutes));
    }
}
