<?php

use App\Http\Controllers\Api\TaskColumnController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TaskStateController;
use App\Http\Controllers\Api\TimeEntryController;
use App\Http\Controllers\AuthApiController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->group(function (): void {
    Route::get('auth/me', [AuthApiController::class, 'me']);

    Route::middleware('guest')->group(function (): void {
        Route::post('auth/login', [AuthApiController::class, 'login']);
    });

    Route::middleware('auth')->group(function (): void {
        Route::post('auth/logout', [AuthApiController::class, 'logout']);

        // Данные задач принадлежат аккаунту. Чужие записи отдают 404 (findOrFail по user_id).
        Route::get('state', [TaskStateController::class, 'show']);
        Route::delete('state', [TaskStateController::class, 'destroy']);
        Route::post('state/import', [TaskStateController::class, 'import']);

        Route::post('columns', [TaskColumnController::class, 'store']);
        Route::patch('columns/{id}', [TaskColumnController::class, 'update']);
        Route::delete('columns/{id}', [TaskColumnController::class, 'destroy']);

        Route::post('tasks', [TaskController::class, 'store']);
        Route::patch('tasks/{id}', [TaskController::class, 'update']);
        Route::delete('tasks/{id}', [TaskController::class, 'destroy']);

        Route::post('time-entries', [TimeEntryController::class, 'store']);
        Route::delete('time-entries/{id}', [TimeEntryController::class, 'destroy']);
    });
});

Route::middleware('auth')->prefix('admin')->group(function (): void {
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::post('logout', [AuthApiController::class, 'logoutWeb'])->name('logout');

    Route::middleware('role:admin')->group(function (): void {
        Route::resource('users', UserController::class)->except(['show']);
    });
});
