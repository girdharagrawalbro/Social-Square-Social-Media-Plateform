import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, useColorScheme } from 'react-native';

const MOODS = [
  { key: 'happy', emoji: '😊', label: 'Happy' },
  { key: 'excited', emoji: '🤩', label: 'Excited' },
  { key: 'funny', emoji: '😂', label: 'Funny' },
  { key: 'romantic', emoji: '❤️', label: 'Romantic' },
  { key: 'inspirational', emoji: '💪', label: 'Inspire' },
  { key: 'calm', emoji: '😌', label: 'Calm' },
  { key: 'nostalgic', emoji: '🥹', label: 'Nostalgia' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
];

interface MoodFeedToggleProps {
  activeMood: string | null;
  onMoodSelect: (mood: string) => void;
  onClear: () => void;
}

export default function MoodFeedToggle({ activeMood, onMoodSelect, onClear }: MoodFeedToggleProps) {
  const isDark = useColorScheme() === 'dark';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {MOODS.map((mood) => {
        const isActive = activeMood === mood.key;
        return (
          <TouchableOpacity
            key={mood.key}
            onPress={() => (isActive ? onClear() : onMoodSelect(mood.key))}
            style={[
              styles.moodBtn,
              {
                backgroundColor: isActive
                  ? '#808bf5'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : '#f1f5f9',
                borderColor: isActive
                  ? '#808bf5'
                  : isDark
                  ? '#1a1a1a'
                  : '#e2e8f0',
              },
            ]}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
            <Text
              style={[
                styles.label,
                { color: isActive ? '#ffffff' : isDark ? '#f1f5f9' : '#0f172a' },
              ]}
            >
              {mood.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    maxHeight: 56,
  },
  contentContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  moodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 14,
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
