import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../../lib/api';

interface SaveAsNoteModalProps {
  visible: boolean;
  post: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SaveAsNoteModal({ visible, post, onClose, onSaved }: SaveAsNoteModalProps) {
  const isDark = useColorScheme() === 'dark';
  const [type, setType] = useState<'note' | 'learning'>('note');
  const [annotation, setAnnotation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!post?._id) return;
    setLoading(true);
    try {
      await api.post('/api/knowledge/save', {
        postId: post._id,
        type,
        annotation,
      });
      Alert.alert(
        'Success',
        type === 'learning' ? '🎓 Saved as Learning Entry!' : '📝 Saved as Personal Note!'
      );
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409) {
        Alert.alert('Already Saved', 'This post is already in your knowledge base.');
      } else {
        Alert.alert('Error', 'Could not save to knowledge base. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark ? '#121212' : '#ffffff';
  const overlayBg = 'rgba(0,0,0,0.6)';
  const border = isDark ? '#1a1a1a' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subText = isDark ? '#94a3b8' : '#64748b';
  const previewBg = isDark ? 'rgba(128,139,245,0.08)' : 'rgba(128,139,245,0.05)';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
        <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: textColor }]}>Save to Knowledge</Text>
              <Text style={[styles.subtitle, { color: subText }]}>AI will summarise this post for you ✨</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? '#222222' : '#f1f5f9' }]}>
              <MaterialCommunityIcons name="close" size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Preview */}
          {post?.caption ? (
            <View style={[styles.previewContainer, { backgroundColor: previewBg, borderColor: 'rgba(128,139,245,0.2)' }]}>
              <Text style={[styles.previewText, { color: textColor }]} numberOfLines={2}>
                {post.caption}
              </Text>
            </View>
          ) : null}

          {/* Toggle Type */}
          <Text style={[styles.sectionTitle, { color: subText }]}>Save As</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              onPress={() => setType('note')}
              style={[
                styles.toggleBtn,
                { borderColor: type === 'note' ? '#808bf5' : border },
                type === 'note' && { backgroundColor: 'rgba(128,139,245,0.1)' },
              ]}
            >
              <Text style={[styles.toggleText, { color: type === 'note' ? '#808bf5' : textColor }]}>📝 Note</Text>
              <Text style={[styles.toggleDesc, { color: subText }]}>Quick reference</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setType('learning')}
              style={[
                styles.toggleBtn,
                { borderColor: type === 'learning' ? '#808bf5' : border },
                type === 'learning' && { backgroundColor: 'rgba(128,139,245,0.1)' },
              ]}
            >
              <Text style={[styles.toggleText, { color: type === 'learning' ? '#808bf5' : textColor }]}>🎓 Learning</Text>
              <Text style={[styles.toggleDesc, { color: subText }]}>Deep insight</Text>
            </TouchableOpacity>
          </View>

          {/* Annotation Input */}
          <Text style={[styles.sectionTitle, { color: subText }]}>Your Note (optional)</Text>
          <TextInput
            multiline
            numberOfLines={3}
            maxLength={500}
            value={annotation}
            onChangeText={setAnnotation}
            placeholder="Add your personal insight, why this matters to you..."
            placeholderTextColor={subText}
            style={[styles.input, { color: textColor, borderColor: border, backgroundColor: isDark ? '#000000' : '#f8fafc' }]}
          />
          <Text style={[styles.charCount, { color: subText }]}>{annotation.length}/500</Text>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onClose} style={[styles.actionBtn, styles.cancelBtn, { borderColor: border }]}>
              <Text style={[styles.actionBtnText, { color: subText }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={loading} style={[styles.actionBtn, styles.saveBtn]}>
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  saveBtn: {
    backgroundColor: '#808bf5',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
