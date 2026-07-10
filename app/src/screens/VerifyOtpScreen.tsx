import React, { useState, useEffect, useRef } from 'react';
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

export default function VerifyOtpScreen({ route, navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const { userId } = route.params || {};

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const { verifyOtp, loading } = useAuthStore();

  useEffect(() => {
    if (!userId) {
      Alert.alert('Error', 'Invalid verification parameters.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    }
  }, [userId]);

  // Countdown timer for code resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Focus next input
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    const result = await verifyOtp(userId, otpValue);
    if (result?.success) {
      navigation.replace('SocialSquare');
    } else {
      Alert.alert('Verification Failed', result?.error || 'Invalid OTP code');
      setOtp(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    }
  };

  const handleResend = () => {
    setResending(true);
    Alert.alert('Resend Code', 'Please login again to request a new verification code.', [
      {
        text: 'OK',
        onPress: () => {
          setResending(false);
          navigation.navigate('Login');
        },
      },
    ]);
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
          <Text style={styles.logoIcon}>🔐</Text>
          <Text style={[styles.title, { color: textColor }]}>Verify your identity</Text>
          <Text style={[styles.instructions, { color: subText }]}>
            Enter the 6-digit code sent to your email
          </Text>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(el) => { inputsRef.current[index] = el; }}
                style={[
                  styles.otpInput,
                  {
                    backgroundColor: inputBg,
                    borderColor: digit ? '#808bf5' : inputBorder,
                    color: textColor,
                  },
                ]}
                keyboardType="numeric"
                maxLength={1}
                value={digit}
                onChangeText={(val) => handleChange(index, val)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                selectTextOnFocus
              />
            ))}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Verify</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={{ color: subText }}>
                Resend code in <Text style={{ fontWeight: 'bold' }}>{countdown}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            )}
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
    alignItems: 'center',
    zIndex: 10,
  },
  logoIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  instructions: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  otpInput: {
    width: 44,
    height: 48,
    borderWidth: 2,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resendRow: {
    marginTop: 8,
  },
  resendText: {
    color: '#808bf5',
    fontWeight: 'bold',
  },
});
