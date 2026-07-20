import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../lib/api';

export default function NotificationSettingsScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const bg = isDark ? '#000000' : '#f1f5f9';
  const cardBg = isDark ? '#111111' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#1a1a1a' : '#e2e8f0';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/auth/notification-settings');
      setSettings(res.data || {
        emailDigest: false,
        pushEnabled: true,
        postNotifications: true,
        userNotifications: true,
        chatNotifications: true,
      });
    } catch (err) {
      console.warn('Failed to fetch notification settings:', err);
      Alert.alert('Error', 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, label: string, isDefaultTrue = true) => {
    if (!settings) return;
    setUpdatingKey(key);

    const currentVal = settings[key];
    const newVal = isDefaultTrue
      ? (currentVal !== false ? false : true)
      : (currentVal ? false : true);

    const updated = {
      emailDigest: settings.emailDigest ?? false,
      pushEnabled: settings.pushEnabled ?? true,
      postNotifications: settings.postNotifications ?? true,
      userNotifications: settings.userNotifications ?? true,
      chatNotifications: settings.chatNotifications ?? true,
      [key]: newVal,
    };

    try {
      const res = await api.patch('/api/auth/notification-settings', updated);
      setSettings(res.data);
    } catch (err) {
      console.warn(`Failed to update ${label}:`, err);
      Alert.alert('Error', `Failed to update ${label}`);
    } finally {
      setUpdatingKey(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#808bf5" />
        <Text style={{ marginTop: 12, color: subColor, fontSize: 13, fontWeight: '600' }}>
          Loading Preferences...
        </Text>
      </SafeAreaView>
    );
  }

  const renderOptionRow = (
    key: string,
    icon: string,
    title: string,
    description: string,
    isDefaultTrue = true
  ) => {
    const isChecked = isDefaultTrue ? (settings?.[key] !== false) : !!settings?.[key];
    const isPending = updatingKey === key;

    return (
      <View style={[styles.row, { borderColor }]}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={icon} size={24} color="#808bf5" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          <Text style={[styles.description, { color: subColor }]}>{description}</Text>
        </View>
        <Switch
          value={isChecked}
          onValueChange={() => handleToggle(key, title, isDefaultTrue)}
          disabled={isPending}
          thumbColor={isChecked ? '#808bf5' : '#f4f3f4'}
          trackColor={{ false: '#767577', true: 'rgba(128, 139, 245, 0.4)' }}
        />
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
        <Text style={[styles.headerTitle, { color: textColor }]}>Notification Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionSubtitle, { color: subColor }]}>
          Customize how you interact with Social Square. Turn notification categories on or off below.
        </Text>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {renderOptionRow(
            'pushEnabled',
            'bell-ring-outline',
            'Push Notifications (Global)',
            'Pause all push alerts. Note: security alerts and chat notifications will always bypass this pause.',
            true
          )}

          {renderOptionRow(
            'postNotifications',
            'post-outline',
            'Post Interactions',
            'Receive notifications when someone likes or comments on your posts.',
            true
          )}

          {renderOptionRow(
            'userNotifications',
            'account-multiple-outline',
            'Social & Follows',
            'Receive notifications when you get new followers.',
            true
          )}

          {renderOptionRow(
            'chatNotifications',
            'chat-processing-outline',
            'Chat Notifications',
            'Receive push alerts for new direct messages from your conversations.',
            true
          )}

          {renderOptionRow(
            'emailDigest',
            'email-newsletter',
            'Daily Email Digest',
            'Receive a daily compiled newsletter of your new interactions, likes, comments, and trending posts.',
            false
          )}
        </View>
      </ScrollView>
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
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
    fontWeight: '500',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(128, 139, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
});
