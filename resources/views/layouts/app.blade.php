<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Админка TaskFlow')</title>
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
</head>
<body>
@auth
    <header class="topbar">
        <div class="container topbar-inner">
            <a class="brand" href="{{ route('dashboard') }}">TaskFlow · админка</a>
            <nav class="nav">
                <a href="{{ route('dashboard') }}" @class(['active' => request()->routeIs('dashboard')])>Обзор</a>
                @if (auth()->user()->isAdmin())
                    <a href="{{ route('users.index') }}" @class(['active' => request()->routeIs('users.*')])>Пользователи</a>
                @endif
            </nav>
            <div class="userbox">
                <a class="btn btn-ghost" href="/">Открыть TaskFlow</a>
                <span class="user-name">{{ auth()->user()->name }}</span>
                <span class="badge">{{ auth()->user()->role }}</span>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="btn btn-ghost">Выйти</button>
                </form>
            </div>
        </div>
    </header>
@endauth

<main class="container main">
    @if (session('status'))
        <div class="alert alert-success">{{ session('status') }}</div>
    @endif

    @if ($errors->any())
        <div class="alert alert-error">
            <ul>
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    @yield('content')
</main>
</body>
</html>
