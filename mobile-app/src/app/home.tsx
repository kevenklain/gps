import { Redirect } from 'expo-router';

import { useAmbulanceSession } from '@/modules/ambulance/context/ambulance-session-context';
import { HomeScreen } from '@/modules/ambulance/screens/home/home-screen';

export default function HomeRoute() {
  const { status } = useAmbulanceSession();

  if (status === 'guest') {
    return <Redirect href="/login" />;
  }

  return <HomeScreen />;
}
