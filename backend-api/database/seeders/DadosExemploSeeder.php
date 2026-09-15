<?php

namespace Database\Seeders;

use App\Models\Dispositivo;
use App\Models\Localizacao;
use App\Models\Usuario;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DadosExemploSeeder extends Seeder
{
    private const TOTAL = 100;
    private const PONTOS_HISTORICO = 10;

    public function run(): void
    {
        $primeirosNomes = [
            'Ana', 'Bruno', 'Carla', 'Diego', 'Elisa',
            'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'Joao',
            'Larissa', 'Marcos', 'Natalia', 'Otavio', 'Patricia',
            'Rafael', 'Sabrina', 'Thiago', 'Vanessa', 'William',
        ];

        $sobrenomes = [
            'Silva', 'Santos', 'Oliveira', 'Souza', 'Costa',
            'Almeida', 'Lima', 'Pereira', 'Rodrigues', 'Martins',
        ];

        $modelos = [
            'Mercedes-Benz Sprinter',
            'Renault Master',
            'Fiat Ducato',
            'Ford Transit',
            'Toyota Hilux',
            'Chevrolet S10',
            'Volkswagen Saveiro',
            'Iveco Daily',
        ];

        $usuariosCriados = 0;
        $usuariosAtualizados = 0;
        $dispositivosCriados = 0;
        $dispositivosAtualizados = 0;
        $localizacoesCriadas = 0;

        DB::transaction(function () use (
            $primeirosNomes,
            $sobrenomes,
            $modelos,
            &$usuariosCriados,
            &$usuariosAtualizados,
            &$dispositivosCriados,
            &$dispositivosAtualizados,
            &$localizacoesCriadas
        ) {
            for ($indice = 0; $indice < self::TOTAL; $indice++) {
                $sequencia = $indice + 1;
                $numero = str_pad((string) $sequencia, 2, '0', STR_PAD_LEFT);
                $nome = $primeirosNomes[$indice % count($primeirosNomes)]
                    . ' '
                    . $sobrenomes[$indice % count($sobrenomes)];

                // Mantem compatibilidade com os 10 registros antigos do seeder:
                // usuario01..usuario10 e DEMO-TABLET-01..10 sao reaproveitados.
                $usuario = Usuario::firstOrCreate(
                    ['email' => "usuario{$numero}@ambulancias.local"],
                    [
                        'nome' => $nome . ' (Exemplo)',
                        'senha' => Hash::make('Teste123!'),
                        'tipo' => 'funcionario',
                        'ativo' => true,
                    ]
                );

                if ($usuario->wasRecentlyCreated) {
                    $usuariosCriados++;
                } else {
                    $usuario->fill([
                        'nome' => $nome . ' (Exemplo)',
                        'tipo' => 'funcionario',
                        'ativo' => true,
                    ])->save();
                    $usuariosAtualizados++;
                }

                // Espalha os 100 veiculos em aneis ao redor de Sobradinho/DF,
                // deixando o mapa carregado o suficiente para testar a interface.
                $angulo = (2 * pi() * $indice) / self::TOTAL;
                $raio = 0.012 + (($indice % 10) * 0.0015);
                $latitude = -15.6500 + (cos($angulo) * $raio);
                $longitude = -47.7900 + (sin($angulo) * $raio);

                // Cria grupos distintos para testar os quatro estados visuais.
                // Online/sem comunicacao mudam naturalmente com o passar dos
                // segundos, pois o status do sistema depende da ultima comunicacao.
                $grupoStatus = $indice % 4;
                $ativo = $grupoStatus !== 3;
                $ultimaComunicacao = match ($grupoStatus) {
                    0 => now(),
                    1 => now()->subSeconds(10),
                    2 => now()->subMinutes(5),
                    3 => now(),
                };

                $identificador = "DEMO-TABLET-{$numero}";
                $dispositivo = Dispositivo::firstOrCreate(
                    ['identificador' => $identificador],
                    [
                        'usuario_id' => $usuario->id,
                        'nome' => "Ambulancia Exemplo {$numero}",
                        'placa' => 'TST' . str_pad((string) $sequencia, 4, '0', STR_PAD_LEFT),
                        'modelo_veiculo' => $modelos[$indice % count($modelos)],
                        'quilometragem' => 10000 + ($indice * 725),
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'velocidade' => $ativo ? (($sequencia * 7) % 91) : 0,
                        'precisao_gps' => 5 + ($indice % 10),
                        'bateria' => 20 + ($indice % 81),
                        'ultima_comunicacao' => $ultimaComunicacao,
                        'token' => hash('sha256', Str::random(80)),
                        'ativo' => $ativo,
                    ]
                );

                if ($dispositivo->wasRecentlyCreated) {
                    $dispositivosCriados++;
                } else {
                    // Preserva o token existente para nao invalidar um tablet de
                    // teste que ja tenha sido vinculado ao dispositivo.
                    $dispositivo->fill([
                        'usuario_id' => $usuario->id,
                        'nome' => "Ambulancia Exemplo {$numero}",
                        'placa' => 'TST' . str_pad((string) $sequencia, 4, '0', STR_PAD_LEFT),
                        'modelo_veiculo' => $modelos[$indice % count($modelos)],
                        'quilometragem' => 10000 + ($indice * 725),
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'velocidade' => $ativo ? (($sequencia * 7) % 91) : 0,
                        'precisao_gps' => 5 + ($indice % 10),
                        'bateria' => 20 + ($indice % 81),
                        'ultima_comunicacao' => $ultimaComunicacao,
                        'ativo' => $ativo,
                    ])->save();
                    $dispositivosAtualizados++;
                }

                // O historico desses dispositivos e exclusivamente de demonstracao.
                // Reexecutar o seeder recria os 10 pontos, evitando duplicacao.
                Localizacao::where('dispositivo_id', $dispositivo->id)->delete();

                for ($ponto = self::PONTOS_HISTORICO - 1; $ponto >= 0; $ponto--) {
                    $deslocamento = $ponto * 0.00008;

                    Localizacao::create([
                        'dispositivo_id' => $dispositivo->id,
                        'latitude' => $latitude + ($deslocamento * cos($angulo)),
                        'longitude' => $longitude + ($deslocamento * sin($angulo)),
                        'velocidade' => $ativo ? (($sequencia * 7 + $ponto * 3) % 91) : 0,
                        'precisao_gps' => 5 + (($indice + $ponto) % 10),
                        'bateria' => max(5, (20 + ($indice % 81)) - $ponto),
                        'registrado_em' => now()->subMinutes($ponto * 5),
                    ]);

                    $localizacoesCriadas++;
                }
            }
        });

        $this->command->info('Massa de teste concluida.');
        $this->command->info("Usuarios: {$usuariosCriados} criados, {$usuariosAtualizados} atualizados.");
        $this->command->info("Veiculos: {$dispositivosCriados} criados, {$dispositivosAtualizados} atualizados.");
        $this->command->info("Pontos GPS criados: {$localizacoesCriadas}.");
        $this->command->info('Usuarios: usuario01@ambulancias.local ate usuario100@ambulancias.local.');
        $this->command->info('Senha inicial dos novos usuarios: Teste123!');
    }
}
