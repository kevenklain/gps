<?php

namespace App\Http\Controllers;

use App\Models\Dispositivo;
use App\Services\RegistrarLocalizacao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Endpoints exclusivos do aplicativo Expo do motorista.
 *
 * O motorista autentica com o mesmo usuário já cadastrado no painel web.
 * Depois disso, o Bearer token identifica o usuário e o backend descobre qual
 * ambulância está vinculada a ele. O aplicativo não precisa armazenar o token
 * administrativo do dispositivo.
 */
class MobileController extends Controller
{
    public function __construct(
        private readonly RegistrarLocalizacao $registrarLocalizacao,
    ) {
    }

    /**
     * Retorna os dados mínimos que a tela principal do aplicativo precisa.
     */
    public function contexto(Request $request): JsonResponse
    {
        $usuario = $request->attributes->get('usuario_autenticado');

        if ($usuario->tipo !== 'funcionario') {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'O aplicativo movel e destinado aos funcionarios/motoristas.',
            ], 403);
        }

        $dispositivo = $this->buscarDispositivoDoMotorista($usuario->id);

        if (! $dispositivo) {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Nenhuma ambulancia ativa esta vinculada a este motorista.',
            ], 422);
        }

        return response()->json([
            'sucesso' => true,
            'usuario' => $usuario,
            'ambulancia' => $dispositivo,
        ]);
    }

    /**
     * Recebe o GPS do Expo usando o Bearer token do motorista.
     *
     * Fluxo completo:
     * tarefa de localização Expo -> POST /api/mobile/localizacoes -> middleware
     * usuario.token -> MobileController -> RegistrarLocalizacao -> PostgreSQL.
     */
    public function localizacao(Request $request): JsonResponse
    {
        $usuario = $request->attributes->get('usuario_autenticado');

        if ($usuario->tipo !== 'funcionario') {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Apenas funcionarios podem enviar localizacao pelo aplicativo.',
            ], 403);
        }

        $dispositivo = $this->buscarDispositivoDoMotorista($usuario->id);

        if (! $dispositivo) {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Nenhuma ambulancia ativa esta vinculada a este motorista.',
            ], 422);
        }

        $dados = $request->validate(LocalizacaoController::regrasGps());
        $localizacao = $this->registrarLocalizacao->registrar($dispositivo, $dados);

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Localizacao do aplicativo recebida.',
            'ambulancia' => $dispositivo->fresh(),
            'localizacao' => $localizacao,
        ], 201);
    }

    /**
     * Confirma a identidade antes de permitir que o aplicativo encerre a sessão.
     * O endpoint não encerra a sessão; ele apenas valida novamente acesso e senha.
     * Depois da confirmação, o app chama POST /api/logout.
     */
    public function confirmarSaida(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'acesso' => ['required', 'string', 'max:150'],
            'senha' => ['required', 'string'],
        ]);

        $usuario = $request->attributes->get('usuario_autenticado');
        $acessoInformado = mb_strtolower(trim($dados['acesso']));
        $emailAtual = mb_strtolower(trim($usuario->email));

        $credenciaisCorretas = $acessoInformado === $emailAtual
            && Hash::check($dados['senha'], $usuario->senha);

        if (! $credenciaisCorretas) {
            return response()->json([
                'sucesso' => false,
                'mensagem' => 'Acesso ou senha incorretos. A sessao continua ativa.',
            ], 401);
        }

        return response()->json([
            'sucesso' => true,
            'mensagem' => 'Identidade confirmada. O aplicativo pode encerrar a sessao.',
        ]);
    }

    private function buscarDispositivoDoMotorista(int $usuarioId): ?Dispositivo
    {
        return Dispositivo::query()
            ->where('usuario_id', $usuarioId)
            ->where('ativo', true)
            ->orderBy('id')
            ->first();
    }
}
