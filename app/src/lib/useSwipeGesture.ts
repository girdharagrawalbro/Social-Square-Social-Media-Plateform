import { useRef } from 'react';
import { Animated, PanResponder, PanResponderGestureState } from 'react-native';

interface UseSwipeGestureOptions {
  /** Below this |dx| (and the default dx-vs-dy ratio check), the gesture isn't claimed —
   * lets taps and vertical scrolls underneath pass through untouched. Ignored if `shouldActivate` is set. */
  activationThreshold?: number;
  /** Override the default "mostly-horizontal drag past activationThreshold" activation check entirely. */
  shouldActivate?: (gestureState: PanResponderGestureState) => boolean;
  /** |dx| past which a release commits in that direction. */
  commitThreshold: number;
  /** |vx| past which a release commits even under commitThreshold. Omit to make this distance-only. */
  commitVelocity?: number;
  /** Reshape the raw dx before it's written to the returned Animated.Value — e.g. rubber-banding
   * at an edge, or capping to one direction only. Identity if omitted. */
  transformDx?: (dx: number, gestureState: PanResponderGestureState) => number;
  onGrant?: () => void;
  /** Released past commitThreshold with dx > 0. Omit to make rightward swipes a no-op (cancel). */
  onCommitPositive?: (gestureState: PanResponderGestureState) => void;
  /** Released past commitThreshold with dx < 0. Omit to make leftward swipes a no-op (cancel). */
  onCommitNegative?: (gestureState: PanResponderGestureState) => void;
  /** Didn't commit (threshold not crossed, or the gesture was interrupted). Defaults to
   * springing the returned Animated.Value back to 0 — pass this to also run your own logic. */
  onCancel?: () => void;
  springConfig?: Partial<Animated.SpringAnimationConfig>;
}

/**
 * The "drag past a threshold to commit an action, else spring back" gesture shared by
 * MainTabsScreen's tab paging and ChatPaneScreen's swipe-to-reply — previously two
 * independent PanResponder implementations with the same shape (detect a mostly-
 * horizontal drag, track it on an Animated.Value, decide commit-vs-cancel on release
 * by distance/velocity). Both now build on this.
 *
 * Deliberately NOT used by StoryViewer (a single gesture recognizing FOUR directions
 * with async business logic embedded in the release handler — forcing it through a
 * single-axis commit/cancel primitive would need as many escape hatches as it saved),
 * ZoomableImage (pinch-to-zoom, a different gesture family entirely), or
 * ImageCropperModal/BeforeAfterView/PostItem's scrub bar (direct-manipulation dragging
 * to an absolute position, not a threshold-commit swipe) — none of those actually share
 * this shape, despite all being built on PanResponder.
 */
export function useSwipeGesture({
  activationThreshold = 10,
  shouldActivate,
  commitThreshold,
  commitVelocity = Infinity,
  transformDx,
  onGrant,
  onCommitPositive,
  onCommitNegative,
  onCancel,
  springConfig,
}: UseSwipeGestureOptions) {
  const dragX = useRef(new Animated.Value(0)).current;

  const springBack = () => {
    Animated.spring(dragX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 60,
      ...springConfig,
    }).start();
  };

  const settle = () => {
    if (onCancel) onCancel();
    else springBack();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, g) =>
        shouldActivate
          ? shouldActivate(g)
          : Math.abs(g.dx) > activationThreshold && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
      onPanResponderGrant: () => {
        onGrant?.();
      },
      onPanResponderMove: (_evt, g) => {
        dragX.setValue(transformDx ? transformDx(g.dx, g) : g.dx);
      },
      onPanResponderRelease: (_evt, g) => {
        const passedThreshold = Math.abs(g.dx) > commitThreshold || Math.abs(g.vx) > commitVelocity;
        if (passedThreshold && g.dx < 0 && onCommitNegative) {
          onCommitNegative(g);
        } else if (passedThreshold && g.dx > 0 && onCommitPositive) {
          onCommitPositive(g);
        } else {
          settle();
        }
      },
      onPanResponderTerminate: () => {
        settle();
      },
    })
  ).current;

  return { panResponder, dragX, springBack };
}
