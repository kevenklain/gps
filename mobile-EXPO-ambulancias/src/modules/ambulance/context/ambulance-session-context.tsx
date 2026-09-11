import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { MobileContext } from '../types';
import {
  confirmExitApi,
  fetchMobileContext,
  loginApi,
  logoutApi,
} from '../services/ambulance-api';
import {
  clearAuthToken,
  readAuthToken,
  saveAuthToken,
} from '../services/session-storage';
import {
  requestTrackingPermissions,
  sendCurrentLocationNow,
  startLocationTracking,
  stopLocationTracking,
  type TrackingPermissionState,
} from '../services/location-tracking';

type SessionStatus = 'loading' | 'guest' | 'authenticated';

type LoginResult = {
  trackingPermission: TrackingPermissionState;
};

type AmbulanceSessionValue = {
  status: SessionStatus;
  context: MobileContext | null;
  trackingPermission: TrackingPermissionState | null;
  login: (acesso: string, senha: string) => Promise<LoginResult>;
  refresh: () => Promise<void>;
  protectedLogout: (acesso: string, senha: string) => Promise<void>;
};

const AmbulanceSessionContext = createContext<AmbulanceSessionValue | null>(null);

export function AmbulanceSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [context, setContext] = useState<MobileContext | null>(null);
  const [trackingPermission, setTrackingPermission] =
    useState<TrackingPermissionState | null>(null);

  const restoreSession = useCallback(async () => {
    try {
      const token = await readAuthToken();

      if (!token) {
        setContext(null);
        setStatus('guest');
        return;
      }

      const restoredContext = await fetchMobileContext(token);
      setContext(restoredContext);
      setStatus('authenticated');

      // Se a tarefa já estava registrada pelo Android, este método apenas retorna.
      // Não pedimos nova permissão silenciosamente na restauração da sessão.
      try {
        await startLocationTracking();
      } catch {
        // A tela principal continuará disponível e explicará quando o rastreamento
        // precisar de uma development build ou de nova autorização do sistema.
      }
    } catch {
      try {
        await clearAuthToken();
      } catch {
        // Uma falha no armazenamento não deve impedir a tela de login.
      }
      setContext(null);
      setStatus('guest');
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (acesso: string, senha: string): Promise<LoginResult> => {
    const token = await loginApi(acesso, senha);

    // Primeiro confirmamos que o usuário realmente possui uma ambulância vinculada.
    // Falhas nesta etapa invalidam o login do aplicativo móvel.
    let mobileContext: MobileContext;

    try {
      mobileContext = await fetchMobileContext(token);
      await saveAuthToken(token);
    } catch (error) {
      await clearAuthToken();
      setContext(null);
      setStatus('guest');
      throw error;
    }

    setContext(mobileContext);
    setStatus('authenticated');

    // Permissão/GPS é uma segunda etapa. Se o aparelho estiver no Expo Go, se o
    // motorista negar o background ou se a rede falhar no primeiro ponto, a sessão
    // continua aberta para que a tela explique o que precisa ser corrigido.
    let permission: TrackingPermissionState = 'unsupported';

    try {
      permission = await requestTrackingPermissions();
      setTrackingPermission(permission);

      if (permission === 'granted') {
        await startLocationTracking();
      }

      if (permission === 'granted' || permission === 'foreground_only') {
        try {
          await sendCurrentLocationNow();
          const refreshed = await fetchMobileContext(token);
          setContext(refreshed);
        } catch {
          // A transmissão seguinte tentará novamente. Não encerramos a sessão por isso.
        }
      }
    } catch {
      permission = 'unsupported';
      setTrackingPermission('unsupported');
    }

    return { trackingPermission: permission };
  }, []);

  const refresh = useCallback(async () => {
    const token = await readAuthToken();

    if (!token) {
      setContext(null);
      setStatus('guest');
      return;
    }

    try {
      const updated = await fetchMobileContext(token);
      setContext(updated);
    } catch {
      // Uma falha de rede pontual não deve derrubar a sessão nem parar o GPS.
    }
  }, []);

  const protectedLogout = useCallback(async (acesso: string, senha: string) => {
    const token = await readAuthToken();

    if (!token) {
      await clearAuthToken();
      setContext(null);
      setStatus('guest');
      return;
    }

    // 1. confirma novamente as credenciais;
    // 2. invalida o token no backend;
    // 3. só então interrompe o GPS e apaga o token local.
    await confirmExitApi(token, acesso, senha);
    await logoutApi(token);
    await stopLocationTracking();
    await clearAuthToken();

    setTrackingPermission(null);
    setContext(null);
    setStatus('guest');
  }, []);

  const value = useMemo<AmbulanceSessionValue>(
    () => ({
      status,
      context,
      trackingPermission,
      login,
      refresh,
      protectedLogout,
    }),
    [status, context, trackingPermission, login, refresh, protectedLogout],
  );

  return (
    <AmbulanceSessionContext.Provider value={value}>
      {children}
    </AmbulanceSessionContext.Provider>
  );
}

export function useAmbulanceSession(): AmbulanceSessionValue {
  const value = useContext(AmbulanceSessionContext);

  if (!value) {
    throw new Error('useAmbulanceSession precisa estar dentro de AmbulanceSessionProvider.');
  }

  return value;
}
