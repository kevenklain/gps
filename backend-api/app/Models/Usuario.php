<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Usuario extends Model
{
    protected $table = 'usuarios';

    protected $fillable = [
        'nome',
        'email',
        'senha',
        'tipo',
        'ativo',
        'api_token',
    ];

    // Nunca devolvemos senha ou hash do token em JSON.
    protected $hidden = [
        'senha',
        'api_token',
    ];

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
        ];
    }

    public function dispositivos(): HasMany
    {
        return $this->hasMany(Dispositivo::class, 'usuario_id');
    }
}
