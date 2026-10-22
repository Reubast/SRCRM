@extends('layouts.app')

@section('title', 'Дашборд — SRCRM')

@section('content')
    <h1>Дашборд</h1>
    <p class="muted">Привет, {{ $user->name }}. Роль: <strong>{{ $user->role }}</strong>.</p>

    <div class="cards">
        <div class="card">
            <div class="card-value">{{ $users->count() }}</div>
            <div class="card-label">Сотрудников</div>
        </div>
        <div class="card">
            <div class="card-value">0</div>
            <div class="card-label">Клиентов</div>
        </div>
        <div class="card">
            <div class="card-value">0</div>
            <div class="card-label">Сделок в работе</div>
        </div>
    </div>

    <div class="panel">
        <h2>Модули CRM</h2>
        <p class="muted">Клиенты, сделки, задачи и заметки появятся после утверждения ТЗ.</p>
    </div>
@endsection
