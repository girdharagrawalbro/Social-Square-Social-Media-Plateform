import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../lib/api';
import { toast as Toast } from '../lib/CustomToast';

export default function PasswordSecurityScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#121212' : '#f9fafb';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const inputBg = isDark ? '#1f2937' : '#f3f4f6';

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Toast.error('Current password is required', 'Error');
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.error('New passwords do not match', 'Error');
      return;
    }
    if (newPassword.length < 6) {
      Toast.error('Password must be at least 6 characters', 'Error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });
      Toast.success('Password changed successfully', 'Success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      navigation.goBack();
    } catch (err: any) {
      Toast.error(err.response?.data?.error || 'Failed to change password', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label: string, 
    value: string, 
    onChange: (t: string) => void, 
    placeholder: string,
    showPass: boolean,
    setShowPass: (val: boolean) => void
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: border }]}>
        <TextInput
          style={[styles.input, { color: textColor }]}
          placeholder={placeholder}
          placeholderTextColor={subText}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!showPass}
        />
        <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 10 }}>
          <MaterialCommunityIcons 
            name={showPass ? 'eye-off-outline' : 'eye-outline'} 
            size={20} 
            color={subText} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: bg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Password & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content}>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
              <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#808bf5" />
              <Text style={[styles.cardTitle, { color: textColor, marginLeft: 10 }]}>
                Change Password
              </Text>
            </View>

            {renderInput('Current Password', currentPassword, setCurrentPassword, 'Enter current password', showCurrent, setShowCurrent)}
            {renderInput('New Password', newPassword, setNewPassword, 'Enter new password', showNew, setShowNew)}
            {renderInput('Confirm New Password', confirmPassword, setConfirmPassword, 'Confirm new password', showNew, setShowNew)}

            <TouchableOpacity 
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>
                {loading ? 'Updating...' : 'Update Password'}
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#808bf5',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
