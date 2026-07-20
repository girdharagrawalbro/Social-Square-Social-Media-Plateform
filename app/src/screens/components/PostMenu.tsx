import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../../lib/api';
import useAuthStore from '../../store/zustand/useAuthStore';

interface PostMenuProps {
  visible: boolean;
  onClose: () => void;
  post: any;
  isSaved?: boolean;
  onToggleSave?: (saved: boolean) => void;
  onDeleteSuccess?: () => void;
  onEditPress?: () => void;
  onMuteBlockSuccess?: () => void;
}

export default function PostMenu({
  visible,
  onClose,
  post,
  isSaved = false,
  onToggleSave,
  onDeleteSuccess,
  onEditPress,
  onMuteBlockSuccess,
}: PostMenuProps) {
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuthStore() as any;
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Theme colors
  const cardBg = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const border = isDark ? '#2a2a3e' : '#e2e8f0';

  if (!post) return null;

  const isOwner = post.user?._id === user?._id || post.user?._id?.toString() === user?._id;

  const handleSave = async () => {
    setLoadingAction('save');
    try {
      const res = await api.post('/api/post/save', { postId: post._id });
      const newSavedState = res.data.saved;
      if (onToggleSave) onToggleSave(newSavedState);
      Alert.alert('Success', newSavedState ? 'Post bookmarked!' : 'Post unsaved.');
      onClose();
    } catch (e: any) {
      console.warn('[PostMenu] Save error:', e);
      Alert.alert('Error', 'Failed to update bookmark.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveToKnowledge = async (type: 'note' | 'learning') => {
    setLoadingAction('knowledge');
    try {
      await api.post('/api/knowledge/save', {
        postId: post._id,
        type,
        title: post.caption?.substring(0, 30) || 'Saved Post',
        content: post.caption || '',
      });
      Alert.alert('Saved', `Added to your knowledge base as a ${type}!`);
      onClose();
    } catch (e: any) {
      if (e.response?.status === 409) {
        Alert.alert('Already Saved', 'This post is already in your knowledge base.');
      } else {
        console.warn('[PostMenu] Knowledge save error:', e);
        Alert.alert('Error', 'Failed to save to knowledge base.');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to permanently delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction('delete');
            try {
              await api.delete(`/api/post/${post._id}`);
              Alert.alert('Deleted', 'Post deleted successfully.');
              if (onDeleteSuccess) onDeleteSuccess();
              onClose();
            } catch (e) {
              console.warn('[PostMenu] Delete error:', e);
              Alert.alert('Error', 'Failed to delete post.');
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  const handleInterest = async (action: 'interested' | 'not_interested') => {
    setLoadingAction(action);
    try {
      await api.post('/api/recommendation/activity', { postId: post._id, action });
      Alert.alert(
        'Preference Saved',
        action === 'interested'
          ? 'We will show you more posts like this.'
          : 'We will show you fewer posts like this.'
      );
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to register preference.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMute = () => {
    if (post.isAnonymous || !post.user?._id) return;
    const isMuted = user?.mutedUsers?.some((m: any) => m?.toString() === post.user?._id?.toString());

    if (isMuted) {
      Alert.alert('Muted', 'You have already muted this user.');
      return;
    }

    Alert.alert(
      'Mute User',
      `Are you sure you want to mute ${post.user.fullname || 'this user'}? Their posts will be hidden from your feed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mute',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction('mute');
            try {
              await api.post('/api/auth/mute', { targetUserId: post.user._id });
              Alert.alert('Muted', 'User muted successfully.');
              if (onMuteBlockSuccess) onMuteBlockSuccess();
              onClose();
            } catch (e) {
              Alert.alert('Error', 'Failed to mute user.');
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  const handleBlock = () => {
    if (post.isAnonymous || !post.user?._id) return;
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${post.user.fullname || 'this user'}? They will not be able to interact with you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction('block');
            try {
              await api.post('/api/auth/block', { targetUserId: post.user._id });
              Alert.alert('Blocked', 'User blocked successfully.');
              if (onMuteBlockSuccess) onMuteBlockSuccess();
              onClose();
            } catch (e) {
              Alert.alert('Error', 'Failed to block user.');
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  const handleReport = () => {
    Alert.alert(
      'Report Post',
      'Choose a reason for reporting this post:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Inappropriate Content',
          onPress: () => submitReport('Inappropriate Content'),
        },
        {
          text: 'Harassment or Spam',
          onPress: () => submitReport('Harassment or Spam'),
        },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    setLoadingAction('report');
    try {
      await api.post('/api/moderation/report', { postId: post._id, reason });
      Alert.alert('Thank you', 'Report submitted successfully.');
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit report.');
    } finally {
      setLoadingAction(null);
    }
  };

  const showSaveToKnowledgeDialog = () => {
    Alert.alert(
      'Save to Knowledge',
      'Would you like to save this as a general note or a learning entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Note 📝', onPress: () => handleSaveToKnowledge('note') },
        { text: 'Learning 💡', onPress: () => handleSaveToKnowledge('learning') },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.content, { backgroundColor: cardBg }]}>
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: isDark ? '#2e2e4e' : '#e2e8f0' }]} />

          {/* Action rows */}
          <View style={styles.optionsWrapper}>
            {/* Bookmark option */}
            <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={handleSave}>
              <MaterialCommunityIcons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={isSaved ? '#808bf5' : textColor}
              />
              <Text style={[styles.optionText, { color: textColor }]}>
                {isSaved ? 'Unsave Post' : 'Save Post'}
              </Text>
              {loadingAction === 'save' && <ActivityIndicator size="small" color="#808bf5" />}
            </TouchableOpacity>

            {/* Save to Knowledge */}
            <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={showSaveToKnowledgeDialog}>
              <MaterialCommunityIcons name="book-open-page-variant-outline" size={22} color="#10b981" />
              <Text style={[styles.optionText, { color: textColor }]}>Save to Knowledge Base</Text>
              {loadingAction === 'knowledge' && <ActivityIndicator size="small" color="#10b981" />}
            </TouchableOpacity>

            {isOwner ? (
              <>
                {/* Edit Post */}
                {onEditPress && (
                  <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={() => { onClose(); onEditPress(); }}>
                    <MaterialCommunityIcons name="pencil-outline" size={22} color={textColor} />
                    <Text style={[styles.optionText, { color: textColor }]}>Edit Caption</Text>
                  </TouchableOpacity>
                )}

                {/* Delete Post */}
                <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={handleDelete}>
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color="#ef4444" />
                  <Text style={[styles.optionText, { color: '#ef4444' }]}>Delete Post</Text>
                  {loadingAction === 'delete' && <ActivityIndicator size="small" color="#ef4444" />}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Interested */}
                <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={() => handleInterest('interested')}>
                  <MaterialCommunityIcons name="thumb-up-outline" size={22} color="#22c55e" />
                  <Text style={[styles.optionText, { color: textColor }]}>Interested</Text>
                  {loadingAction === 'interested' && <ActivityIndicator size="small" color="#22c55e" />}
                </TouchableOpacity>

                {/* Not Interested */}
                <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={() => handleInterest('not_interested')}>
                  <MaterialCommunityIcons name="thumb-down-outline" size={22} color="#f97316" />
                  <Text style={[styles.optionText, { color: textColor }]}>Not Interested</Text>
                  {loadingAction === 'not_interested' && <ActivityIndicator size="small" color="#f97316" />}
                </TouchableOpacity>

                {/* Mute User */}
                {!post.isAnonymous && post.user?._id && (
                  <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={handleMute}>
                    <MaterialCommunityIcons name="volume-off" size={22} color={textColor} />
                    <Text style={[styles.optionText, { color: textColor }]}>Mute User</Text>
                    {loadingAction === 'mute' && <ActivityIndicator size="small" color={textColor} />}
                  </TouchableOpacity>
                )}

                {/* Block User */}
                {!post.isAnonymous && post.user?._id && (
                  <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={handleBlock}>
                    <MaterialCommunityIcons name="ban" size={22} color="#ef4444" />
                    <Text style={[styles.optionText, { color: '#ef4444' }]}>Block User</Text>
                    {loadingAction === 'block' && <ActivityIndicator size="small" color="#ef4444" />}
                  </TouchableOpacity>
                )}

                {/* Report Post */}
                <TouchableOpacity style={[styles.optionRow, { borderBottomColor: border }]} onPress={handleReport}>
                  <MaterialCommunityIcons name="flag-outline" size={22} color="#ef4444" />
                  <Text style={[styles.optionText, { color: '#ef4444' }]}>Report Post</Text>
                  {loadingAction === 'report' && <ActivityIndicator size="small" color="#ef4444" />}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 35,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 20,
  },
  optionsWrapper: {
    gap: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 15,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
