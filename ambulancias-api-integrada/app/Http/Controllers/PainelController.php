<?php

namespace App\Http\Controllers;

use App\Models\Dispositivo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PainelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $usuario = $request->attributes->get('usuario_autenticado');

        $query = Dispositivo::query()
            ->with('usuario:id,nome,email,tipo')
            ->where('ativo', true)
            ->orderBy('nome');

        if ($usuario->tipo !== 'admin') {
            $query->where('usuario_id', $usuario->id);
        }

        $dispositivos = $query->get();

        return response()->json([
            'sucesso' => true,
            'mensagem' => $usuario->tipo === 'admin'
                ? 'Painel da administracao: todos os dispositivos ativos.'
                : 'Painel do funcionario: apenas dispositivos vinculados ao usuario.',
            'resumo' => [
                'total' => $dispositivos->count(),
                'online' => $dispositivos->where('status', 'online')->count(),
                'sem_comunicacao' => $dispositivos->where('status', 'sem_comunicacao')->count(),
                'offline' => $dispositivos->where('status', 'offline')->count(),
            ],
            'dispositivos' => $dispositivos,
        ]);
    }
}
