// A versão web serve para testar a interface. O token fica somente em memória
// durante a sessão da página, sem persistência em localStorage ou cookies.
let authToken: string | null = null;

export async function saveAuthToken(token: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('A sessão web só pode ser iniciada no navegador.');
  }

  authToken = token;
}

export async function readAuthToken(): Promise<string | null> {
  return typeof window === 'undefined' ? null : authToken;
}

export async function clearAuthToken(): Promise<void> {
  authToken = null;
}
