<?php

namespace App\Services;

use App\Models\Dispositivo;
use App\Models\Localizacao;
use Illuminate\Support\Facades\DB;

class SimulacaoBrasilia
{
    private const DURACAO_DO_CIRCUITO_EM_SEGUNDOS = 420;
    private const INTERVALO_MINIMO_ENTRE_PONTOS_EM_SEGUNDOS = 4;

    /**
     * Atualiza somente dispositivos de demonstracao/teste.
     * Veiculos reais nunca sao movimentados por esta funcionalidade.
     */
    public function atualizar(): int
    {
        return DB::transaction(function () {
            $dispositivos = Dispositivo::query()
                ->where(function ($query) {
                    $query->where('identificador', 'like', 'DEMO-TABLET-%')
                        ->orWhere('identificador', 'like', 'TESTE-TABLET-%');
                })
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $quantidade = 0;
            $agora = now();
            $progresso = ($agora->timestamp % self::DURACAO_DO_CIRCUITO_EM_SEGUNDOS)
                / self::DURACAO_DO_CIRCUITO_EM_SEGUNDOS;

            foreach ($dispositivos as $indiceColecao => $dispositivo) {
                // Mantem veiculos marcados como inativos fora da simulacao.
                if (! $dispositivo->ativo) {
                    continue;
                }

                if ($dispositivo->ultima_comunicacao) {
                    $segundosDesdeUltimaComunicacao = abs(
                        $dispositivo->ultima_comunicacao->diffInSeconds($agora)
                    );

                    if ($segundosDesdeUltimaComunicacao < self::INTERVALO_MINIMO_ENTRE_PONTOS_EM_SEGUNDOS) {
                        continue;
                    }
                }

                $numero = $this->numeroDoDispositivo($dispositivo->identificador, $indiceColecao + 1);
                [$centroLatitude, $centroLongitude] = $this->centroDoCircuito(
                    $dispositivo->identificador,
                    $numero
                );

                // Cada veiculo entra no circuito em uma fase diferente para a frota
                // nao se mover como um unico bloco. O segundo harmonico deixa o
                // trajeto menos circular e mais parecido com deslocamentos urbanos.
                $fase = ($progresso * 2 * M_PI) + (($numero % 20) / 20 * 2 * M_PI);
                $raioLatitude = 0.0018 + (($numero % 5) * 0.00012);
                $raioLongitude = 0.0028 + (($numero % 7) * 0.00014);

                $latitude = $centroLatitude
                    + ($raioLatitude * sin($fase))
                    + (0.00045 * sin($fase * 2));
                $longitude = $centroLongitude
                    + ($raioLongitude * cos($fase))
                    + (0.00035 * cos(($fase * 2) + 0.8));

                $velocidade = 24 + (($numero * 7) % 38);
                $bateria = max(18, 96 - ($numero % 23) * 3);
                $precisao = 5 + ($numero % 6);

                $dados = [
                    'latitude' => round($latitude, 7),
                    'longitude' => round($longitude, 7),
                    'velocidade' => $velocidade,
                    'precisao_gps' => $precisao,
                    'bateria' => $bateria,
                ];

                Localizacao::create($dados + [
                    'dispositivo_id' => $dispositivo->id,
                    'registrado_em' => $agora,
                ]);

                $segundos = $dispositivo->ultima_comunicacao
                    ? min(10, abs($dispositivo->ultima_comunicacao->diffInSeconds($agora)))
                    : 0;
                $distanciaSimulada = $velocidade * $segundos / 3600;

                $dispositivo->update($dados + [
                    'ultima_comunicacao' => $agora,
                    'quilometragem' => round(
                        (float) $dispositivo->quilometragem + $distanciaSimulada,
                        2
                    ),
                ]);

                $quantidade++;
            }

            return $quantidade;
        });
    }

    private function numeroDoDispositivo(string $identificador, int $fallback): int
    {
        if (preg_match('/(\d+)$/', $identificador, $matches)) {
            return max(1, (int) $matches[1]);
        }

        return max(1, $fallback);
    }

    /**
     * A massa TESTE-TABLET-001..100 e espalhada por uma grade na regiao de
     * Sobradinho/DF. Os DEMO-TABLET continuam na regiao central de Brasilia.
     */
    private function centroDoCircuito(string $identificador, int $numero): array
    {
        if (str_starts_with($identificador, 'TESTE-TABLET-')) {
            $indice = max(0, $numero - 1);
            $linha = intdiv($indice, 10);
            $coluna = $indice % 10;

            return [
                -15.6500 + (($linha - 4.5) * 0.0062),
                -47.7900 + (($coluna - 4.5) * 0.0074),
            ];
        }

        $centrosBrasilia = [
            [-15.7942, -47.8822],
            [-15.8070, -47.8900],
            [-15.8200, -47.9100],
            [-15.8350, -47.9250],
            [-15.7800, -47.8900],
            [-15.7600, -47.8800],
            [-15.7450, -47.8950],
            [-15.7900, -47.9250],
            [-15.8050, -47.9450],
            [-15.8250, -47.9550],
        ];

        return $centrosBrasilia[($numero - 1) % count($centrosBrasilia)];
    }
}
