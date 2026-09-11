import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import type { ConnectionStatus } from '../../types';

const COLORS = {
  bg: '#f4f6f8',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  text: '#1b2430',
  muted: '#667085',
  border: '#e4e7ec',
  primary: '#1565c0',
  primaryDark: '#0d47a1',
  success: '#128a55',
  warning: '#b26a00',
  danger: '#c62828',
  sidebar: '#17202b',
};

const STATUS_COPY: Record<ConnectionStatus, { label: string; color: string; background: string }> = {
  online: { label: 'Online', color: COLORS.success, background: '#e7f7ef' },
  sem_comunicacao: { label: 'Sem comunicação', color: COLORS.warning, background: '#fff4df' },
  offline: { label: 'Offline', color: COLORS.danger, background: '#fdeaea' },
  inativo: { label: 'Offline', color: COLORS.danger, background: '#fdeaea' },
};

function formatDate(value: string | null): string {
  if (!value) {
    return 'Ainda não houve comunicação';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function HomeScreen() {
  const router = useRouter();
  const { context, refresh, protectedLogout, trackingPermission } = useAmbulanceSession();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [acesso, setAcesso] = useState(context?.usuario.email ?? '');
  const [senha, setSenha] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      void refresh();
    }, 5_000);

    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (context?.usuario.email) {
      setAcesso(context.usuario.email);
    }
  }, [context?.usuario.email]);

  const status = useMemo(() => {
    const serverStatus = context?.ambulancia.status ?? 'offline';
    return STATUS_COPY[serverStatus];
  }, [context?.ambulancia.status]);

  if (!context) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  async function handleProtectedLogout() {
    setLogoutLoading(true);
    setLogoutError(null);

    try {
      await protectedLogout(acesso, senha);
      setLogoutVisible(false);
      setSenha('');
      router.replace('/login');
    } catch (logoutFailure) {
      setLogoutError(
        logoutFailure instanceof Error
          ? logoutFailure.message
          : 'Não foi possível confirmar a saída.',
      );
    } finally {
      setLogoutLoading(false);
    }
  }

  const permissionWarning =
    trackingPermission === 'foreground_only'
      ? Platform.OS === 'web'
        ? 'Localização enviada a cada 5 segundos enquanto esta página estiver ativa. Mantenha a aba aberta; o navegador pode suspender o envio em segundo plano.'
        : 'Localização enviada a cada 5 segundos com o app aberto. No Expo Go, mantenha esta tela ativa. Para monitorar em segundo plano, use uma build com permissão de localização o tempo todo.'
      : trackingPermission === 'denied'
        ? 'A localização foi negada. O painel não receberá a posição deste aparelho até a permissão ser liberada.'
        : trackingPermission === 'unsupported'
          ? Platform.OS === 'web'
            ? 'Localização indisponível. Abra o aplicativo em localhost ou HTTPS e permita o acesso à localização no navegador.'
            : 'O rastreamento contínuo precisa ser testado em um aparelho Android/iOS com development build ou APK.'
          : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={styles.headerEmoji}>🚑</Text>
          <View>
            <Text style={styles.headerTitle}>AMBULÂNCIA</Text>
            <Text style={styles.headerSubtitle}>MONITORAMENTO</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.greeting}>
          <View style={styles.avatar}>
            <Feather name="user" size={28} color="#ffffff" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.greetingTitle}>Olá, {context.usuario.nome}</Text>
            <Text style={styles.greetingSubtitle}>Condutor ativo</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.cardIcon, styles.driverIcon]}>
            <Feather name="user" size={25} color={COLORS.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>MOTORISTA</Text>
            <Text style={styles.cardTitle}>{context.usuario.nome}</Text>
            <Text style={styles.cardMeta}>{context.usuario.email}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Text style={styles.ambulanceIcon}>🚑</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>AMBULÂNCIA</Text>
            <Text style={styles.cardTitle}>{context.ambulancia.nome}</Text>
            <Text style={styles.cardMeta}>Identificador: {context.ambulancia.identificador}</Text>
            {context.ambulancia.placa ? (
              <Text style={styles.cardMeta}>Placa: {context.ambulancia.placa}</Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.statusCard, { backgroundColor: status.background }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusEyebrow, { color: status.color }]}>STATUS DO APLICATIVO</Text>
          </View>
          <Text style={[styles.statusTitle, { color: status.color }]}>{status.label}</Text>
          <Text style={styles.statusDescription}>
            {status.label === 'Online'
              ? 'Conectado ao servidor e transmitindo localização.'
              : 'Aguardando nova comunicação de localização.'}
          </Text>
          <View style={styles.lastUpdateRow}>
            <Feather name="clock" size={16} color={COLORS.muted} />
            <Text style={styles.lastUpdateText}>
              Última atualização: {formatDate(context.ambulancia.ultima_comunicacao)}
            </Text>
          </View>
        </View>

        {permissionWarning ? (
          <View style={styles.warningCard}>
            <Feather name="alert-triangle" size={20} color={COLORS.warning} />
            <Text style={styles.warningText}>{permissionWarning}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed ? styles.logoutButtonPressed : null]}
          onPress={() => {
            setLogoutError(null);
            setSenha('');
            setLogoutVisible(true);
          }}
        >
          <Feather name="log-out" size={19} color="#ffffff" />
          <Text style={styles.logoutButtonText}>Sair da conta</Text>
        </Pressable>

        <Text style={styles.backgroundHint}>
          {Platform.OS === 'web'
            ? 'O monitoramento usa a localização fornecida pelo seu navegador.'
            : trackingPermission === 'granted'
              ? 'O monitoramento continua em segundo plano enquanto a sessão estiver ativa.'
              : 'Mantenha o aplicativo aberto para transmitir sua localização.'}
        </Text>
      </ScrollView>

      <Modal
        visible={logoutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!logoutLoading) {
            setLogoutVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar saída</Text>
            <Text style={styles.modalSubtitle}>
              Para interromper o monitoramento e sair, faça a autenticação novamente.
            </Text>

            <Text style={styles.inputLabel}>Acesso</Text>
            <TextInput
              value={acesso}
              onChangeText={setAcesso}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!logoutLoading}
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Senha</Text>
            <TextInput
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              editable={!logoutLoading}
              style={styles.modalInput}
              onSubmitEditing={() => void handleProtectedLogout()}
            />

            {logoutError ? <Text style={styles.modalError}>{logoutError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                disabled={logoutLoading}
                style={styles.cancelButton}
                onPress={() => setLogoutVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={logoutLoading || !acesso.trim() || !senha}
                style={[
                  styles.confirmButton,
                  (logoutLoading || !acesso.trim() || !senha) && styles.buttonDisabled,
                ]}
                onPress={() => void handleProtectedLogout()}
              >
                {logoutLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmar e sair</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.sidebar,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3b49',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 11, justifyContent: 'center' },
  headerEmoji: { fontSize: 30 },
  headerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '800', letterSpacing: 1 },
  headerSubtitle: { color: '#cbd6e1', fontSize: 9, fontWeight: '700', letterSpacing: 4 },
  content: { padding: 20, gap: 14, paddingBottom: 36 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 2 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.sidebar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingTitle: { color: COLORS.text, fontSize: 21, fontWeight: '800' },
  greetingSubtitle: { color: COLORS.muted, fontSize: 14, marginTop: 3 },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverIcon: { backgroundColor: '#e9eff7' },
  ambulanceIcon: { fontSize: 28 },
  eyebrow: { color: '#475467', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  cardMeta: { color: COLORS.muted, fontSize: 13, marginTop: 3 },
  statusCard: { borderRadius: 12, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusEyebrow: { fontSize: 12, fontWeight: '800' },
  statusTitle: { fontSize: 28, fontWeight: '900', marginTop: 10 },
  statusDescription: { color: COLORS.text, fontSize: 14, marginTop: 2, lineHeight: 20 },
  lastUpdateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 },
  lastUpdateText: { color: COLORS.muted, fontSize: 12, flex: 1 },
  warningCard: {
    backgroundColor: '#fff8e8',
    borderWidth: 1,
    borderColor: '#f3d79d',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  warningText: { color: '#7a4d00', flex: 1, fontSize: 13, lineHeight: 19 },
  logoutButton: {
    marginTop: 6,
    height: 54,
    borderRadius: 10,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  logoutButtonPressed: { opacity: 0.88 },
  logoutButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  backgroundHint: { color: COLORS.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 20, 30, 0.62)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 22 },
  modalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '800' },
  modalSubtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 18 },
  inputLabel: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cfd5dd',
    borderRadius: 9,
    height: 48,
    paddingHorizontal: 12,
    color: COLORS.text,
    marginBottom: 14,
    backgroundColor: '#ffffff',
  },
  modalError: { color: COLORS.danger, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelButton: { paddingHorizontal: 14, height: 44, justifyContent: 'center' },
  cancelButtonText: { color: COLORS.muted, fontWeight: '700' },
  confirmButton: {
    paddingHorizontal: 16,
    height: 44,
    minWidth: 138,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: { color: '#ffffff', fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
});
