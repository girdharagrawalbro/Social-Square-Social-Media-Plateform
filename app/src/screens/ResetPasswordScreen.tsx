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

export default function ResetPasswordScreen({ route, navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const { token, email } = route.params || {};

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!token || !email) {
      Alert.alert('Error', 'Invalid or expired password reset parameters.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/reset-password', {
        token,
        email,
        password,
      });

      if (response.status === 200 || response.data?.success) {
        Alert.alert('Success', 'Password has been reset. Redirecting to login...', [
          { text: 'OK', onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        Alert.alert('Error', response.data?.error || 'Password reset failed.');
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

  if (!token || !email) {
    return (
      <View style={[styles.container, { backgroundColor: pageBg, justifyContent: 'center' }]}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={styles.errorText}>Invalid reset link parameters.</Text>
          <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.navigate('Forgot')}>
            <Text style={styles.submitBtnText}>Request new link</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
            ]}
            placeholder="New password"
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />

          <TextInput
            style={[
              styles.input,
              { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
            ]}
            placeholder="Confirm new password"
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleReset} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Reset Password</Text>
            )}
          </TouchableOpacity>
        </View>
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
    marginBottom: 20,
  },
  form: {
    width: '100%',
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
    marginTop: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
});
