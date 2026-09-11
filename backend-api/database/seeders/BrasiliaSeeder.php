<?php

namespace Database\Seeders;

use App\Services\SimulacaoBrasilia;
use Illuminate\Database\Seeder;

class BrasiliaSeeder extends Seeder
{
    public function run(): void
    {
        $quantidade = app(SimulacaoBrasilia::class)->atualizar();
        $this->command->info("{$quantidade} ambulancias de exemplo posicionadas em Brasilia/DF, com historico GPS.");
    }
}
