<?php

namespace Database\Seeders;

use App\Models\Usuario;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Usuario inicial de DESENVOLVIMENTO.
        // Configure ADMIN_EMAIL e ADMIN_PASSWORD no .env.
        Usuario::updateOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@ambulancias.local')],
            [
                'nome' => env('ADMIN_NOME', 'Administrador'),
                'senha' => Hash::make(env('ADMIN_PASSWORD', 'admin123')),
                'tipo' => 'admin',
                'ativo' => true,
            ]
        );
    }
}
