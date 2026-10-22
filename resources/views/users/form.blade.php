@extends('layouts.app')

@section('title', $user->exists ? 'Изменить сотрудника — SRCRM' : 'Новый сотрудник — SRCRM')

@section('content')
    <h1>{{ $user->exists ? 'Изменить сотрудника' : 'Новый сотрудник' }}</h1>

    <div class="panel">
        <form method="POST"
              action="{{ $user->exists ? route('users.update', $user) : route('users.store') }}"
              class="form form-wide">
            @csrf
            @if ($user->exists)
                @method('PUT')
            @endif

            <label>
                Имя
                <input type="text" name="name" value="{{ old('name', $user->name) }}" required>
            </label>
            <label>
                Email
                <input type="email" name="email" value="{{ old('email', $user->email) }}" required>
            </label>
            <label>
                Роль
                <select name="role" required>
                    @foreach (App\Models\User::roles() as $role)
                        <option value="{{ $role }}" @selected(old('role', $user->role) === $role)>{{ $role }}</option>
                    @endforeach
                </select>
            </label>
            <label>
                Пароль {{ $user->exists ? '(оставьте пустым, чтобы не менять)' : '' }}
                <input type="password" name="password" autocomplete="new-password" @required(! $user->exists)>
            </label>
            <label>
                Повтор пароля
                <input type="password" name="password_confirmation" autocomplete="new-password">
            </label>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <a class="btn btn-ghost" href="{{ route('users.index') }}">Отмена</a>
            </div>
        </form>
    </div>
@endsection
