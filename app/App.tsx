import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAuthStore from './src/store/zustand/useAuthStore';
import { CustomToastContainer } from './src/lib/CustomToast';

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
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import ActiveSessionsScreen from './src/screens/ActiveSessionsScreen';
import CloseFriendsScreen from './src/screens/CloseFriendsScreen';
import CallScreen from './src/screens/CallScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';
import CommunitiesScreen from './src/screens/CommunitiesScreen';
import WikiDetailScreen from './src/screens/WikiDetailScreen';
import { getSocket } from './src/lib/socket';

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    const socket = getSocket();

    const handleIncomingCall = (data: any) => {
      console.log('[Socket] Global Incoming Call:', data);
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('Call', {
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer ref={navigationRef}>
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
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="ActiveSessions" component={ActiveSessionsScreen} />
          <Stack.Screen name="CloseFriends" component={CloseFriendsScreen} />
          <Stack.Screen name="Call" component={CallScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="Chatbot" component={ChatbotScreen} options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Communities" component={CommunitiesScreen} />
          <Stack.Screen name="WikiDetail" component={WikiDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <CustomToastContainer />
    </SafeAreaProvider>
  );
}

export default App;

