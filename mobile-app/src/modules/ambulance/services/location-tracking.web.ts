import { sendLocationApi } from './ambulance-api';
import { readAuthToken } from './session-storage';

export type TrackingPermissionState = 'granted' | 'foreground_only' | 'denied' | 'unsupported';

let timer: ReturnType<typeof setInterval> | null = null;
let pending: Promise<void> | null = null;
let generation = 0;

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    });
  });
}

export async function requestTrackingPermissions(): Promise<TrackingPermissionState> {
  if (!globalThis.isSecureContext || !navigator.geolocation) return 'unsupported';
  try {
    await getPosition();
    return 'foreground_only';
  } catch (error) {
    // A demora do GPS não significa que a permissão foi negada.
    return (error as GeolocationPositionError).code === 1 ? 'denied' : 'foreground_only';
  }
}

export async function sendCurrentLocationNow(): Promise<void> {
  if (pending) return pending;
  const currentGeneration = generation;
  pending = (async () => {
    const token = await readAuthToken();
    if (!token) return;
    const location = await getPosition();
    // Descartar uma leitura que terminou depois da saída da conta.
    if (currentGeneration !== generation || token !== await readAuthToken()) return;
    const { latitude, longitude, speed, accuracy } = location.coords;
    await sendLocationApi(token, {
      latitude,
      longitude,
      velocidade: speed !== null && speed >= 0 ? speed * 3.6 : null,
      precisao_gps: accuracy,
      registrado_em: new Date(location.timestamp).toISOString(),
    });
  })();
  try {
    await pending;
  } finally {
    pending = null;
  }
}

export async function startLocationTracking(): Promise<void> {
  if (timer) return;
  timer = setInterval(() => {
    void sendCurrentLocationNow().catch(error => {
      console.warn('Falha ao enviar localização; nova tentativa no próximo ciclo.', error);
    });
  }, 5_000);
}

export async function stopLocationTracking(): Promise<void> {
  generation += 1;
  if (timer) clearInterval(timer);
  timer = null;
}
