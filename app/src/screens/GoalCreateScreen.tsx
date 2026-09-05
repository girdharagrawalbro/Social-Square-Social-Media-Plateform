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
import useAuthStore from '../store/zustand/useAuthStore';
import { useQueryClient } from '@tanstack/react-query';
import { toast as Toast } from '../lib/CustomToast';

export default function GoalCreateScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const bg = isDark ? '#000000' : '#ffffff';
  const inputBg = isDark ? '#1f2937' : '#f3f4f6';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';

  const handleCreate = async () => {
    if (!title.trim()) {
      Toast.error('Title is required', 'Validation Error');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/goal/create', {
        title: title.trim(),
        description: description.trim(),
        targetDate: targetDate || undefined,
        isPrivate,
      });
      Toast.success('Goal Created!');
      queryClient.invalidateQueries({ queryKey: ['goals', user?._id] });
      navigation.goBack();
    } catch (err: any) {
      Toast.error(err.response?.data?.error || 'Failed to create goal', 'Error');
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
        <Text style={[styles.headerTitle, { color: textColor }]}>Create Goal</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content}>
          <Text style={[styles.label, { color: textColor }]}>Goal Title *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
            placeholder="e.g. Learn React Native"
            placeholderTextColor={subText}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={[styles.label, { color: textColor }]}>Description (Optional)</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: inputBg, color: textColor }]}
            placeholder="What steps will you take?"
            placeholderTextColor={subText}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={[styles.label, { color: textColor }]}>Target Date (Optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={subText}
            value={targetDate}
            onChangeText={setTargetDate}
          />

          <TouchableOpacity 
            style={styles.toggleRow} 
            activeOpacity={0.7}
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: textColor }]}>Private Goal</Text>
              <Text style={[styles.toggleDesc, { color: subText }]}>
                Only you can see this goal.
              </Text>
            </View>
            <MaterialCommunityIcons 
              name={isPrivate ? "toggle-switch" : "toggle-switch-off-outline"} 
              size={40} 
              color={isPrivate ? '#808bf5' : subText} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>
              {loading ? 'Creating...' : 'Create Goal'}
            </Text>
          </TouchableOpacity>
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
  content: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 15 },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 30,
  },
  toggleTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  toggleDesc: { fontSize: 13 },
  submitBtn: {
    backgroundColor: '#808bf5',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
