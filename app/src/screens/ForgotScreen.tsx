import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { api } from '../lib/api';

const { width, height } = Dimensions.get('window');

export default function ForgotScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleForgot = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/forgot-password', { email: email.trim() });
      if (response.status === 200 || response.data?.success) {
        setSent(true);
      } else {
        Alert.alert('Error', response.data?.error || 'Failed to send reset link.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Network error! Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDark ? '#121212' : '#ffffff';
  const pageBg = isDark ? '#0a0a0a' : '#f3f4f6';
  const textColor = isDark ? '#ffffff' : '#1f2937';
  const subText = isDark ? '#9ca3af' : '#4b5563';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff';
  const inputBorder = isDark ? '#1f2937' : '#e5e7eb';

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: pageBg }]}>
      <View style={styles.backgroundGraphics}>
        <View style={styles.angledGradient} />
        <View style={styles.floatingShapeRight} />
        <View style={styles.floatingShapeLeft} />
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={styles.logoText}>Social Square</Text>
        <Text style={[styles.subTitle, { color: textColor }]}>Reset Password</Text>

        {sent ? (
          <View style={styles.successContainer}>
            <Text style={styles.successHeader}>Check your inbox</Text>
            <Text style={[styles.successDescription, { color: subText }]}>
              If an account exists for this email, you'll receive a password reset link shortly.
              {'\n\n'}
              Wait a minute before requesting another link.
            </Text>
            <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.submitBtnText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.instructions, { color: subText }]}>
              Enter your email associated with your account. We'll send you a password reset link.
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
              ]}
              placeholder="you@example.com"
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleForgot} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <View style={[styles.divider, { borderTopColor: inputBorder }]} />
            <View style={styles.backToLoginRow}>
              <Text style={{ color: subText }}>Remember your password? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  backgroundGraphics: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  angledGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    backgroundColor: '#808bf5',
    borderBottomLeftRadius: width * 0.1,
    borderBottomRightRadius: width * 0.1,
  },
  floatingShapeRight: {
    position: 'absolute',
    top: height * 0.2,
    right: '4%',
    width: 100,
    height: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ rotate: '-12deg' }],
    borderRadius: 4,
  },
  floatingShapeLeft: {
    position: 'absolute',
    bottom: height * 0.15,
    left: '6%',
    width: 90,
    height: 20,
    backgroundColor: 'rgba(128, 139, 245, 0.15)',
    transform: [{ rotate: '-12deg' }],
    borderRadius: 4,
  },
  card: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    alignItems: 'center',
    zIndex: 10,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#808bf5',
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  form: {
    width: '100%',
  },
  instructions: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#808bf5',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  successContainer: {
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  successHeader: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: 20,
    width: '100%',
  },
  backToLoginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    color: '#808bf5',
    fontWeight: 'bold',
  },
});
