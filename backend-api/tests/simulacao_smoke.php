<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Dispositivo;
use App\Models\Localizacao;
use App\Services\SimulacaoBrasilia;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function verificar(bool $condicao, string $mensagem): void {
    if (! $condicao) throw new RuntimeException($mensagem);
}

DB::beginTransaction();
try {
    Carbon::setTestNow(now()->addSeconds(10));
    $simulacao = app(SimulacaoBrasilia::class);
    $antes = Localizacao::count();
    verificar($simulacao->atualizar() === 10, 'Esperados 10 dispositivos de exemplo.');
    $primeiro = Dispositivo::where('identificador', 'DEMO-TABLET-01')->firstOrFail();
    verificar($primeiro->status === 'online', 'GPS novo deve ficar online.');
    verificar($simulacao->atualizar() === 0, 'Atualizacao repetida deve ser ignorada.');
    Carbon::setTestNow(now()->addSeconds(5));
    verificar($simulacao->atualizar() === 10, 'Segundo passo deve atualizar os 10.');
    $depois = $primeiro->fresh();
    verificar($primeiro->latitude !== $depois->latitude, 'A ambulancia deve se mover.');
    verificar((float) $depois->quilometragem > (float) $primeiro->quilometragem, 'KM deve aumentar.');
    verificar(Localizacao::count() === $antes + 20, 'Cada passo deve gravar 10 pontos.');
    foreach (Dispositivo::where('identificador', 'like', 'DEMO-TABLET-%')->get() as $dispositivo) {
        verificar($dispositivo->latitude > -15.9 && $dispositivo->latitude < -15.7, 'Latitude fora de Brasilia.');
        verificar($dispositivo->longitude > -48 && $dispositivo->longitude < -47.8, 'Longitude fora de Brasilia.');
    }
    echo "OK: 10 posicoes, movimento, status online, quilometragem, historico e protecao contra duplicacao.\n";
} finally {
    Carbon::setTestNow();
    DB::rollBack();
}
