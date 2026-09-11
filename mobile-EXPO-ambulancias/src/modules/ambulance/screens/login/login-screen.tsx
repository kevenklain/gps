import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAmbulanceSession } from '../../context/ambulance-session-context';

const COLORS = {
  sidebar: '#17202b',
  sidebarLight: '#243447',
  primary: '#1565c0',
  primaryDark: '#0d47a1',
  white: '#ffffff',
  muted: '#b8c3cf',
  danger: '#ffb3b3',
};

export function LoginScreen() {
  const router = useRouter();
  const { login } = useAmbulanceSession();
  const [acesso, setAcesso] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!acesso.trim() || !senha) {
      setError('Informe o acesso e a senha.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(acesso, senha);
      router.replace('/home');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandArea}>
            <View style={styles.brandMark}>
              <Text style={styles.ambulanceEmoji}>🚑</Text>
            </View>
            <Text style={styles.brandTitle}>AMBULÂNCIA</Text>
            <Text style={styles.brandSubtitle}>MONITORAMENTO</Text>
            <Text style={styles.tagline}>
              Localização em tempo real para uma operação mais segura e ágil.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Feather name="user" size={20} color={COLORS.muted} />
              <TextInput
                value={acesso}
                onChangeText={setAcesso}
                placeholder="Acesso (e-mail)"
                placeholderTextColor="#8f9cac"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                style={styles.input}
                editable={!loading}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Feather name="lock" size={20} color={COLORS.muted} />
              <TextInput
                value={senha}
                onChangeText={setSenha}
                placeholder="Senha"
                placeholderTextColor="#8f9cac"
                secureTextEntry={!showPassword}
                textContentType="password"
                style={styles.input}
                editable={!loading}
                onSubmitEditing={() => void handleLogin()}
              />
              <Pressable
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onPress={() => setShowPassword((current) => !current)}
                hitSlop={10}
              >
                <Feather name={showPassword ? 'eye' : 'eye-off'} size={20} color={COLORS.muted} />
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={loading}
              onPress={() => void handleLogin()}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && !loading ? styles.loginButtonPressed : null,
                loading ? styles.loginButtonDisabled : null,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Entrar</Text>
                  <Feather name="arrow-right" size={20} color={COLORS.white} />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <View style={styles.pulseLine} />
            <Text style={styles.footerText}>Sistema de Monitoramento de Ambulâncias</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.sidebar },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  brandArea: { alignItems: 'center', paddingTop: 20 },
  brandMark: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: COLORS.sidebarLight,
    borderWidth: 1,
    borderColor: '#3a4959',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  ambulanceEmoji: { fontSize: 52 },
  brandTitle: { color: COLORS.white, fontSize: 31, fontWeight: '800', letterSpacing: 1 },
  brandSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 6,
    marginTop: 4,
  },
  tagline: {
    color: '#d4dce5',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 20,
    maxWidth: 320,
  },
  form: { gap: 14, marginTop: 44 },
  inputWrapper: {
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#516173',
    backgroundColor: '#1d2a38',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: { flex: 1, color: COLORS.white, fontSize: 16, height: '100%' },
  error: { color: COLORS.danger, fontSize: 14, lineHeight: 20 },
  loginButton: {
    height: 56,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  loginButtonPressed: { backgroundColor: COLORS.primaryDark },
  loginButtonDisabled: { opacity: 0.65 },
  loginButtonText: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  footer: { alignItems: 'center', marginTop: 48 },
  pulseLine: { width: 160, height: 2, backgroundColor: COLORS.primary, marginBottom: 16 },
  footerText: { color: '#91a0af', fontSize: 12, textAlign: 'center' },
});
