import React, { useState } from 'react';
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
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../store/zustand/useAuthStore';
import BottomNav from './components/BottomNav';
import { api } from '../lib/api';

const { width } = Dimensions.get('window');
const gridWidth = (width - 40) / 3;

export default function ProfileScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const { user, logout, setUser } = useAuthStore();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/api/conversation/notifications');
      const notifications = res.data.notifications || res.data || [];
      const count = notifications.filter((n: any) => !n.read).length;
      setUnreadNotificationsCount(count);
    } catch (e) {
      console.warn('Failed to fetch unread notifications count:', e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount();
    }, [])
  );

  const [profileData, setProfileData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Edit Profile States
  const [editVisible, setEditVisible] = useState(false);
  const [fullnameInput, setFullnameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [profilePicInput, setProfilePicInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfileInfo = async () => {
    try {
      const profileRes = await api.get('/api/auth/me');
      const userObj = profileRes.data;
      setProfileData(userObj);
      
      const postsRes = await api.get(`/api/post/user/${userObj._id}`);
      setPosts(postsRes.data.posts || postsRes.data || []);
      
      const contributionsRes = await api.get(`/api/auth/users/${userObj._id}/contributions`);
      setContributions(contributionsRes.data.contributions || {});
    } catch (err) {
      console.warn('Failed to load profile info:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount();
      fetchProfileInfo();
    }, [])
  );

  const handleSaveProfile = async () => {
    if (!fullnameInput.trim() || !usernameInput.trim()) {
      Alert.alert('Validation Error', 'Full Name and Username cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await api.put('/api/auth/update-profile', {
        fullname: fullnameInput.trim(),
        username: usernameInput.trim(),
        bio: bioInput.trim(),
        profile_picture: profilePicInput.trim() || undefined,
      });
      setUser(res.data.user || res.data);
      Alert.alert('Success', 'Profile updated successfully!');
      setEditVisible(false);
      fetchProfileInfo();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#808bf5';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        {/* Left Side: Plus Icon */}
        <TouchableOpacity onPress={() => navigation.navigate('NewPost')} style={styles.headerLeftBtn}>
          <MaterialCommunityIcons name="plus" size={26} color={textColor} />
        </TouchableOpacity>

        {/* Center: Title */}
        <Text style={[styles.headerTitle, { color: textColor }]}>Profile</Text>

        {/* Right Side: Bell & Hamburger */}
        <View style={styles.headerRightGroup}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.headerRightBtn}>
            <View style={styles.badgeWrapper}>
              {unreadNotificationsCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadNotificationsCount}</Text>
                </View>
              )}
              <MaterialCommunityIcons name="bell-outline" size={24} color="#808bf5" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Menu',
                'What would you like to do?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', onPress: () => { logout(); navigation.navigate('Login'); }, style: 'destructive' }
                ]
              );
            }}
            style={styles.headerRightBtn}
          >
            <MaterialCommunityIcons name="menu" size={26} color={textColor} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* User Card */}
          <View style={[styles.profileCard, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={{ position: 'relative', marginBottom: 12 }}>
              <Image
                source={{
                  uri: profileData?.profile_picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                }}
                style={styles.avatar}
              />
              <TouchableOpacity
                style={styles.editAvatarBtn}
                activeOpacity={0.9}
                onPress={() => {
                  setFullnameInput(profileData?.fullname || '');
                  setUsernameInput(profileData?.username || '');
                  setBioInput(profileData?.bio || '');
                  setProfilePicInput(profileData?.profile_picture || '');
                  setEditVisible(true);
                }}
              >
                <MaterialCommunityIcons name="pencil" size={14} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.fullname, { color: textColor }]}>{profileData?.fullname || 'Alex Rivera'}</Text>
            <Text style={[styles.username, { color: subText }]}>@{profileData?.username || 'alex_square'}</Text>
            {profileData?.bio ? (
              <Text style={[styles.bioText, { color: textColor }]} numberOfLines={3}>
                {profileData.bio}
              </Text>
            ) : null}

            {/* Level / Streak / XP Row */}
            <View style={styles.gamificationRow}>
              <View style={[styles.gamifyBadge, { backgroundColor: isDark ? '#1e1b4b' : '#e0e7ff', borderColor: '#818cf8' }]}>
                <Text style={styles.gamifyLabel}>LEVEL</Text>
                <Text style={[styles.gamifyVal, { color: '#6366f1' }]}>{profileData?.level || 1}</Text>
              </View>
              <View style={[styles.gamifyBadge, { backgroundColor: isDark ? '#2d1410' : '#ffedd5', borderColor: '#f97316' }]}>
                <Text style={styles.gamifyLabel}>STREAK</Text>
                <Text style={[styles.gamifyVal, { color: '#f97316' }]}>
                  {profileData?.streak?.count || 0} 🔥
                </Text>
              </View>
              <View style={[styles.gamifyBadge, { backgroundColor: isDark ? '#064e3b' : '#d1fae5', borderColor: '#10b981' }]}>
                <Text style={styles.gamifyLabel}>XP</Text>
                <Text style={[styles.gamifyVal, { color: '#10b981' }]}>{profileData?.xp || 0}</Text>
              </View>
            </View>

            {/* Detailed Statistics Cards */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', borderColor: border }]}>
                <Text style={[styles.statBoxNum, { color: textColor }]}>{profileData?.followersCount || 0}</Text>
                <Text style={[styles.statBoxLabel, { color: subText }]}>FOLLOWERS</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', borderColor: border }]}>
                <Text style={[styles.statBoxNum, { color: textColor }]}>{profileData?.followingCount || 0}</Text>
                <Text style={[styles.statBoxLabel, { color: subText }]}>FOLLOWING</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', borderColor: border }]}>
                <Text style={[styles.statBoxNum, { color: textColor }]}>{posts.length}</Text>
                <Text style={[styles.statBoxLabel, { color: subText }]}>POSTS</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', borderColor: border }]}>
                <Text style={[styles.statBoxNum, { color: textColor }]}>{profileData?.profileViews || 0}</Text>
                <Text style={[styles.statBoxLabel, { color: subText }]}>VIEWS</Text>
              </View>
            </View>
          </View>

          {/* Consistency Graph Card */}
          <View style={[styles.consistencyCard, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
              <MaterialCommunityIcons name="calendar-month" size={16} color="#808bf5" />
              <Text style={[styles.consistencyTitle, { color: textColor }]}>CONSISTENCY GRAPH</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
              {/* Render last 16 weeks of posting days */}
              {Array.from({ length: 16 }).map((_, wIdx) => {
                return (
                  <View key={wIdx} style={{ flexDirection: 'column', gap: 3 }}>
                    {Array.from({ length: 7 }).map((_, dIdx) => {
                      const targetDate = new Date();
                      targetDate.setDate(targetDate.getDate() - (15 - wIdx) * 7 - (6 - dIdx));
                      const dateStr = targetDate.toISOString().split('T')[0];
                      const count = contributions[dateStr] || 0;

                      let cellBg = isDark ? '#1e293b' : '#e2e8f0';
                      if (count === 1) cellBg = 'rgba(99, 102, 241, 0.35)';
                      else if (count === 2) cellBg = 'rgba(99, 102, 241, 0.65)';
                      else if (count > 2) cellBg = '#6366f1';

                      return (
                        <View
                          key={dIdx}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 1.5,
                            backgroundColor: cellBg
                          }}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>

          {/* User Post Gallery Section */}
          <Text style={[styles.sectionTitle, { color: textColor, marginTop: 10 }]}>My Posts</Text>
          {posts.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <MaterialCommunityIcons name="camera-off-outline" size={48} color={subText} />
              <Text style={{ color: subText, marginTop: 12, fontSize: 14 }}>No posts shared yet</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {posts.map((post) => (
                <Image key={post._id} source={{ uri: post.mediaUrl || post.image_urls?.[0] }} style={styles.gridImage} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Edit Profile Modal */}
      <Modal
        visible={editVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              <Text style={{ color: subText, fontSize: 12, fontWeight: 'bold' }}>Full Name</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: border, color: textColor }]}
                value={fullnameInput}
                onChangeText={setFullnameInput}
              />

              <Text style={{ color: subText, fontSize: 12, fontWeight: 'bold' }}>Username</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: border, color: textColor }]}
                value={usernameInput}
                onChangeText={setUsernameInput}
              />

              <Text style={{ color: subText, fontSize: 12, fontWeight: 'bold' }}>Bio</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: border, color: textColor }]}
                value={bioInput}
                onChangeText={setBioInput}
                multiline
                numberOfLines={3}
              />

              <Text style={{ color: subText, fontSize: 12, fontWeight: 'bold' }}>Profile Picture URL</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: border, color: textColor }]}
                value={profilePicInput}
                onChangeText={setProfilePicInput}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: border }]}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primaryColor }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1,
  },
  headerLeftBtn: {
    padding: 4,
    zIndex: 2,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    zIndex: 2,
  },
  headerRightBtn: {
    padding: 4,
  },
  badgeWrapper: {
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4b4b',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
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
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#808bf5',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  bioText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 18,
  },
  gamificationRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  gamifyBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  gamifyLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gamifyVal: {
    fontSize: 14,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  statBox: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  statBoxNum: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  consistencyCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  consistencyTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  saveBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
