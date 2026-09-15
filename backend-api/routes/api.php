<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DispositivoController;
use App\Http\Controllers\LocalizacaoController;
use App\Http\Controllers\MobileController;
use App\Http\Controllers\PainelController;
use App\Http\Controllers\SimulacaoController;
use App\Http\Controllers\UsuarioController;
use Illuminate\Support\Facades\Route;

// ---------------------------------------------------------------------
// ROTAS PUBLICAS
// ---------------------------------------------------------------------
Route::get('/health', function () {
    return response()->json([
        'sucesso' => true,
        'mensagem' => 'API de ambulancias online.',
        'horario' => now()->toIso8601String(),
    ]);
});

// Login de admin/funcionario.
Route::post('/login', [AuthController::class, 'login']);

// Compatibilidade: tablet provisionado pode continuar enviando GPS por X-Device-Token.
Route::post('/localizacoes', [LocalizacaoController::class, 'store']);

// ---------------------------------------------------------------------
// ROTAS QUE EXIGEM LOGIN DE USUARIO
// Authorization: Bearer TOKEN
// ---------------------------------------------------------------------
Route::middleware('usuario.token')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Aplicativo Expo do motorista.
    Route::prefix('mobile')->group(function () {
        Route::get('/contexto', [MobileController::class, 'contexto']);
        Route::post('/localizacoes', [MobileController::class, 'localizacao']);
        Route::post('/confirmar-saida', [MobileController::class, 'confirmarSaida']);
    });

    // Admin ve todos; funcionario ve apenas os dispositivos vinculados.
    Route::get('/painel', [PainelController::class, 'index']);
    Route::get('/dispositivos', [DispositivoController::class, 'index']);
    Route::get('/dispositivos/{dispositivo}', [DispositivoController::class, 'show']);
    Route::get('/dispositivos/{dispositivo}/localizacoes', [LocalizacaoController::class, 'index']);

    // -----------------------------------------------------------------
    // SOMENTE ADMINISTRADOR
    // -----------------------------------------------------------------
    Route::middleware('admin')->group(function () {
        Route::post('/simulacao/brasilia', [SimulacaoController::class, 'store']);
        Route::get('/usuarios', [UsuarioController::class, 'index']);
        Route::post('/usuarios', [UsuarioController::class, 'store']);
        Route::get('/usuarios/{usuario}', [UsuarioController::class, 'show']);
        Route::put('/usuarios/{usuario}', [UsuarioController::class, 'update']);
        Route::delete('/usuarios/{usuario}', [UsuarioController::class, 'destroy']);

        Route::post('/dispositivos', [DispositivoController::class, 'store']);
        Route::put('/dispositivos/{dispositivo}', [DispositivoController::class, 'update']);
        Route::delete('/dispositivos/{dispositivo}', [DispositivoController::class, 'destroy']);
        Route::delete('/dispositivos/{dispositivo}/excluir', [DispositivoController::class, 'excluir']);
        Route::post('/dispositivos/{dispositivo}/gerar-token', [DispositivoController::class, 'gerarToken']);
    });
});
