<?php

namespace App\Http\Middleware;

use App\Models\Usuario;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AutenticarUsuarioPorToken
{
    public function handle(Request $request, Closure $next): Response|JsonResponse
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Token de usuario nao informado.',
                'como_corrigir' => 'Envie o cabecalho Authorization: Bearer SEU_TOKEN.',
            ], 401);
        }

        // No banco guardamos apenas SHA-256 do token.
        // Se alguem conseguir ler o banco, nao encontra o token original.
        $usuario = Usuario::query()
            ->where('api_token', hash('sha256', $token))
            ->where('ativo', true)
            ->first();

        if (! $usuario) {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Token de usuario invalido ou usuario inativo.',
            ], 401);
        }

        // Controllers seguintes conseguem recuperar o usuario daqui.
        $request->attributes->set('usuario_autenticado', $usuario);

        return $next($request);
    }
}
