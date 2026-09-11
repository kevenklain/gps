<?php

namespace App\Services;

use App\Models\Dispositivo;
use App\Models\Localizacao;
use Illuminate\Support\Facades\DB;

class SimulacaoBrasilia
{
    // Um circuito completo leva 10 minutos; o deslocamento e expresso em graus.
    private const DURACAO_DO_CIRCUITO_EM_SEGUNDOS = 600;
    private const RAIO_DO_CIRCUITO_EM_GRAUS = 0.006;
    private const VELOCIDADE_SIMULADA_EM_KM_POR_HORA = 25;
    private const INTERVALO_MINIMO_ENTRE_PONTOS_EM_SEGUNDOS = 4;

    /**
     * Compartilhado pelo SimulacaoController (HTTP) e pelo BrasiliaSeeder (Artisan).
     * Nao depende de Request ou Response: recebe a chamada, calcula as posicoes
     * e usa os models Eloquent para persistir no PostgreSQL.
     * Retorna somente a quantidade efetivamente atualizada nesta chamada.
     */
    public function atualizar(): int
    {
        // Circuitos ficticios na regiao de Brasilia; nao representam rotas viarias.
        $centros = [
            [-15.7942, -47.8822], [-15.8070, -47.8900],
            [-15.8200, -47.9100], [-15.8350, -47.9250],
            [-15.7800, -47.8900], [-15.7600, -47.8800],
            [-15.7450, -47.8950], [-15.7900, -47.9250],
            [-15.8050, -47.9450], [-15.8250, -47.9550],
        ];

        // Historico e posicao atual precisam ser confirmados juntos. Se alguma
        // gravacao falhar, a transacao reverte todas as alteracoes deste passo.
        return DB::transaction(function () use ($centros) {
            $quantidade = 0;
            foreach ($centros as $indice => [$latitude, $longitude]) {
                $numero = str_pad((string) ($indice + 1), 2, '0', STR_PAD_LEFT);
                // Somente os dez identificadores de demonstracao participam.
                // O bloqueio dura ate o fim da transacao e serializa abas concorrentes.
                $dispositivo = Dispositivo::where('identificador', "DEMO-TABLET-{$numero}")
                    ->lockForUpdate()->first();
                if (! $dispositivo) {
                    continue;
                }

                $agora = now();
                // Evita pontos duplicados quando duas abas simulam ao mesmo tempo.
                if ($dispositivo->ultima_comunicacao) {
                    $segundosDesdeUltimaComunicacao = abs(
                        $dispositivo->ultima_comunicacao->diffInSeconds($agora)
                    );

                    if ($segundosDesdeUltimaComunicacao < self::INTERVALO_MINIMO_ENTRE_PONTOS_EM_SEGUNDOS) {
                        continue;
                    }
                }

                // O relogio define a posicao; cada indice desloca o inicio do circuito.
                // Seno/cosseno geram movimento ficticio, sem consultar um roteador viario.
                $progressoDoCircuito = ($agora->timestamp % self::DURACAO_DO_CIRCUITO_EM_SEGUNDOS)
                    / self::DURACAO_DO_CIRCUITO_EM_SEGUNDOS;
                $deslocamentoInicialDoDispositivo = $indice / count($centros);
                $fase = ($progressoDoCircuito + $deslocamentoInicialDoDispositivo) * 2 * M_PI;
                $dados = [
                    'latitude' => round($latitude + self::RAIO_DO_CIRCUITO_EM_GRAUS * sin($fase), 7),
                    'longitude' => round($longitude + self::RAIO_DO_CIRCUITO_EM_GRAUS * cos($fase), 7),
                    'velocidade' => self::VELOCIDADE_SIMULADA_EM_KM_POR_HORA,
                    'precisao_gps' => 8,
                    'bateria' => 85 - $indice * 3,
                ];
                // INSERT em localizacoes: preserva cada ponto para a tela de historico.
                Localizacao::create($dados + [
                    'dispositivo_id' => $dispositivo->id,
                    'registrado_em' => $agora,
                ]);
                // Limita a contagem a 10 segundos para uma pausa longa da simulacao
                // nao acrescentar ao hodometro horas em que nenhum ponto foi enviado.
                $segundos = $dispositivo->ultima_comunicacao
                    ? min(10, abs($dispositivo->ultima_comunicacao->diffInSeconds($agora))) : 0;
                $distanciaSimuladaEmQuilometros = self::VELOCIDADE_SIMULADA_EM_KM_POR_HORA * $segundos / 3600;

                // UPDATE em dispositivos: GET /api/dispositivos le esta posicao atual.
                // A API calcula status online/offline a partir de ultima_comunicacao.
                $dispositivo->update($dados + [
                    'ativo' => true,
                    'ultima_comunicacao' => $agora,
                    'quilometragem' => round((float) $dispositivo->quilometragem + $distanciaSimuladaEmQuilometros, 2),
                ]);
                $quantidade++;
            }
            return $quantidade;
        });
    }
}
