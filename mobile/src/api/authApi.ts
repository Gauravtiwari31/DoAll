import { AuthTokens } from '../services/session';
import { api } from './client';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  name: string;
}

export const authApi = {
  register: (body: Registration) =>
    api.post<AuthResponse>('/auth/register', body).then(r => r.data),

  login: (body: Credentials) =>
    api.post<AuthResponse>('/auth/login', body).then(r => r.data),

  logout: (refreshToken: string) =>
    api.post<void>('/auth/logout', { refreshToken }),

  me: () => api.get<User>('/auth/me').then(r => r.data),

  /** Permanently deletes the account and all its tasks; needs the password. */
  deleteAccount: (password: string) =>
    api.delete<void>('/auth/me', { data: { password } }),
};
