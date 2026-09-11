<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Executa SQL direto, como o pgAdmin, para provar que a integridade nao depende
 * somente da validacao HTTP. Savepoints recuperam a transacao apos erros esperados.
 */
function deveRejeitar(string $sql, array $parametros, string $sqlStateEsperado): void
{
    DB::statement('SAVEPOINT validacao_banco');
    try {
        DB::statement($sql, $parametros);
    } catch (QueryException $erro) {
        DB::statement('ROLLBACK TO SAVEPOINT validacao_banco');
        if (($erro->errorInfo[0] ?? null) !== $sqlStateEsperado) {
            throw $erro;
        }
        return;
    }
    throw new RuntimeException('O banco aceitou uma operacao que deveria rejeitar.');
}

DB::beginTransaction();
try {
    $usuarioId = DB::table('usuarios')->insertGetId([
        'nome' => 'Verificacao transacional',
        'email' => 'verificacao-'.bin2hex(random_bytes(8)).'@example.com',
        'senha' => password_hash('SenhaSomenteTeste', PASSWORD_BCRYPT),
        'tipo' => 'funcionario',
    ]);
    $usuario = DB::table('usuarios')->find($usuarioId);
    if (! $usuario->created_at || ! $usuario->updated_at) {
        throw new RuntimeException('Datas padrao nao preenchidas.');
    }
    $dispositivoId = DB::table('dispositivos')->insertGetId([
        'usuario_id' => $usuarioId,
        'nome' => 'Dispositivo de verificacao',
        'identificador' => 'VERIFICACAO-'.bin2hex(random_bytes(8)),
        'latitude' => -15.79,
        'longitude' => -47.88,
    ]);
    DB::table('localizacoes')->insert([
        'dispositivo_id' => $dispositivoId, 'latitude' => -15.79, 'longitude' => -47.88,
    ]);
    deveRejeitar('DELETE FROM dispositivos WHERE id = ?', [$dispositivoId], '23503');
    deveRejeitar('UPDATE dispositivos SET longitude = NULL WHERE id = ?', [$dispositivoId], '23514');
    deveRejeitar("UPDATE dispositivos SET token = 'invalido' WHERE id = ?", [$dispositivoId], '23514');
    deveRejeitar("UPDATE usuarios SET api_token = 'invalido' WHERE id = ?", [$usuarioId], '23514');
    deveRejeitar('UPDATE usuarios SET created_at = NULL WHERE id = ?', [$usuarioId], '23502');
    deveRejeitar('UPDATE dispositivos SET bateria = 101 WHERE id = ?', [$dispositivoId], '23514');
    $indice = DB::selectOne("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'dispositivos_usuario_id_index'");
    if (! $indice) throw new RuntimeException('Indice de usuario ausente.');
    echo "OK: datas, FK do historico, coordenadas, hashes, bateria e indice de relacionamento.\n";
} finally {
    // Linhas de teste sao revertidas. Sequencias podem avancar, como e normal no PostgreSQL.
    DB::rollBack();
}
