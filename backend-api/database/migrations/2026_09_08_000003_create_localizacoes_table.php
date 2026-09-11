<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('localizacoes', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('dispositivo_id')
                ->constrained('dispositivos')
                ->cascadeOnDelete();

            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('velocidade', 8, 2)->nullable();
            $table->decimal('precisao_gps', 8, 2)->nullable();
            $table->smallInteger('bateria')->nullable();

            $table->timestampTz('registrado_em')->useCurrent();
            $table->timestampTz('created_at')->useCurrent();

            // Busca mais comum: historico de UM dispositivo por data.
            $table->index(['dispositivo_id', 'registrado_em']);
            $table->index('registrado_em');
        });

        DB::statement('ALTER TABLE localizacoes ADD CONSTRAINT localizacoes_latitude_check CHECK (latitude BETWEEN -90 AND 90)');
        DB::statement('ALTER TABLE localizacoes ADD CONSTRAINT localizacoes_longitude_check CHECK (longitude BETWEEN -180 AND 180)');
        DB::statement('ALTER TABLE localizacoes ADD CONSTRAINT localizacoes_velocidade_check CHECK (velocidade IS NULL OR velocidade >= 0)');
        DB::statement('ALTER TABLE localizacoes ADD CONSTRAINT localizacoes_precisao_check CHECK (precisao_gps IS NULL OR precisao_gps >= 0)');
        DB::statement('ALTER TABLE localizacoes ADD CONSTRAINT localizacoes_bateria_check CHECK (bateria IS NULL OR bateria BETWEEN 0 AND 100)');
    }

    public function down(): void
    {
        Schema::dropIfExists('localizacoes');
    }
};
