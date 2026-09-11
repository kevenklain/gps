import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { sendLocationApi } from './ambulance-api';
import { BACKGROUND_LOCATION_TASK } from './background-location-task';
import { readAuthToken } from './session-storage';

let timer: ReturnType<typeof setInterval> | null = null;
let pending: Promise<void> | null = null;
let generation = 0;

export type TrackingPermissionState = 'granted' | 'foreground_only' | 'denied' | 'unsupported';

/** Solicita as permissões necessárias para o rastreamento contínuo. */
export async function requestTrackingPermissions(): Promise<TrackingPermissionState> {
  if (Platform.OS === 'web') {
    return 'unsupported';
  }

  const foreground = await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== 'granted') {
    return 'denied';
  }

  try {
    if (!await TaskManager.isAvailableAsync()) return 'foreground_only';
    const background = await Location.requestBackgroundPermissionsAsync();

  if (background.status !== 'granted') {
    return 'foreground_only';
  }

    return 'granted';
  } catch {
    return 'foreground_only';
  }
}

/**
 * Registra um serviço de localização com notificação persistente no Android.
 * Solicita atualizações a cada 5 s, mesmo sem deslocamento.
 */
export async function startLocationTracking(): Promise<TrackingPermissionState> {
  if ((await Location.getForegroundPermissionsAsync()).status !== 'granted') return 'denied';
  try {
    if (await TaskManager.isAvailableAsync() &&
        (await Location.getBackgroundPermissionsAsync()).status === 'granted') {
      if (!await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          activityType: Location.ActivityType.AutomotiveNavigation,
          timeInterval: 5_000,
          distanceInterval: 0,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Monitoramento de ambulância ativo',
            notificationBody: 'A localização está sendo enviada para a central.',
            killServiceOnDestroy: false,
          },
        });
      }
      if (timer) clearInterval(timer);
      timer = null;
      return 'granted';
    }
  } catch (error) {
    console.warn('Usando localização apenas com o aplicativo aberto.', error);
  }
  if (!timer) {
    timer = setInterval(() => {
      void sendCurrentLocationNow().catch(error => {
        console.warn('Falha no envio do GPS; nova tentativa no próximo ciclo.', error);
      });
    }, 5_000);
  }
  return 'foreground_only';
}

/** Envia um ponto imediatamente para o painel não esperar o primeiro ciclo. */
export async function sendCurrentLocationNow(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  if (AppState.currentState !== 'active') return;
  if (pending) return pending;
  const currentGeneration = generation;
  pending = captureAndSend(currentGeneration);
  try {
    await pending;
  } finally {
    pending = null;
  }
}

async function captureAndSend(currentGeneration: number): Promise<void> {
  const token = await readAuthToken();

  if (!token) {
    return;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  if (generation !== currentGeneration || AppState.currentState !== 'active' ||
      token !== await readAuthToken()) return;

  const speedInMetersPerSecond = location.coords.speed;
  const speedInKmPerHour =
    typeof speedInMetersPerSecond === 'number' && speedInMetersPerSecond >= 0
      ? speedInMetersPerSecond * 3.6
      : null;

  await sendLocationApi(token, {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    velocidade: speedInKmPerHour,
    precisao_gps: location.coords.accuracy,
    registrado_em: new Date(location.timestamp).toISOString(),
  });
}

export async function stopLocationTracking(): Promise<void> {
  generation += 1;
  if (timer) clearInterval(timer);
  timer = null;
  if (!await TaskManager.isAvailableAsync()) return;
  if (Platform.OS === 'web') {
    return;
  }

  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

  if (running) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
