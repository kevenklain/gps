<?php

namespace App\Http\Controllers;

use App\Models\Dispositivo;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DispositivoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $usuario = $request->attributes->get('usuario_autenticado');

        $query = Dispositivo::query()
            ->with('usuario:id,nome,email,tipo')
            ->orderBy('nome');

        // Admin enxerga a frota inteira.
        // Funcionario enxerga somente os dispositivos vinculados a ele.
        if ($usuario->tipo !== 'admin') {
            $query->where('usuario_id', $usuario->id);
        }

        return response()->json([
            'sucesso' => true,
            'dados' => $query->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'usuario_id' => ['nullable', 'integer', 'exists:usuarios,id'],
            'nome' => ['required', 'string', 'max:100'],
            'identificador' => ['required', 'string', 'max:100', 'unique:dispositivos,identificador'],
            'placa' => ['nullable', 'string', 'max:20'],
            'modelo_veiculo' => ['nullable', 'string', 'max:100'],
            'quilometragem' => ['nullable', 'numeric', 'min:0'],
            'ativo' => ['sometimes', 'boolean'],
        ]);

        if (! empty($dados['usuario_id'])) {
            $funcionario = Usuario::find($dados['usuario_id']);
            if ($funcionario && ! $funcionario->ativo) {
                return response()->json([
                    'sucesso' => false,
                    'mensagem' => 'Nao e possivel vincular um dispositivo a um usuario inativo.',
                ], 422);
            }
        }

        // Token do tablet: devolvemos o valor aberto uma unica vez.
        // No banco fica somente o hash SHA-256.
        $tokenAberto = Str::random(80);
        $dados['token'] = hash('sha256', $tokenAberto);

        $dispositivo = Dispositivo::create($dados);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Dispositivo criado. Guarde o token no aplicativo Expo.',
            'device_token' => $tokenAberto,
            'dados' => $dispositivo->load('usuario:id,nome,email,tipo'),
        ], 201);
    }

    public function show(Request $request, Dispositivo $dispositivo): JsonResponse
    {
        if (! $this->podeVer($request, $dispositivo)) {
            return response()->json(['sucesso' => false, 'mensagem' => 'Acesso negado.'], 403);
        }

        return response()->json([
            'sucesso' => true,
            'dados' => $dispositivo->load('usuario:id,nome,email,tipo'),
        ]);
    }

    public function update(Request $request, Dispositivo $dispositivo): JsonResponse
    {
        $dados = $request->validate([
            'usuario_id' => ['nullable', 'integer', 'exists:usuarios,id'],
            'nome' => ['sometimes', 'required', 'string', 'max:100'],
            'identificador' => [
                'sometimes', 'required', 'string', 'max:100',
                Rule::unique('dispositivos', 'identificador')->ignore($dispositivo->id),
            ],
            'placa' => ['nullable', 'string', 'max:20'],
            'modelo_veiculo' => ['nullable', 'string', 'max:100'],
            'quilometragem' => ['nullable', 'numeric', 'min:0'],
            'ativo' => ['sometimes', 'boolean'],
        ]);

        $dispositivo->update($dados);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Dispositivo atualizado.',
            'dados' => $dispositivo->fresh()->load('usuario:id,nome,email,tipo'),
        ]);
    }

    public function destroy(Dispositivo $dispositivo): JsonResponse
    {
        // Desativar preserva o cadastro e o historico GPS.
        $dispositivo->update(['ativo' => false, 'token' => null]);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Dispositivo desativado. O historico foi preservado.',
        ]);
    }

    public function excluir(Dispositivo $dispositivo): JsonResponse
    {
        $nome = $dispositivo->nome;

        // A FK de localizacoes usa cascadeOnDelete, portanto a exclusao permanente
        // remove tambem o historico GPS associado ao dispositivo.
        $dispositivo->delete();

        return response()->json([
            'sucesso' => true,
            'mensagem' => "Veiculo \"{$nome}\" excluido permanentemente.",
        ]);
    }

    public function gerarToken(Dispositivo $dispositivo): JsonResponse
    {
        $tokenAberto = Str::random(80);
        $dispositivo->update(['token' => hash('sha256', $tokenAberto)]);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Novo token gerado. O token anterior deixou de funcionar.',
            'device_token' => $tokenAberto,
        ]);
    }

    private function podeVer(Request $request, Dispositivo $dispositivo): bool
    {
        $usuario = $request->attributes->get('usuario_autenticado');

        return $usuario->tipo === 'admin' || $dispositivo->usuario_id === $usuario->id;
    }
}
