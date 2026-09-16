<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('localizacoes', function (Blueprint $table) {
            $table->dropForeign(['dispositivo_id']);
            $table->foreign('dispositivo_id')
                ->references('id')
                ->on('dispositivos')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('localizacoes', function (Blueprint $table) {
            $table->dropForeign(['dispositivo_id']);
            $table->foreign('dispositivo_id')
                ->references('id')
                ->on('dispositivos')
                ->restrictOnDelete();
        });
    }
};
