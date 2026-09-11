<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dispositivo extends Model
{
    protected $table = 'dispositivos';

    protected $fillable = [
        'usuario_id',
        'nome',
        'identificador',
        'placa',
        'modelo_veiculo',
        'quilometragem',
        'latitude',
        'longitude',
        'velocidade',
        'precisao_gps',
        'bateria',
        'ultima_comunicacao',
        'token',
        'ativo',
    ];

    protected $hidden = ['token'];

    // status nao existe fisicamente no banco.
    // Ele e calculado pela ultima comunicacao recebida do tablet.
    protected $appends = ['status'];

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'quilometragem' => 'decimal:2',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'velocidade' => 'decimal:2',
            'precisao_gps' => 'decimal:2',
            'ultima_comunicacao' => 'datetime',
        ];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function localizacoes(): HasMany
    {
        return $this->hasMany(Localizacao::class, 'dispositivo_id');
    }

    public function getStatusAttribute(): string
    {
        if (! $this->ativo) {
            return 'inativo';
        }

        if (! $this->ultima_comunicacao) {
            return 'offline';
        }

        $segundos = Carbon::parse($this->ultima_comunicacao)->diffInSeconds(now());

        if ($segundos <= 30) {
            return 'online';
        }

        if ($segundos <= 60) {
            return 'sem_comunicacao';
        }

        return 'offline';
    }
}
