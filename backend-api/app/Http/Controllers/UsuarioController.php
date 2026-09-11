<?php

namespace App\Http\Controllers;

use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UsuarioController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'sucesso' => true,
            'dados' => Usuario::query()->orderBy('nome')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:usuarios,email'],
            'senha' => ['required', 'string', 'min:6'],
            'tipo' => ['required', Rule::in(['admin', 'funcionario'])],
            'ativo' => ['sometimes', 'boolean'],
        ]);

        $dados['senha'] = Hash::make($dados['senha']);
        $usuario = Usuario::create($dados);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Usuario criado com sucesso.',
            'dados' => $usuario,
        ], 201);
    }

    public function show(Usuario $usuario): JsonResponse
    {
        return response()->json(['sucesso' => true, 'dados' => $usuario]);
    }

    public function update(Request $request, Usuario $usuario): JsonResponse
    {
        $dados = $request->validate([
            'nome' => ['sometimes', 'required', 'string', 'max:150'],
            'email' => [
                'sometimes', 'required', 'email', 'max:150',
                Rule::unique('usuarios', 'email')->ignore($usuario->id),
            ],
            'senha' => ['sometimes', 'required', 'string', 'min:6'],
            'tipo' => ['sometimes', 'required', Rule::in(['admin', 'funcionario'])],
            'ativo' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('senha', $dados)) {
            $dados['senha'] = Hash::make($dados['senha']);
        }

        $usuario->update($dados);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Usuario atualizado.',
            'dados' => $usuario->fresh(),
        ]);
    }

    public function destroy(Usuario $usuario): JsonResponse
    {
        // Para MVP preferimos desativar em vez de apagar de verdade.
        $usuario->update([
            'ativo' => false,
            'api_token' => null,
        ]);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Usuario desativado. Nenhum historico foi apagado.',
        ]);
    }
}
