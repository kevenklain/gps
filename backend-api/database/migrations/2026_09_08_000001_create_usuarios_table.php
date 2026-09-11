<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('usuarios', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('nome', 150);
            $table->string('email', 150)->unique();
            $table->string('senha', 255);
            $table->string('tipo', 20);
            $table->boolean('ativo')->default(true);

            // Guarda SHA-256 do token retornado no login.
            $table->string('api_token', 64)->nullable()->unique();

            $table->timestampsTz();
            $table->index('tipo');
            $table->index('ativo');
        });

        DB::statement("ALTER TABLE usuarios ADD CONSTRAINT usuarios_tipo_check CHECK (tipo IN ('admin', 'funcionario'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('usuarios');
    }
};
