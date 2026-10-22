<?php

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
    });
});

Route::middleware('auth')->prefix('admin')->group(function (): void {
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::post('logout', [AuthApiController::class, 'logoutWeb'])->name('logout');

    Route::middleware('role:admin')->group(function (): void {
        Route::resource('users', UserController::class)->except(['show']);
    });
});
