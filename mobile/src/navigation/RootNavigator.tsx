import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme as NavTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { RemindersScreen } from '../screens/RemindersScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { TaskEditorScreen } from '../screens/TaskEditorScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useAppSelector } from '../store/hooks';
import { useTheme } from '../theme';
import { AppStackParamList, AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

/**
 * Auth gate: which stack is mounted depends only on `auth.status`. Signing in
 * or out swaps stacks, so there is no way to navigate "back" into the app
 * after logging out.
 */
export function RootNavigator() {
  const status = useAppSelector(state => state.auth.status);
  const theme = useTheme();
  const navigationRef = useNavigationContainerRef<AppStackParamList>();
  useAppLifecycle(navigationRef);

  // Keep react-navigation's own surfaces (transitions, overscroll) on-palette.
  const navTheme = useMemo<NavTheme>(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.text,
        border: theme.colors.line,
        primary: theme.colors.primary,
      },
    };
  }, [theme]);

  if (status === 'restoring') {
    return <SplashScreen />;
  }

  const screenOptions = {
    headerShown: false,
    animation: 'slide_from_right' as const,
    contentStyle: { backgroundColor: theme.colors.background },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {status === 'signedIn' ? (
        <AppStack.Navigator screenOptions={screenOptions}>
          <AppStack.Screen name="Home" component={HomeScreen} />
          <AppStack.Screen name="TaskDetail" component={TaskDetailScreen} />
          <AppStack.Screen
            name="TaskEditor"
            component={TaskEditorScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <AppStack.Screen name="Profile" component={ProfileScreen} />
          <AppStack.Screen name="Reminders" component={RemindersScreen} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={screenOptions}>
          <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
