import { Platform } from 'react-native';
import type { ApiErrorPayload, MobileContext } from '../types';

function getApiBaseUrl(): string {
  // A tela chama este cliente HTTP antes de autenticar no Laravel.
  // Na web local, acompanha o host do navegador: localhost no computador
  // ou o IP da rede quando a página é aberta em outro aparelho.
  // No Android/iOS, usa o IP configurado para alcançar o computador da API.
  const mobileApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const webApiUrl = process.env.EXPO_PUBLIC_WEB_API_URL?.trim();
  let configured = mobileApiUrl;

  if (Platform.OS === 'web') {
    if (webApiUrl) {
      configured = webApiUrl;
    } else if (typeof window !== 'undefined') {
      const browserHostname = window.location.hostname;
      configured = `${window.location.protocol}//${browserHostname}:8000`;
    }
  }

  if (!configured) {
    throw new Error(
      'EXPO_PUBLIC_API_URL não foi configurada. Copie .env.example para .env e informe o endereço da API.',
    );
  }

  return configured.replace(/\/$/, '');
}

async function parseJson(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

function buildErrorMessage(payload: ApiErrorPayload | null, fallback: string): string {
  if (payload?.mensagem) {
    return payload.mensagem;
  }

  if (payload?.message) {
    return payload.message;
  }

  const firstValidationError = payload?.errors
    ? Object.values(payload.errors).flat()[0]
    : undefined;

  return firstValidationError ?? fallback;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique a rede e o endereço do servidor.');
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(buildErrorMessage(payload, `Erro HTTP ${response.status}.`));
  }

  return payload as T;
}

type LoginResponse = {
  sucesso: boolean;
  token: string;
};

export async function loginApi(acesso: string, senha: string): Promise<string> {
  // A API atual usa e-mail como acesso. A tela chama o campo de "Acesso"
  // para manter a nomenclatura desejada no aplicativo.
  const response = await request<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: acesso.trim(), senha }),
  });

  return response.token;
}

export async function fetchMobileContext(token: string): Promise<MobileContext> {
  const response = await request<{
    sucesso: boolean;
    usuario: MobileContext['usuario'];
    ambulancia: MobileContext['ambulancia'];
  }>('/api/mobile/contexto', { token });

  return {
    usuario: response.usuario,
    ambulancia: response.ambulancia,
  };
}

export type LocationPayload = {
  latitude: number;
  longitude: number;
  velocidade?: number | null;
  precisao_gps?: number | null;
  bateria?: number | null;
  registrado_em?: string;
};

export async function sendLocationApi(
  token: string,
  location: LocationPayload,
): Promise<void> {
  await request('/api/mobile/localizacoes', {
    method: 'POST',
    token,
    body: JSON.stringify(location),
  });
}

export async function confirmExitApi(
  token: string,
  acesso: string,
  senha: string,
): Promise<void> {
  await request('/api/mobile/confirmar-saida', {
    method: 'POST',
    token,
    body: JSON.stringify({ acesso: acesso.trim(), senha }),
  });
}

export async function logoutApi(token: string): Promise<void> {
  await request('/api/logout', {
    method: 'POST',
    token,
  });
}
