import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAmbulanceSession } from '@/modules/ambulance/context/ambulance-session-context';

export default function IndexRoute() {
  const { status } = useAmbulanceSession();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1565c0" />
      </View>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/home' : '/login'} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f6f8' },
});
