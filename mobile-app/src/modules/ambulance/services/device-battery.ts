import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type ExpoBatteryModule = {
  getBatteryLevelAsync?: () => Promise<number>;
};

/**
 * Retorna a bateria do aparelho como percentual inteiro (0-100).
 * Quando o recurso nao estiver disponivel, retorna null para nao interromper o GPS.
 */
export async function getDeviceBatteryPercentage(): Promise<number | null> {
  if (Platform.OS === 'web') return null;

  try {
    const batteryModule = requireOptionalNativeModule<ExpoBatteryModule>('ExpoBattery');
    const level = await batteryModule?.getBatteryLevelAsync?.();

    if (typeof level !== 'number' || !Number.isFinite(level) || level < 0) {
      return null;
    }

    return Math.max(0, Math.min(100, Math.round(level * 100)));
  } catch {
    return null;
  }
}
