import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';

export default function WikiDetailScreen() {
  const isDark = useColorScheme() === 'dark';
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);

  const { slug } = route.params || {};

  const [wiki, setWiki] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contributeModalVisible, setContributeModalVisible] = useState(false);
  
  // User's own posts for suggestion
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [loadingMyPosts, setLoadingMyPosts] = useState(false);
  const [submittingContribute, setSubmittingContribute] = useState<string | null>(null);

  const fetchWikiDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/knowledge/wiki/${slug}`);
      if (res.data?.success) {
        setWiki(res.data.wiki);
      }
    } catch (err) {
      console.warn('Failed to fetch wiki details:', err);
      Alert.alert('Error', 'Failed to load article details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchMyPosts = async () => {
    if (!user?._id) return;
    setLoadingMyPosts(true);
    try {
      const res = await api.get(`/api/recommendation/posts?userId=${user._id}`);
      const posts = res.data.posts || res.data.items || res.data || [];
      // Filter out posts that are already suggested
      const existingIds = new Set((wiki?.topPosts || []).map((p: any) => p._id));
      const filtered = posts.filter((p: any) => !existingIds.has(p._id));
      setMyPosts(filtered);
    } catch (err) {
      console.warn('Failed to fetch my posts:', err);
    } finally {
      setLoadingMyPosts(false);
    }
  };

  useEffect(() => {
    fetchWikiDetails();
  }, [slug]);

  useEffect(() => {
    if (contributeModalVisible) {
      fetchMyPosts();
    }
  }, [contributeModalVisible]);

  const handleContribute = async (postId: string) => {
    setSubmittingContribute(postId);
    try {
      const res = await api.post(`/api/knowledge/wiki/${slug}/contribute`, { postId });
      if (res.data?.success) {
        Alert.alert('Suggested', 'Your post has been suggested for this wiki article!');
        setContributeModalVisible(false);
        fetchWikiDetails();
      }
    } catch (err: any) {
      Alert.alert('Suggestion Failed', err.response?.data?.error || 'Failed to submit post suggestion.');
    } finally {
      setSubmittingContribute(null);
    }
  };

  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#121212' : '#f9fafb';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const modalOverlay = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#808bf5" />
          <Text style={[styles.loadingText, { color: subText }]}>Loading wiki details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
          {wiki?.topic || 'Wiki Article'}
        </Text>
        <TouchableOpacity onPress={() => setContributeModalVisible(true)} style={styles.headerRightBtn}>
          <MaterialCommunityIcons name="plus-circle-outline" size={24} color="#808bf5" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Description Banner */}
        <View style={[styles.banner, { backgroundColor: cardBg }]}>
          <Text style={[styles.bannerTitle, { color: textColor }]}>{wiki?.topic}</Text>
          <Text style={[styles.bannerDesc, { color: subText }]}>{wiki?.description}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="eye-outline" size={16} color={subText} />
              <Text style={[styles.metaVal, { color: subText }]}>{wiki?.viewCount || 0} views</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="account-edit-outline" size={16} color={subText} />
              <Text style={[styles.metaVal, { color: subText }]}>{wiki?.contributors?.length || 0} contributors</Text>
            </View>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          <Text style={[styles.bodyText, { color: textColor }]}>{wiki?.content}</Text>
        </View>

        {/* Top Community Posts */}
        {wiki?.topPosts && wiki.topPosts.length > 0 && (
          <View style={styles.topPostsSec}>
            <Text style={[styles.secTitle, { color: textColor }]}>Top Featured Posts</Text>
            {wiki.topPosts.map((post: any) => (
              <TouchableOpacity
                key={post._id}
                style={[styles.postCard, { backgroundColor: cardBg, borderColor: border }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PostDetail', { postId: post._id })}
              >
                <View style={styles.postCardContent}>
                  <View style={styles.postAvatarWrapper}>
                    {post.user?.profile_picture ? (
                      <Image source={{ uri: post.user.profile_picture }} style={styles.postAvatar} />
                    ) : (
                      <View style={styles.postAvatarFallback}>
                        <Text style={styles.postAvatarInit}>
                          {(post.user?.fullname || 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.postUserName, { color: textColor }]}>
                      {post.user?.fullname || 'Social Square User'}
                    </Text>
                    <Text style={[styles.postCaption, { color: subText }]} numberOfLines={2}>
                      {post.caption || 'No caption'}
                    </Text>
                    <Text style={[styles.postScore, { color: '#808bf5' }]}>
                      🔥 Score: {post.wikiScore || 0}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Contribute Modal */}
      <Modal
        visible={contributeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setContributeModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Suggest Your Post</Text>
              <TouchableOpacity onPress={() => setContributeModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            {loadingMyPosts ? (
              <ActivityIndicator color="#808bf5" style={{ marginVertical: 40 }} />
            ) : myPosts.length === 0 ? (
              <View style={styles.modalEmpty}>
                <MaterialCommunityIcons name="image-multiple-outline" size={48} color={subText} />
                <Text style={[styles.modalEmptyText, { color: subText }]}>
                  No posts found to suggest.
                </Text>
              </View>
            ) : (
              <FlatList
                data={myPosts}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <View style={[styles.myPostItem, { borderBottomColor: border }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.myPostCaption, { color: textColor }]} numberOfLines={2}>
                        {item.caption || 'Image post'}
                      </Text>
                      <Text style={[styles.myPostMeta, { color: subText }]}>
                        ❤️ {item.likes?.length || 0} likes
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleContribute(item._id)}
                      disabled={submittingContribute !== null}
                      style={styles.myPostSuggestBtn}
                    >
                      {submittingContribute === item._id ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.myPostSuggestBtnText}>Suggest</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    maxWidth: '70%',
  },
  headerRightBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  banner: {
    padding: 20,
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  bannerDesc: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '600',
  },
  contentBody: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  topPostsSec: {
    paddingHorizontal: 20,
  },
  secTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  postCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  postCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAvatarWrapper: {
    marginRight: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#808bf520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarInit: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#808bf5',
  },
  postUserName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  postCaption: {
    fontSize: 11,
    marginTop: 2,
  },
  postScore: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 13,
    marginTop: 12,
  },
  myPostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  myPostCaption: {
    fontSize: 13,
    fontWeight: '600',
  },
  myPostMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  myPostSuggestBtn: {
    backgroundColor: '#808bf5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  myPostSuggestBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
