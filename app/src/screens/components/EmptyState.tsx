import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, spacing, radius, typography } from '../../theme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared empty/error state — every screen used to hand-roll its own icon+text
 * block with its own copy tone, and errors mostly just left stale/blank UI with
 * no way to recover short of leaving the screen. This gives every screen the
 * same look and, when `onAction` is passed, an actual way out.
 */
export function EmptyState({ icon = 'inbox-outline', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon} size={48} color={colors.text.muted} />
      <Text style={[styles.title, { color: colors.text.secondary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.text.muted }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: colors.primary }]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionText, { color: colors.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Same shape, defaults tuned for "the request failed" rather than "nothing here yet". */
export function ErrorState({
  title = "Something went wrong.",
  subtitle = "Please try again.",
  actionLabel = 'Retry',
  onAction,
}: Partial<EmptyStateProps> & { onAction: () => void }) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title={title}
      subtitle={subtitle}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  actionBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  actionText: {
    ...typography.body,
    fontWeight: '700',
  },
});
