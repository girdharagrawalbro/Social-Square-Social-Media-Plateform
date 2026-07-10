import React from 'react';
import { View, Text, StyleSheet, useColorScheme, Platform } from 'react-native';

export default function AppHeader({ title }: { title: string }) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: isDark ? '#121212' : '#ffffff',
          borderBottomColor: isDark ? '#1f2937' : '#e5e7eb',
        },
      ]}
    >
      <Text style={[styles.title, { color: isDark ? '#ffffff' : '#111827' }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 0, // React navigation handles safe area or AppHeader is inside SafeAreaView
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
