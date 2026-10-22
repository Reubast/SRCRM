<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        if (User::query()->where('role', User::ROLE_ADMIN)->exists()) {
            return;
        }

        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (blank($email) || blank($password)) {
            throw new RuntimeException('ADMIN_EMAIL и ADMIN_PASSWORD должны быть заданы для создания администратора.');
        }

        User::query()->create([
            'name' => env('ADMIN_NAME', 'Администратор'),
            'email' => $email,
            'password' => $password,
            'role' => User::ROLE_ADMIN,
        ]);
    }
}
