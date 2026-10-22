@extends('layouts.app')

@section('title', 'Сотрудники — SRCRM')

@section('content')
    <div class="page-head">
        <h1>Сотрудники</h1>
        <a class="btn btn-primary" href="{{ route('users.create') }}">Добавить</a>
    </div>

    <div class="panel">
        <table class="table">
            <thead>
            <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th></th>
            </tr>
            </thead>
            <tbody>
            @forelse ($users as $user)
                <tr>
                    <td>{{ $user->name }}</td>
                    <td>{{ $user->email }}</td>
                    <td><span class="badge">{{ $user->role }}</span></td>
                    <td class="actions">
                        <a class="btn btn-ghost" href="{{ route('users.edit', $user) }}">Изменить</a>
                        @if ($user->id !== auth()->id())
                            <form method="POST" action="{{ route('users.destroy', $user) }}"
                                  onsubmit="return confirm('Удалить сотрудника?')">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger">Удалить</button>
                            </form>
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="4" class="muted">Пока никого нет.</td>
                </tr>
            @endforelse
            </tbody>
        </table>
    </div>
@endsection
