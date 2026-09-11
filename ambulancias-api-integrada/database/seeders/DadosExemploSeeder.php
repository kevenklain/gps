<?php

namespace Database\Seeders;

use App\Models\Dispositivo;
use App\Models\Usuario;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DadosExemploSeeder extends Seeder
{
    public function run(): void
    {
        $nomes = [
            'Ana Silva', 'Bruno Santos', 'Carla Oliveira', 'Diego Souza',
            'Elisa Costa', 'Felipe Almeida', 'Gabriela Lima', 'Henrique Pereira',
            'Isabela Rodrigues', 'Joao Martins',
        ];
        $modelos = ['Mercedes-Benz Sprinter', 'Renault Master', 'Fiat Ducato'];
        $usuariosCriados = 0;
        $dispositivosCriados = 0;

        DB::transaction(function () use ($nomes, $modelos, &$usuariosCriados, &$dispositivosCriados) {
            foreach ($nomes as $indice => $nome) {
                $numero = str_pad((string) ($indice + 1), 2, '0', STR_PAD_LEFT);
                // Reexecutar preserva cadastros, senhas e tokens ja existentes.
                $usuario = Usuario::firstOrCreate(
                    ['email' => "usuario{$numero}@ambulancias.local"],
                    [
                        'nome' => $nome . ' (Exemplo)',
                        'senha' => Hash::make('Teste123!'),
                        'tipo' => 'funcionario',
                        'ativo' => true,
                    ]
                );
                $usuariosCriados += (int) $usuario->wasRecentlyCreated;

                $dispositivo = Dispositivo::firstOrCreate(
                    ['identificador' => "DEMO-TABLET-{$numero}"],
                    [
                        'usuario_id' => $usuario->id,
                        'nome' => "Ambulancia Exemplo {$numero}",
                        'placa' => "DEMO-{$numero}",
                        'modelo_veiculo' => $modelos[$indice % count($modelos)],
                        'quilometragem' => 10000 + ($indice * 3500),
                        'token' => hash('sha256', Str::random(80)),
                        'ativo' => true,
                    ]
                );
                $dispositivosCriados += (int) $dispositivo->wasRecentlyCreated;
            }
        });

        $this->command->info("Criados: {$usuariosCriados} usuarios e {$dispositivosCriados} dispositivos.");
        $this->command->info('Usuarios: usuario01@ambulancias.local ate usuario10@ambulancias.local. Senha inicial: Teste123!');
        $this->command->info('Para usar o simulador GPS, gere o token do dispositivo pelo painel.');
    }
}
