import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Post } from '../screens/components/PostItem';

/**
 * Every screen registered in App.tsx's Stack.Navigator, with the params each one
 * actually reads via `route.params`. Built by grepping every `navigation.navigate(...)`
 * call site against what the target screen destructures — not aspirational, this is
 * what the app already does. Two bugs turned up doing that cross-check:
 *   - ExploreScreen never read the `searchQuery` param PulseScreen was sending it
 *     (fixed alongside this).
 *   - Nothing else was found broken, but this table is now the thing that would catch
 *     the next one at compile time instead of at a bug report.
 */
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  VerifyOtp: { userId: string };
  Forgot: undefined;
  ResetPassword: { token?: string; email?: string } | undefined;
  SocialSquare: undefined;
  Chat: undefined;
  ChatPane:
    | {
        conversationId?: string;
        title?: string;
        recipientId?: string;
        recipientAvatar?: string;
        isGroup?: boolean;
      }
    | undefined;
  Explore: { searchQuery?: string } | undefined;
  Reels: { posts?: Post[]; initialIndex?: number } | undefined;
  Pulse: undefined;
  Knowledge: undefined;
  Profile: { userId?: string } | undefined;
  Notifications: undefined;
  NewPost: undefined;
  PostDetail: { postId: string; posts?: Post[]; initialIndex?: number };
  HashtagResults: { tag: string };
  NotificationSettings: undefined;
  ActiveSessions: undefined;
  CloseFriends: undefined;
  Call: {
    conversationId?: string;
    recipientId?: string;
    recipientName?: string;
    recipientAvatar?: string;
    callerId?: string;
    callerName?: string;
    callerAvatar?: string;
    callType?: 'voice' | 'video';
    isIncoming?: boolean;
  };
  Chatbot: undefined;
  Communities: undefined;
  WikiDetail: { slug: string };
  CreatorInsights: undefined;
  GoalCreate: undefined;
  PasswordSecurity: undefined;
  Contact: undefined;
};

// Deliberately NOT parameterized by RouteName (defaults to `string`) — several
// screens (SocialSquare/Chat/Explore/Reels/Profile) are rendered two ways: as their
// own pushed Stack.Screen, and embedded as MainTabsScreen's tab content, which just
// forwards its own `navigation` object straight through. A RouteName-specific prop
// type would make that forwarding a type error every time the two routes differ.
export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Drop-in typed replacement for `useNavigation<any>()`. */
export function useAppNavigation() {
  return useNavigation<AppNavigationProp>();
}

/** Drop-in typed replacement for `useRoute<any>()` — pass the screen's own name. */
export function useAppRoute<T extends keyof RootStackParamList>() {
  return useRoute<RouteProp<RootStackParamList, T>>();
}

/** For screens that take `navigation`/`route` as props instead of via hooks. */
export type AppScreenProps<T extends keyof RootStackParamList> = {
  navigation: AppNavigationProp;
  route: RouteProp<RootStackParamList, T>;
};

/**
 * Same as AppScreenProps, but `route` is optional — for the handful of screens also
 * rendered as MainTabsScreen's embedded tab content, which never passes a `route`
 * prop down. Read `route?.params?.x` in these, never `route.params` unguarded.
 */
export type TabOrStackScreenProps<T extends keyof RootStackParamList> = {
  navigation: AppNavigationProp;
  route?: RouteProp<RootStackParamList, T>;
};
