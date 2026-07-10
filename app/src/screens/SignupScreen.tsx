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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import useAuthStore from '../store/zustand/useAuthStore';

const { width, height } = Dimensions.get('window');

function PasswordStrengthMeter({ password }: { password?: string }) {
  if (!password) return null;
  let strength = 0;
  if (password.length >= 6) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;

  let color = '#ef4444'; // weak
  let text = 'Weak';
  let percentage = '20%';

  if (strength >= 4) {
    color = '#10b981'; // strong
    text = 'Strong';
    percentage = '100%';
  } else if (strength >= 2) {
    color = '#f59e0b'; // medium
    text = 'Medium';
    percentage = '60%';
  }

  return (
    <View style={styles.strengthContainer}>
      <View style={styles.strengthLabelRow}>
        <Text style={styles.strengthLabel}>Password Strength:</Text>
        <Text style={[styles.strengthText, { color }]}>{text}</Text>
      </View>
      <View style={styles.strengthBarBg}>
        <View style={[styles.strengthBarFill, { backgroundColor: color, width: percentage as any }]} />
      </View>
    </View>
  );
}

export default function SignupScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const [email, setEmail] = useState('');
  const [fullname, setFullname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signup, loading } = useAuthStore();

  const handleSignup = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (fullname.trim().length < 2) {
      Alert.alert('Error', 'Full name must be at least 2 characters');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    const result = await signup({
      fullname: fullname.trim(),
      email: email.trim(),
      password,
    });

    if (result?.success) {
      Alert.alert('Success', 'Account created successfully!');
      navigation.replace('SocialSquare');
    } else {
      Alert.alert('Signup Failed', result?.error || 'Something went wrong');
    }
  };

  const cardBg = isDark ? '#121212' : '#ffffff';
  const pageBg = isDark ? '#0a0a0a' : '#f3f4f6';
  const textColor = isDark ? '#ffffff' : '#1f2937';
  const subText = isDark ? '#9ca3af' : '#4b5563';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff';
  const inputBorder = isDark ? '#1f2937' : '#e5e7eb';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: pageBg }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.backgroundGraphics}>
          <View style={styles.angledGradient} />
          <View style={styles.floatingShapeRight} />
          <View style={styles.floatingShapeLeft} />
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.header}>
            <Text style={styles.logoText}>Social Square</Text>
            <Text style={[styles.subTitle, { color: subText }]}>Sign Up to Social Square</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
              ]}
              placeholder="Email"
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={[
                styles.input,
                { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
              ]}
              placeholder="Full Name"
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              value={fullname}
              onChangeText={setFullname}
            />

            <View style={styles.passwordWrapper}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
                ]}
                placeholder="Password"
                placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={{ color: '#808bf5', fontWeight: 'bold' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>

            <PasswordStrengthMeter password={password} />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSignup} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Sign Up</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.signupContainer}>
            <Text style={{ color: subText }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signupText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
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
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#808bf5',
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '500',
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
    marginBottom: 12,
    fontSize: 15,
  },
  passwordWrapper: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    height: 48,
    justifyContent: 'center',
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#808bf5',
    fontWeight: 'bold',
  },
  strengthContainer: {
    marginVertical: 4,
    width: '100%',
  },
  strengthLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  strengthLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  strengthText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  strengthBarBg: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
