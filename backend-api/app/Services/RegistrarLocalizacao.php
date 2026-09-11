<?php

namespace App\Services;

use App\Models\Dispositivo;
use App\Models\Localizacao;
use Illuminate\Support\Facades\DB;

/**
 * Centraliza a gravação de GPS de uma ambulância.
 *
 * Este serviço é usado por dois caminhos:
 * 1. POST /api/localizacoes, autenticado pelo X-Device-Token legado;
 * 2. POST /api/mobile/localizacoes, autenticado pelo motorista com Bearer token.
 *
 * Assim, a regra de persistência fica em um único lugar e o painel web continua
 * lendo os mesmos campos/tabelas independentemente da origem da localização.
 */
class RegistrarLocalizacao
{
    /**
     * Grava o ponto no histórico e atualiza a posição atual do dispositivo.
     *
     * @param  array<string, mixed>  $dados
     */
    public function registrar(Dispositivo $dispositivo, array $dados): Localizacao
    {
        return DB::transaction(function () use ($dados, $dispositivo) {
            // Passo 1: o histórico recebe um novo ponto imutável.
            $localizacao = Localizacao::create([
                'dispositivo_id' => $dispositivo->id,
                'latitude' => $dados['latitude'],
                'longitude' => $dados['longitude'],
                'velocidade' => $dados['velocidade'] ?? null,
                'precisao_gps' => $dados['precisao_gps'] ?? null,
                'bateria' => $dados['bateria'] ?? null,
                'registrado_em' => $dados['registrado_em'] ?? now(),
            ]);

            // Passo 2: o registro do dispositivo recebe apenas a posição mais recente.
            // O painel usa estes campos para desenhar o mapa sem consultar todo o histórico.
            $atualizacaoDispositivo = [
                'latitude' => $dados['latitude'],
                'longitude' => $dados['longitude'],
                'velocidade' => $dados['velocidade'] ?? null,
                'precisao_gps' => $dados['precisao_gps'] ?? null,
                'bateria' => $dados['bateria'] ?? null,
                'ultima_comunicacao' => now(),
            ];

            if (array_key_exists('quilometragem', $dados)) {
                $atualizacaoDispositivo['quilometragem'] = $dados['quilometragem'];
            }

            $dispositivo->update($atualizacaoDispositivo);

            return $localizacao;
        });
    }
}
