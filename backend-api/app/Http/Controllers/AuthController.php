<?php

namespace App\Http\Controllers;

use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'email' => ['required', 'email'],
            'senha' => ['required', 'string'],
        ]);

        $usuario = Usuario::query()
            ->where('email', $dados['email'])
            ->where('ativo', true)
            ->first();

        if (! $usuario || ! Hash::check($dados['senha'], $usuario->senha)) {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Email ou senha incorretos.',
            ], 401);
        }

        $tokenAberto = Str::random(80);
        $usuario->api_token = hash('sha256', $tokenAberto);
        $usuario->save();

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Login realizado com sucesso.',
            'token' => $tokenAberto,
            'tipo_token' => 'Bearer',
            'usuario' => $usuario,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'sucesso' => true,
            'usuario' => $request->attributes->get('usuario_autenticado'),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $usuario = $request->attributes->get('usuario_autenticado');
        $usuario->api_token = null;
        $usuario->save();

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Logout realizado. O token anterior nao e mais valido.',
        ]);
    }
}
