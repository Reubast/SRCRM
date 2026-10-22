@extends('layouts.app')

@section('title', 'Обзор · TaskFlow')

@section('content')
    <h1>Обзор</h1>
    <p class="muted">Привет, {{ $user->name }}. Ваша роль: <strong>{{ $user->role }}</strong>.</p>

    <div class="cards">
        <div class="card">
            <div class="card-value">{{ $users->count() }}</div>
            <div class="card-label">Пользователей</div>
        </div>
        <div class="card">
            <div class="card-value">{{ $users->where('role', 'admin')->count() }}</div>
            <div class="card-label">Администраторов</div>
        </div>
        <div class="card">
            <div class="card-value">{{ $users->where('role', 'manager')->count() }}</div>
            <div class="card-label">Менеджеров</div>
        </div>
    </div>

    <div class="panel">
        <h2>TaskFlow</h2>
        <p class="muted">Канбан, календарь и задачи доступны в основном приложении. Данные задач хранятся локально в браузере и экспортируются в JSON.</p>
        <p><a class="btn btn-primary" href="/">Открыть TaskFlow</a></p>
    </div>
@endsection
