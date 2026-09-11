import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { sendLocationApi } from './ambulance-api';
import { BACKGROUND_LOCATION_TASK } from './background-location-task';
import { readAuthToken } from './session-storage';

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

  const background = await Location.requestBackgroundPermissionsAsync();

  if (background.status !== 'granted') {
    return 'foreground_only';
  }

  return 'granted';
}

/**
 * Registra um serviço de localização com notificação persistente no Android.
 * 10 s / 10 m oferece atualização frequente sem pedir um ponto a cada segundo.
 */
export async function startLocationTracking(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const taskManagerAvailable = await TaskManager.isAvailableAsync();

  if (!taskManagerAvailable) {
    throw new Error(
      'Rastreamento em segundo plano não está disponível neste ambiente. Use uma development build/APK, não o Expo Go.',
    );
  }

  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK,
  );

  if (alreadyRunning) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    activityType: Location.ActivityType.AutomotiveNavigation,
    timeInterval: 10_000,
    distanceInterval: 10,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Monitoramento de ambulância ativo',
      notificationBody: 'A localização está sendo enviada para a central.',
      killServiceOnDestroy: false,
    },
  });
}

/** Envia um ponto imediatamente para o painel não esperar o primeiro ciclo. */
export async function sendCurrentLocationNow(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const token = await readAuthToken();

  if (!token) {
    return;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

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
  if (Platform.OS === 'web') {
    return;
  }

  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

  if (running) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
