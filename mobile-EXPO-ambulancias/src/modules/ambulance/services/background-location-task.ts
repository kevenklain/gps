import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { readAuthToken } from './session-storage';
import { sendLocationApi } from './ambulance-api';

export const BACKGROUND_LOCATION_TASK = 'ambulancias-background-location';

/**
 * A tarefa PRECISA ser definida no escopo global do módulo.
 * O Expo pode carregar o bundle sem montar nenhuma tela quando entrega uma
 * atualização de GPS em segundo plano.
 */
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) {
      return;
    }

    const token = await readAuthToken();

    // Sem sessão não há motivo para transmitir localização.
    if (!token) {
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];

    for (const location of locations) {
      try {
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
      } catch {
        // A próxima leitura de GPS tentará transmitir novamente.
        // Não encerramos a tarefa por uma falha de rede pontual.
      }
    }
  });
}
