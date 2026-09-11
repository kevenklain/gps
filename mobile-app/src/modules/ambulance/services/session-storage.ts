import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ambulancias.mobile.auth-token';

/**
 * O token Bearer é pequeno e sensível, então fica no SecureStore.
 * A tarefa de localização em segundo plano também lê esta mesma chave.
 */
export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function readAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
