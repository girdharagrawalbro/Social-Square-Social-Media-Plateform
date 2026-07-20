import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Alert,
  FlatList,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../lib/api';

const deviceIcon = (device = '') => {
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) {
    return 'cellphone';
  }
  if (d.includes('tablet') || d.includes('ipad')) {
    return 'tablet';
  }
  return 'laptop';
};

export default function ActiveSessionsScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const bg = isDark ? '#000000' : '#f1f5f9';
  const cardBg = isDark ? '#111111' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#1a1a1a' : '#e2e8f0';

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/auth/sessions');
      setSessions(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.warn('Fetch sessions error:', err);
      Alert.alert('Error', 'Failed to load sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/get');
      setTwoFaEnabled(!!res?.data?.twoFactorEnabled);
    } catch (err) {
      console.warn('Fetch user error:', err);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchUser();
  }, [fetchSessions, fetchUser]);

  const toggle2FA = async () => {
    try {
      setToggling2FA(true);
      const res = await api.post('/api/auth/toggle-2fa', {});
      const enabled = !!res?.data?.twoFactorEnabled;
      setTwoFaEnabled(enabled);
      Alert.alert('Success', `Two-Factor Authentication has been ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      console.warn('Toggle 2FA error:', err);
      Alert.alert('Error', 'Failed to toggle 2FA');
    } finally {
      setToggling2FA(false);
    }
  };

  const revokeSession = async (sessionId: string, isCurrentSession: boolean) => {
    if (isCurrentSession) {
      Alert.alert('Info', 'You cannot revoke your current active session.');
      return;
    }

    Alert.alert(
      'Revoke Session',
      'Are you sure you want to end this active session? The device will be logged out immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              setRevokingSessionId(sessionId);
              await api.delete(`/api/auth/sessions/${sessionId}`);
              setSessions((prev) => prev.filter((s) => s._id !== sessionId));
            } catch (err) {
              console.warn('Revoke session error:', err);
              Alert.alert('Error', 'Failed to revoke session');
            } finally {
              setRevokingSessionId(null);
            }
          },
        },
      ]
    );
  };

  const revokeAllSessions = () => {
    Alert.alert(
      'Revoke Other Sessions',
      'This will log you out from all OTHER devices. Your current session will remain active. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke All',
          style: 'destructive',
          onPress: async () => {
            try {
              setRevokingAll(true);
              await api.delete('/api/auth/sessions/all/revoke');
              Alert.alert('Success', 'Other sessions revoked successfully.');
              fetchSessions();
            } catch (err) {
              console.warn('Revoke all sessions error:', err);
              Alert.alert('Error', 'Failed to revoke other sessions');
            } finally {
              setRevokingAll(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: string) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getLocationText = (location: any) => {
    if (!location) return 'Unknown location';
    const city = location?.city || 'Unknown city';
    const country = location?.country || 'Unknown country';
    return `${city}, ${country}`;
  };

  const renderSessionItem = ({ item }: { item: any }) => {
    const isCurrentSession = !!item?.isCurrentSession;
    const isPending = revokingSessionId === item._id;

    return (
      <View style={[styles.sessionCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.sessionHeaderRow}>
          <View style={styles.sessionIconWrapper}>
            <MaterialCommunityIcons name={deviceIcon(item.device)} size={24} color="#808bf5" />
          </View>
          <View style={styles.sessionInfo}>
            <View style={styles.deviceNameRow}>
              <Text style={[styles.deviceName, { color: textColor }]} numberOfLines={1}>
                {item.device || 'Unknown Device'}
              </Text>
              {isCurrentSession && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>This device</Text>
                </View>
              )}
            </View>
            <Text style={[styles.sessionMeta, { color: subColor }]}>
              {getLocationText(item.location)} · {item.ip || 'Unknown IP'}
            </Text>
            <Text style={[styles.sessionTime, { color: subColor }]}>
              Last active: {formatDate(item.lastUsedAt)}
              {item.isNewDevice && (
                <Text style={{ color: '#eab308', fontWeight: 'bold' }}> · New</Text>
              )}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => revokeSession(item._id, isCurrentSession)}
          disabled={isCurrentSession || isPending}
          style={[
            styles.revokeBtn,
            isCurrentSession && styles.revokeBtnDisabled,
            { borderColor: isCurrentSession ? borderColor : '#f87171' },
          ]}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Text style={[styles.revokeBtnText, isCurrentSession ? { color: subColor } : { color: '#ef4444' }]}>
              {isCurrentSession ? 'Current' : 'Revoke'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor, backgroundColor: cardBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Active Sessions & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item._id}
        renderItem={renderSessionItem}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* 2FA Card */}
            <View style={[styles.card2FA, { backgroundColor: cardBg, borderColor }]}>
              <View style={styles.card2FAIconWrapper}>
                <MaterialCommunityIcons name="shield-key-outline" size={28} color="#808bf5" />
              </View>
              <View style={styles.card2FAInfo}>
                <Text style={[styles.card2FATitle, { color: textColor }]}>Two-Factor Authentication</Text>
                <Text style={[styles.card2FADesc, { color: subColor }]}>
                  {twoFaEnabled
                    ? 'Enabled — OTP sent to your email on every login attempt.'
                    : 'Add an extra layer of security to your account.'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={toggle2FA}
                disabled={toggling2FA}
                style={[
                  styles.toggle2FABtn,
                  { backgroundColor: twoFaEnabled ? 'rgba(239, 68, 68, 0.1)' : '#808bf5' },
                ]}
              >
                {toggling2FA ? (
                  <ActivityIndicator size="small" color={twoFaEnabled ? '#ef4444' : '#ffffff'} />
                ) : (
                  <Text style={[styles.toggle2FABtnText, { color: twoFaEnabled ? '#ef4444' : '#ffffff' }]}>
                    {twoFaEnabled ? 'Disable' : 'Enable'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Sessions Title */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Active Sessions ({sessions.length})
              </Text>
              {sessions.length > 1 && (
                <TouchableOpacity
                  onPress={revokeAllSessions}
                  disabled={revokingAll}
                  style={styles.revokeAllBtn}
                >
                  {revokingAll ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={styles.revokeAllBtnText}>Logout other devices</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#808bf5" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="devices" size={48} color={subColor} />
              <Text style={{ marginTop: 8, color: subColor, fontSize: 13, fontWeight: '600' }}>
                No active sessions found.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card2FA: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 1,
  },
  card2FAIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(128, 139, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  card2FAInfo: {
    flex: 1,
    paddingRight: 8,
  },
  card2FATitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  card2FADesc: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  toggle2FABtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggle2FABtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  revokeAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  revokeAllBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sessionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 1,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  sessionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(128, 139, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: 'bold',
    maxWidth: '70%',
  },
  currentBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  currentBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: 'bold',
  },
  sessionMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  sessionTime: {
    fontSize: 10,
    marginTop: 2,
  },
  revokeBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revokeBtnDisabled: {
    backgroundColor: 'transparent',
  },
  revokeBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
