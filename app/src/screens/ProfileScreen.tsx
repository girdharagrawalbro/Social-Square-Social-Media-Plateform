import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import useAuthStore from '../store/zustand/useAuthStore';
import BottomNav from './components/BottomNav';

const { width } = Dimensions.get('window');
const gridWidth = (width - 40) / 3;

export default function ProfileScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuthStore();

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';

  const userPosts = [
    { id: '1', url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=300' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={[styles.profileCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Image
            source={{
              uri: user?.profile_picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            }}
            style={styles.avatar}
          />
          <Text style={[styles.fullname, { color: textColor }]}>{user?.fullname || 'Alex Rivera'}</Text>
          <Text style={[styles.username, { color: subText }]}>@{user?.username || 'alex_square'}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: textColor }]}>1</Text>
              <Text style={[styles.statLabel, { color: subText }]}>Posts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: textColor }]}>248</Text>
              <Text style={[styles.statLabel, { color: subText }]}>Followers</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: textColor }]}>182</Text>
              <Text style={[styles.statLabel, { color: subText }]}>Following</Text>
            </View>
          </View>
        </View>

        {/* User Post Gallery Section */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>My Posts</Text>
        <View style={styles.grid}>
          {userPosts.map((post) => (
            <Image key={post.id} source={{ uri: post.url }} style={styles.gridImage} />
          ))}
        </View>
      </ScrollView>

      <BottomNav currentTab="profile" navigation={navigation} />
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
  profileCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    marginBottom: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 12,
  },
  fullname: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
    paddingTop: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridImage: {
    width: gridWidth,
    height: gridWidth,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
});
