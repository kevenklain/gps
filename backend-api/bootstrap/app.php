<?php

use App\Http\Middleware\ApenasAdministrador;
use App\Http\Middleware\AutenticarUsuarioPorToken;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Apelidos curtos usados em routes/api.php.
        $middleware->alias([
            'usuario.token' => AutenticarUsuarioPorToken::class,
            'admin' => ApenasAdministrador::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Como este projeto e somente uma API, erros devem voltar em JSON.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })
    ->create();
