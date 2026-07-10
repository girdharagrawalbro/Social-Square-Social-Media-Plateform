import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import BottomNav from './components/BottomNav';

// Mock pulse items
const activities = [
  {
    id: '1',
    user: 'Sarah Connor',
    action: 'liked your post about React Native',
    time: '2 mins ago',
    icon: 'heart',
    color: '#ef4444',
  },
  {
    id: '2',
    user: 'David Miller',
    action: 'joined the SS community developer circle',
    time: '15 mins ago',
    icon: 'account-plus',
    color: '#10b981',
  },
  {
    id: '3',
    user: 'System Notification',
    action: 'A new announcement has been published by Admin',
    time: '1 hour ago',
    icon: 'bell-outline',
    color: '#3b82f6',
  },
];

export default function PulseScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Pulse Activity</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activities.map((activity) => (
          <View
            key={activity.id}
            style={[styles.activityCard, { backgroundColor: cardBg, borderColor: border }]}
          >
            <View style={[styles.iconBg, { backgroundColor: `${activity.color}20` }]}>
              <MaterialCommunityIcons name={activity.icon} size={22} color={activity.color} />
            </View>

            <View style={styles.content}>
              <Text style={[styles.actionText, { color: textColor }]}>
                <Text style={styles.boldText}>{activity.user}</Text> {activity.action}
              </Text>
              <Text style={[styles.timeText, { color: subText }]}>{activity.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <BottomNav currentTab="pulse" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 11,
  },
});
