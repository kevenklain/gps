import { Redirect } from 'expo-router';

import { useAmbulanceSession } from '@/modules/ambulance/context/ambulance-session-context';
import { LoginScreen } from '@/modules/ambulance/screens/login/login-screen';

export default function LoginRoute() {
  const { status } = useAmbulanceSession();

  if (status === 'authenticated') {
    return <Redirect href="/home" />;
  }

  return <LoginScreen />;
}
