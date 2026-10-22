@extends('layouts.app')

@section('title', 'Вход — SRCRM')

@section('content')
    <div class="auth-card">
        <h1>Вход в SRCRM</h1>
        <p class="muted">Доступ только для сотрудников.</p>

        <form method="POST" action="{{ route('login.store') }}" class="form">
            @csrf
            <label>
                Email
                <input type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="username">
            </label>
            <label>
                Пароль
                <input type="password" name="password" required autocomplete="current-password">
            </label>
            <label class="checkbox">
                <input type="checkbox" name="remember" value="1"> Запомнить меня
            </label>
            <button type="submit" class="btn btn-primary">Войти</button>
        </form>
    </div>
@endsection
