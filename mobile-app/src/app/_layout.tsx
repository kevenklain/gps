import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importar este módulo cedo garante que TaskManager.defineTask seja executado
// mesmo quando o sistema operacional acorda o bundle apenas para enviar GPS.
import '@/modules/ambulance/services/background-location-task';
import { AmbulanceSessionProvider } from '@/modules/ambulance/context/ambulance-session-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AmbulanceSessionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="home" />
        </Stack>
        <StatusBar style="light" />
      </AmbulanceSessionProvider>
    </SafeAreaProvider>
  );
}
