<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(): View
    {
        $users = User::query()->orderBy('name')->get(['id', 'name', 'email', 'role']);

        return view('dashboard', [
            'user' => request()->user(),
            'users' => $users,
        ]);
    }
}
