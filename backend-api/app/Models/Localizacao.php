<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Localizacao extends Model
{
    protected $table = 'localizacoes';

    // Essa tabela usa apenas created_at. Nao precisamos de updated_at,
    // pois um ponto de GPS gravado no historico nao deve ser alterado.
    public const UPDATED_AT = null;

    protected $fillable = [
        'dispositivo_id',
        'latitude',
        'longitude',
        'velocidade',
        'precisao_gps',
        'bateria',
        'registrado_em',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'velocidade' => 'decimal:2',
            'precisao_gps' => 'decimal:2',
            'registrado_em' => 'datetime',
        ];
    }

    public function dispositivo(): BelongsTo
    {
        return $this->belongsTo(Dispositivo::class, 'dispositivo_id');
    }
}
