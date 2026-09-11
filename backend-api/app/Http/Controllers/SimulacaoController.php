<?php

namespace App\Http\Controllers;

use App\Services\SimulacaoBrasilia;
use Illuminate\Http\JsonResponse;

class SimulacaoController extends Controller
{
    /**
     * Entrada HTTP: POST /api/simulacao/brasilia, chamado pelo mapa no navegador.
     * Os middlewares usuario.token e admin ja autenticaram e autorizaram a chamada.
     * O Laravel injeta o service; ele executa as regras e grava os models no banco.
     * Este controller transforma o resultado da operacao em uma resposta JSON.
     */
    public function store(SimulacaoBrasilia $simulacao): JsonResponse
    {
        $quantidadeDeDispositivosAtualizados = $simulacao->atualizar();

        return response()->json([
            'sucesso' => true,
            'atualizados' => $quantidadeDeDispositivosAtualizados,
            'mensagem' => 'Posicoes ficticias atualizadas em Brasilia/DF.',
        ]);
    }
}
