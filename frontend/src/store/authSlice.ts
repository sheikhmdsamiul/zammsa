import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

const normalizeRole = (role?: string): string => {
  const aliases: Record<string, string> = {
    zppa_reporter: 'zppa_reporting_officer',
  };
  return role ? (aliases[role] || role) : '';
};

const normalizeUser = (user: User | null): User | null => {
  if (!user) return null;
  return { ...user, role: normalizeRole(user.role) };
};

const loadUser = (): User | null => {
  try {
    const stored = localStorage.getItem('user');
    return stored ? normalizeUser(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  user: loadUser(),
  isAuthenticated: !!localStorage.getItem('access_token'),
  loading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      const normalizedUser = normalizeUser(action.payload);
      state.user = normalizedUser;
      state.isAuthenticated = true;
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    },
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setUser, logout, setLoading } = authSlice.actions;
export default authSlice.reducer;
