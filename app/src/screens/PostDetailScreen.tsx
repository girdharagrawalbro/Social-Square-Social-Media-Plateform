import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api, BASE_URL } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';
import { PostItem } from './components/PostItem';
import { PostSkeleton } from './components/SkeletonLoader';

interface Comment {
  _id: string;
  user: {
    _id: string;
    fullname: string;
    profile_picture?: string;
  };
  content: string;
  createdAt: string;
  likes?: string[];
  repliesList?: Comment[];
  parentId?: string | null;
  isBestAnswer?: boolean;
  isInsightful?: boolean;
}

export default function PostDetailScreen() {
  const isDark = useColorScheme() === 'dark';
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const loggedUser = useAuthStore((s) => s.user);
  const { postId } = route.params || {};

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Reply State
  const [replyingToComment, setReplyingToComment] = useState<Comment | null>(null);

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#808bf5';

  const fetchPostDetail = async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/post/detail/${postId}`);
      setPost(res.data);
    } catch (e: any) {
      console.warn('Failed to load post detail:', e);
      if (e.response?.status === 403) {
        Alert.alert('Private Account', 'This account is private. Follow this user to see their posts.');
      } else {
        Alert.alert('Error', 'This post might have been deleted or is no longer accessible.');
      }
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!postId) return;
    try {
      setCommentsLoading(true);
      const res = await api.get(`/api/post/comments`, { params: { postId } });
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.warn('Failed to fetch comments:', e);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    fetchPostDetail();
    fetchComments();
  }, [postId]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !postId) return;
    setSubmittingComment(true);
    try {
      const payload: any = {
        postId,
        content: commentText.trim(),
        user: {
          _id: loggedUser?._id,
          fullname: loggedUser?.fullname,
          profile_picture: loggedUser?.profile_picture,
        },
      };
      if (replyingToComment) {
        payload.parentId = replyingToComment._id;
      }

      await api.post('/api/post/comments/add', payload);
      setCommentText('');
      setReplyingToComment(null);
      // Reload comments
      fetchComments();
    } catch (e) {
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const renderCommentItem = (comment: Comment, isReply = false) => {
    return (
      <View key={comment._id} style={[styles.commentContainer, isReply && styles.replyContainer]}>
        <Image
          source={{
            uri: comment.user?.profile_picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80',
          }}
          style={isReply ? styles.replyAvatar : styles.commentAvatar}
        />
        <View style={styles.commentContentWrapper}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentUser, { color: textColor }]}>
              {comment.user?.fullname || 'User'}
            </Text>
            <Text style={[styles.commentTime, { color: subText }]}>
              {formatTime(comment.createdAt)}
            </Text>
          </View>
          
          <Text style={[styles.commentText, { color: textColor }]}>
            {comment.content}
          </Text>

          {/* Comment Badges */}
          <View style={styles.badgeRow}>
            {comment.isBestAnswer && (
              <View style={styles.bestAnswerBadge}>
                <MaterialCommunityIcons name="check-decagram" size={12} color="#ffffff" />
                <Text style={styles.badgeText}>Best Answer</Text>
              </View>
            )}
            {comment.isInsightful && (
              <View style={styles.insightfulBadge}>
                <MaterialCommunityIcons name="lightbulb-on" size={12} color="#ffffff" />
                <Text style={styles.badgeText}>Insightful</Text>
              </View>
            )}
          </View>

          {/* Comment Action Links */}
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={() => setReplyingToComment(comment)}>
              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: 'bold' }}>Reply</Text>
            </TouchableOpacity>
          </View>

          {/* Recursively Render Child Replies */}
          {comment.repliesList && comment.repliesList.map(reply => renderCommentItem(reply, true))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Post Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {loading ? (
          <View style={{ flex: 1, padding: 12 }}>
            <PostSkeleton />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {post && <PostItem post={post} isDark={isDark} isVisible={true} />}

            {/* Comments Header */}
            <View style={[styles.sectionHeader, { borderBottomColor: border }]}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Comments ({comments.length})
              </Text>
            </View>

            {commentsLoading && comments.length === 0 ? (
              <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 20 }} />
            ) : comments.length === 0 ? (
              <View style={styles.noComments}>
                <MaterialCommunityIcons name="comment-text-multiple-outline" size={40} color={subText} />
                <Text style={{ color: subText, marginTop: 8, fontSize: 14 }}>
                  No comments yet. Start the discussion!
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {comments.map(c => renderCommentItem(c))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Reply Bar Overlay */}
        {replyingToComment && (
          <View style={[styles.replyBar, { backgroundColor: isDark ? '#1e1e2f' : '#e2e8f0', borderColor: border }]}>
            <Text style={{ color: textColor, fontSize: 12, flex: 1 }} numberOfLines={1}>
              Replying to <Text style={{ fontWeight: 'bold' }}>{replyingToComment.user?.fullname}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyingToComment(null)}>
              <MaterialCommunityIcons name="close-circle" size={18} color={subText} />
            </TouchableOpacity>
          </View>
        )}

        {/* Comment Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: cardBg, borderTopColor: border }]}>
          <TextInput
            placeholder={replyingToComment ? "Write a reply..." : "Write a comment..."}
            placeholderTextColor={subText}
            style={[styles.input, { color: textColor, backgroundColor: isDark ? '#1a1a2e' : '#f8fafc', borderColor: border }]}
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: commentText.trim() ? primaryColor : (isDark ? '#27273a' : '#e2e8f0') }]}
            disabled={!commentText.trim() || submittingComment}
            onPress={handleAddComment}
          >
            {submittingComment ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color={commentText.trim() ? "#ffffff" : subText} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
    borderBottomWidth: 1,
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
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  noComments: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  commentContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  replyContainer: {
    marginTop: 12,
    marginLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(128,139,245,0.2)',
    paddingLeft: 12,
    marginBottom: 4,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  commentContentWrapper: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  commentTime: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  bestAnswerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  insightfulBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  inputBar: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
