<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adapta os principios do ZIP postgresql-DB ao dominio de ambulancias.
 * O Laravel continua versionando o schema; nao executamos os SQLs de biblioteca.
 * PostgreSQL executa esta migration em transacao: falhas preservam o schema anterior.
 */
return new class extends Migration {
    public function up(): void
    {
        // O mapa do funcionario filtra por usuario_id. PostgreSQL nao cria
        // automaticamente um indice na coluna que referencia outra tabela.
        Schema::table('dispositivos', function (Blueprint $table) {
            $table->index('usuario_id', 'dispositivos_usuario_id_index');
        });

        // A API desativa dispositivos em vez de apagar o historico GPS.
        // RESTRICT aplica a mesma protecao a exclusoes feitas diretamente no pgAdmin.
        Schema::table('localizacoes', function (Blueprint $table) {
            $table->dropForeign(['dispositivo_id']);
            $table->foreign('dispositivo_id')->references('id')->on('dispositivos')->restrictOnDelete();
        });

        // Uma posicao atual pode estar ausente, mas nunca conter somente um eixo.
        DB::statement('ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_coordenadas_completas_check CHECK ((latitude IS NULL) = (longitude IS NULL))');

        // A API grava SHA-256 em hexadecimal. O banco tambem rejeita formatos invalidos.
        DB::statement("ALTER TABLE dispositivos ADD CONSTRAINT dispositivos_token_formato_check CHECK (token IS NULL OR token ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE usuarios ADD CONSTRAINT usuarios_token_formato_check CHECK (api_token IS NULL OR api_token ~ '^[0-9a-f]{64}$')");

        // Como na base recebida, cadastros sempre possuem datas de auditoria.
        // Eloquent continua atualizando updated_at; DEFAULT so atua no INSERT.
        // Nenhum horario existente e reescrito. Dados legados nulos impedem a migration.
        foreach (['usuarios', 'dispositivos'] as $tabela) {
            foreach (['created_at', 'updated_at'] as $coluna) {
                DB::statement("ALTER TABLE {$tabela} ALTER COLUMN {$coluna} SET DEFAULT CURRENT_TIMESTAMP");
                DB::statement("ALTER TABLE {$tabela} ALTER COLUMN {$coluna} SET NOT NULL");
            }
        }
    }

    public function down(): void
    {
        foreach (['usuarios', 'dispositivos'] as $tabela) {
            foreach (['created_at', 'updated_at'] as $coluna) {
                DB::statement("ALTER TABLE {$tabela} ALTER COLUMN {$coluna} DROP NOT NULL");
                DB::statement("ALTER TABLE {$tabela} ALTER COLUMN {$coluna} DROP DEFAULT");
            }
        }
        DB::statement('ALTER TABLE usuarios DROP CONSTRAINT usuarios_token_formato_check');
        DB::statement('ALTER TABLE dispositivos DROP CONSTRAINT dispositivos_token_formato_check');
        DB::statement('ALTER TABLE dispositivos DROP CONSTRAINT dispositivos_coordenadas_completas_check');

        Schema::table('localizacoes', function (Blueprint $table) {
            $table->dropForeign(['dispositivo_id']);
            $table->foreign('dispositivo_id')->references('id')->on('dispositivos')->cascadeOnDelete();
        });
        Schema::table('dispositivos', function (Blueprint $table) {
            $table->dropIndex('dispositivos_usuario_id_index');
        });
    }
};
