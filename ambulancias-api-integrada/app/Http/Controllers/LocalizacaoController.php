<?php

namespace App\Http\Controllers;

use App\Models\Dispositivo;
use App\Services\RegistrarLocalizacao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocalizacaoController extends Controller
{
    public function __construct(
        private readonly RegistrarLocalizacao $registrarLocalizacao,
    ) {
    }

    /**
     * Endpoint legado usado por um TABLET/APP provisionado com token próprio.
     *
     * Fluxo:
     * aplicativo -> POST /api/localizacoes + X-Device-Token -> este controller
     * -> RegistrarLocalizacao -> tabelas localizacoes/dispositivos -> painel web.
     */
    public function store(Request $request): JsonResponse
    {
        $token = $request->header('X-Device-Token');

        if (! $token) {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Token do dispositivo nao informado.',
                'como_corrigir' => 'Envie X-Device-Token: TOKEN_DO_TABLET.',
            ], 401);
        }

        $dispositivo = Dispositivo::query()
            ->where('token', hash('sha256', $token))
            ->where('ativo', true)
            ->first();

        if (! $dispositivo) {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Token do dispositivo invalido ou dispositivo inativo.',
            ], 401);
        }

        $dados = $this->validarDadosGps($request);
        $localizacao = $this->registrarLocalizacao->registrar($dispositivo, $dados);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Localizacao recebida e salva.',
            'dispositivo' => [
                'id' => $dispositivo->id,
                'nome' => $dispositivo->nome,
                'identificador' => $dispositivo->identificador,
            ],
            'localizacao' => $localizacao,
        ], 201);
    }

    public function index(Request $request, Dispositivo $dispositivo): JsonResponse
    {
        $usuario = $request->attributes->get('usuario_autenticado');

        if ($usuario->tipo !== 'admin' && $dispositivo->usuario_id !== $usuario->id) {
            return response()->json(['sucesso' => false, 'mensagem' => 'Acesso negado.'], 403);
        }

        $dados = $request->validate([
            'inicio' => ['nullable', 'date'],
            'fim' => ['nullable', 'date'],
            'limite' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $query = $dispositivo->localizacoes()->orderByDesc('registrado_em');

        if (! empty($dados['inicio'])) {
            $query->where('registrado_em', '>=', $dados['inicio']);
        }

        if (! empty($dados['fim'])) {
            $query->where('registrado_em', '<=', $dados['fim']);
        }

        $limite = $dados['limite'] ?? 100;

        return response()->json([
            'sucesso' => true,
            'dispositivo' => [
                'id' => $dispositivo->id,
                'nome' => $dispositivo->nome,
            ],
            'quantidade' => min($query->count(), $limite),
            'dados' => $query->limit($limite)->get(),
        ]);
    }

    /**
     * A validação fica aqui porque os dois endpoints de GPS aceitam o mesmo payload.
     *
     * @return array<string, mixed>
     */
    public static function regrasGps(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'velocidade' => ['nullable', 'numeric', 'min:0'],
            'precisao_gps' => ['nullable', 'numeric', 'min:0'],
            'bateria' => ['nullable', 'integer', 'between:0,100'],
            'quilometragem' => ['nullable', 'numeric', 'min:0'],
            'registrado_em' => ['nullable', 'date'],
        ];
    }

    /** @return array<string, mixed> */
    private function validarDadosGps(Request $request): array
    {
        return $request->validate(self::regrasGps());
    }
}
