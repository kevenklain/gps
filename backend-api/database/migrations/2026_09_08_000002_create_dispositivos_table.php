<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('dispositivos', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('usuario_id')
                ->nullable()
                ->constrained('usuarios')
                ->nullOnDelete();

            $table->string('nome', 100);
            $table->string('identificador', 100)->unique();
            $table->string('placa', 20)->nullable();
            $table->string('modelo_veiculo', 100)->nullable();

            $table->decimal('quilometragem', 12, 2)->default(0);

            // Ultima posicao recebida: usada pelo painel em tempo real.
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('velocidade', 8, 2)->nullable();
            $table->decimal('precisao_gps', 8, 2)->nullable();
            $table->smallInteger('bateria')->nullable();
            $table->timestampTz('ultima_comunicacao')->nullable();

            // SHA-256 do token do tablet.
            $table->string('token', 64)->nullable()->unique();
            $table->boolean('ativo')->default(true);

            $table->timestampsTz();

            $table->index('ativo');
            $table->index('ultima_comunicacao');
        });

        DB::statement('ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_quilometragem_check CHECK (quilometragem >= 0)');
        DB::statement('ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90)');
        DB::statement('ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)');
        DB::statement('ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_velocidade_check CHECK (velocidade IS NULL OR velocidade >= 0)');
        DB::statement('ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_precisao_check CHECK (precisao_gps IS NULL OR precisao_gps >= 0)');
        DB::statement('ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_bateria_check CHECK (bateria IS NULL OR bateria BETWEEN 0 AND 100)');
    }

    public function down(): void
    {
        Schema::dropIfExists('dispositivos');
    }
};
