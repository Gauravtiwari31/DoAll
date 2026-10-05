import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  TaskDetail: { id: string };
  /** No id → create a new task. */
  TaskEditor: { id?: string } | undefined;
  Profile: undefined;
  /** "Reminders not arriving?": phone settings that affect reminders. */
  Reminders: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;
export type AppScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;
