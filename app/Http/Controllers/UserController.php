<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;

class UserController extends Controller
{
    public function index(): View
    {
        return view('users.index', [
            'users' => User::query()->orderBy('name')->get(),
        ]);
    }

    public function create(): View
    {
        return view('users.form', [
            'user' => new User(['role' => User::ROLE_MANAGER]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        User::query()->create($data);

        return redirect()->route('users.index')->with('status', 'Сотрудник создан.');
    }

    public function edit(User $user): View
    {
        return view('users.form', ['user' => $user]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $this->validated($request, $user);

        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }

        if ($user->id === $request->user()->id && ($data['role'] ?? null) !== User::ROLE_ADMIN) {
            return back()->withErrors(['role' => 'Нельзя снять с себя роль администратора.']);
        }

        $user->update($data);

        return redirect()->route('users.index')->with('status', 'Сотрудник обновлён.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->withErrors(['user' => 'Нельзя удалить самого себя.']);
        }

        $user->delete();

        return redirect()->route('users.index')->with('status', 'Сотрудник удалён.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?User $user = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => [
                'required', 'string', 'email', 'max:190',
                Rule::unique('users', 'email')->ignore($user?->id),
            ],
            'role' => ['required', Rule::in(User::roles())],
            'password' => [
                $user ? 'nullable' : 'required',
                'confirmed',
                Password::min(8),
            ],
        ]);
    }
}
