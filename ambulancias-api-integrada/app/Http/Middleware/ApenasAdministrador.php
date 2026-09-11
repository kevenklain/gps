<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApenasAdministrador
{
    public function handle(Request $request, Closure $next): Response|JsonResponse
    {
        $usuario = $request->attributes->get('usuario_autenticado');

        if (! $usuario || $usuario->tipo !== 'admin') {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Apenas administradores podem executar esta operacao.',
            ], 403);
        }

        return $next($request);
    }
}
