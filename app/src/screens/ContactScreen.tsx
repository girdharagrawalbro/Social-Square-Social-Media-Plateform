import { brand } from '../theme/colors';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';
import { toast as Toast } from '../lib/CustomToast';
import type { AppScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export default function ContactScreen({ navigation }: AppScreenProps<'Contact'>) {
  const { colors, isDark } = useTheme();
  const user = useAuthStore(s => s.user);
  
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const bg = colors.background;
  const cardBg = colors.surface;
  const border = colors.border;
  const textColor = colors.text.primary;
  const subText = colors.text.secondary;
  const inputBg = isDark ? '#1f2937' : '#f3f4f6';

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Toast.error('Subject and message are required', 'Error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/contact', {
        name: user?.fullname || 'App User',
        email: user?.email || 'unknown@example.com',
        subject: subject.trim(),
        message: message.trim()
      });
      Toast.success('We have received your message.', 'Sent!');
      setSubject('');
      setMessage('');
      navigation.goBack();
    } catch (err: any) {
      Toast.error(err.response?.data?.error || 'Failed to send message', 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: bg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content}>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
              <MaterialCommunityIcons name="lifebuoy" size={24} color={brand.primary} />
              <Text style={[styles.cardTitle, { color: textColor, marginLeft: 10 }]}>
                Contact Us
              </Text>
            </View>
            <Text style={{ color: subText, marginBottom: 20, fontSize: 13 }}>
              Found a bug or need help? Send us a message and our support team will get back to you.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: textColor }]}>Subject</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor: border, borderWidth: 1 }]}
                placeholder="Briefly describe the issue"
                placeholderTextColor={subText}
                value={subject}
                onChangeText={setSubject}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: textColor }]}>Message</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: inputBg, color: textColor, borderColor: border, borderWidth: 1 }]}
                placeholder="How can we help you?"
                placeholderTextColor={subText}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>
                {loading ? 'Sending...' : 'Send Message'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { padding: 16 },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  textArea: {
    height: 120,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: brand.primary,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: brand.primaryInverse, fontSize: 16, fontWeight: 'bold' },
});
