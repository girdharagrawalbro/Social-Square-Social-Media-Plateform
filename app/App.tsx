import React, { useEffect } from 'react';
import * as RN from 'react-native';
import { StatusBar, StyleSheet, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme override — every screen in the app calls the real `useColorScheme()` from
// 'react-native', so overriding it for Settings' theme toggle has to go through RN's
// own Appearance module (Appearance.setColorScheme) rather than trying to intercept
// the hook: `useColorScheme()` is implemented as
// `useSyncExternalStore(Appearance.addChangeListener, Appearance.getColorScheme)`,
// so this is the one path guaranteed to reach every already-mounted consumer without
// touching each screen. (A previous attempt monkeypatched `RN.useColorScheme` via
// `import * as RN from 'react-native'` — but Babel's CommonJS interop wraps `import *`
// in a fresh per-file object, so that patch only ever mutated App.tsx's own private
// copy and never affected the dozens of screens that `import { useColorScheme }`
// directly, which is why the toggle had no visible effect anywhere.)
let currentThemeOverride: 'dark' | 'light' | null = null;

export const getThemeOverride = () => currentThemeOverride;
export const setThemeOverride = async (theme: 'dark' | 'light' | null) => {
  currentThemeOverride = theme;
  // 'unspecified' is Appearance's own spelling for "no override, follow the system".
  Appearance.setColorScheme(theme || 'unspecified');
  if (theme) {
    await AsyncStorage.setItem('theme_override', theme);
  } else {
    await AsyncStorage.removeItem('theme_override');
  }
};

// Re-apply the persisted override on cold start, before the first screen mounts.
AsyncStorage.getItem('theme_override').then((val) => {
  if (val === 'dark' || val === 'light') {
    currentThemeOverride = val;
    Appearance.setColorScheme(val);
  }
});
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAuthStore from './src/store/zustand/useAuthStore';
import { CustomToastContainer } from './src/lib/CustomToast';
import { PostHogProvider } from 'posthog-react-native';

import { POSTHOG_API_KEY, POSTHOG_HOST } from './src/lib/posthog';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/queryClient';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import ForgotScreen from './src/screens/ForgotScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import MainTabsScreen from './src/screens/MainTabsScreen';
import SocialSquareScreen from './src/screens/SocialSquareScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatPaneScreen from './src/screens/ChatPaneScreen';
import VerifyOtpScreen from './src/screens/VerifyOtpScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import ReelsScreen from './src/screens/ReelsScreen';
import PulseScreen from './src/screens/PulseScreen';
import KnowledgeScreen from './src/screens/KnowledgeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NewPostScreen from './src/screens/NewPostScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import HashtagResultsScreen from './src/screens/HashtagResultsScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import ActiveSessionsScreen from './src/screens/ActiveSessionsScreen';
import CloseFriendsScreen from './src/screens/CloseFriendsScreen';
import CallScreen from './src/screens/CallScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';
import CommunitiesScreen from './src/screens/CommunitiesScreen';
import WikiDetailScreen from './src/screens/WikiDetailScreen';
import CreatorInsightsScreen from './src/screens/CreatorInsightsScreen';
import GoalCreateScreen from './src/screens/GoalCreateScreen';
import PasswordSecurityScreen from './src/screens/PasswordSecurityScreen';
import ContactScreen from './src/screens/ContactScreen';
import { getSocket, connectSocket, disconnectSocket } from './src/lib/socket';
import { appChannel } from './src/lib/broadcast';
import type { RootStackParamList } from './src/navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  const isDarkMode = RN.useColorScheme() === 'dark';
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    // Socket lifecycle management based on foreground/background and auth state
    if (user && RN.AppState.currentState === 'active') {
      connectSocket(user._id);
    } else if (!user || RN.AppState.currentState.match(/inactive|background/)) {
      disconnectSocket();
    }

    const subscription = RN.AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && user) {
        connectSocket(user._id);
      } else if (nextAppState.match(/inactive|background/)) {
        disconnectSocket();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  useEffect(() => {
    const socket = getSocket();

    const handleIncomingCall = (data: any) => {
      console.log('[Socket] Global Incoming Call:', data);
      if (navigationRef.isReady()) {
        navigationRef.navigate('Call', {
          conversationId: data.conversationId,
          callerId: data.callerId,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar,
          callType: data.type,
          isIncoming: true,
        });
      }
    };

    const handleSessionRevoked = ({ sessionId }: any) => {
      const currentSessionId = useAuthStore.getState().sessionId;
      if (!sessionId || String(sessionId) === String(currentSessionId)) {
        console.log('[Socket] Active session revoked — logging out');
        useAuthStore.getState().logout();
      }
    };

    const handleSessionsRevokedAll = ({ exceptSessionId }: any) => {
      const currentSessionId = useAuthStore.getState().sessionId;
      if (String(exceptSessionId) !== String(currentSessionId)) {
        console.log('[Socket] Other sessions revoked — logging out');
        useAuthStore.getState().logout();
      }
    };

    socket.on('incomingCall', handleIncomingCall);
    socket.on('sessionRevoked', handleSessionRevoked);
    socket.on('sessionsRevokedAll', handleSessionsRevokedAll);

    return () => {
      socket.off('incomingCall', handleIncomingCall);
      socket.off('sessionRevoked', handleSessionRevoked);
      socket.off('sessionsRevokedAll', handleSessionsRevokedAll);
    };
  }, []);

  useEffect(() => {
    const handleLogout = () => {
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    };

    appChannel.on('LOGOUT', handleLogout);

    return () => {
      appChannel.off('LOGOUT', handleLogout);
    };
  }, []);

  const linking = {
    prefixes: ['socialsquare://'],
    config: {
      screens: {
        ChatPane: 'chat/:conversationId',
        PostDetail: 'post/:postId',
        Profile: 'profile/:userId',
      },
    },
  };

  const renderAppContent = () => {
    const stackNavigator = (
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
        <Stack.Screen name="Forgot" component={ForgotScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="SocialSquare" component={MainTabsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="ChatPane" component={ChatPaneScreen} />
        <Stack.Screen name="Explore" component={ExploreScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Reels" component={ReelsScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Pulse" component={PulseScreen} />
        <Stack.Screen name="Knowledge" component={KnowledgeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="NewPost" component={NewPostScreen} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="HashtagResults" component={HashtagResultsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="ActiveSessions" component={ActiveSessionsScreen} />
        <Stack.Screen name="CloseFriends" component={CloseFriendsScreen} />
        <Stack.Screen name="Call" component={CallScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="Chatbot" component={ChatbotScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Communities" component={CommunitiesScreen} />
        <Stack.Screen name="WikiDetail" component={WikiDetailScreen} />
        <Stack.Screen name="CreatorInsights" component={CreatorInsightsScreen} />
        <Stack.Screen name="GoalCreate" component={GoalCreateScreen} />
        <Stack.Screen name="PasswordSecurity" component={PasswordSecurityScreen} />
        <Stack.Screen name="Contact" component={ContactScreen} />
      </Stack.Navigator>
    );

    // PostHogProvider must be INSIDE NavigationContainer so its internal
    // useNavigationTracker hook has access to the navigation context.
    const innerContent = POSTHOG_API_KEY ? (
      <PostHogProvider
        apiKey={POSTHOG_API_KEY}
        options={{
          host: POSTHOG_HOST,
          enableSessionReplay: true,
        }}
        // captureScreens must be set via the autocapture prop (not options).
        // Setting captureScreens: false here prevents PostHogNavigationHook
        // from mounting and calling useNavigationState inside a non-screen context.
        autocapture={{ captureScreens: false }}
      >
        {stackNavigator}
      </PostHogProvider>
    ) : stackNavigator;

    return (
      <>
        <NavigationContainer ref={navigationRef} linking={linking}>
          {innerContent}
        </NavigationContainer>
        <CustomToastContainer />
      </>
    );
  };


  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        {renderAppContent()}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

export default App;

