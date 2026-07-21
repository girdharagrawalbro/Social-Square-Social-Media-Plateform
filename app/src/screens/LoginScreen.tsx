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
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, googleLogin, loading } = useAuthStore();

  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: '438982943802-70qgbbglo3ei6ufhubp5hp1asiuv0oov.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email or username');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    const result = await login({ email: identifier.trim(), password });
    if (result?.requiresOtp) {
      const duration = result.resendDuration || 60;
      const resendUntil = Date.now() + duration * 1000;
      await AsyncStorage.setItem('otpResendUntil', resendUntil.toString());
      if (result.otpExpireTime) {
        await AsyncStorage.setItem('otpExpiresAt', result.otpExpireTime);
      }
      navigation.navigate('VerifyOtp', { userId: result.userId });
    } else if (result?.success) {
      navigation.replace('SocialSquare');
    } else {
      Alert.alert('Login Failed', result?.error || 'Something went wrong');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      
      if (!idToken) {
        Alert.alert('Google Sign-in Failed', 'No ID Token returned from Google Services.');
        return;
      }
      
      const result = await googleLogin({ credential: idToken });
      if (result?.success) {
        navigation.replace('SocialSquare');
      } else {
        Alert.alert('Google Sign-in Failed', result?.error || 'Could not authenticate with Google');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Google login cancelled by user');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Google login already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Play Services', 'Google Play Services not available or outdated.');
      } else {
        Alert.alert('Google Sign-in Error', error.message || 'Could not sign in with Google');
      }
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
        {/* Dynamic Web-styled Background */}
        <View style={styles.backgroundGraphics}>
          <View style={styles.angledGradient} />
          <View style={styles.floatingShapeRight} />
          <View style={styles.floatingShapeLeft} />
        </View>

        {/* Login Card */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.header}>
            <Text style={styles.logoText}>Social Square</Text>
            <Text style={[styles.subTitle, { color: subText }]}>Sign in to your account</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
              ]}
              placeholder="Email or Username"
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
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
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={isDark ? '#9ca3af' : '#6b7280'}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotBtn} onPress={() => navigation.navigate('Forgot')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: inputBorder }]} />
            <Text style={[styles.dividerText, { color: isDark ? '#4b5563' : '#9ca3af' }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: inputBorder }]} />
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={[styles.googleBtn, { borderColor: inputBorder }]}
            onPress={handleGoogleLogin}
          >
            <Text style={[styles.googleBtnText, { color: textColor }]}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={{ color: subText }}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupText}>Sign up</Text>
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
  forgotBtn: {
    alignSelf: 'center',
    marginVertical: 12,
  },
  forgotText: {
    color: '#808bf5',
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  googleBtn: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  googleBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  signupText: {
    color: '#808bf5',
    fontWeight: 'bold',
  },
});
