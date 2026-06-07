import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from './useRedux';
import { setUser, logout as logoutAction, setLoading } from '../store/authSlice';
import { authApi } from '../api/auth';
import { LoginCredentials } from '../types';
import { ROLES } from '../config/rbac';

export function useLogin() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const login = useCallback(
    async (data: LoginCredentials) => {
      dispatch(setLoading(true));
      try {
        const res = await authApi.login(data);

        // MFA flow returns no tokens yet; caller should switch to MFA step.
        if ((res as any)?.requires_mfa) {
          return { success: false, error: 'MFA required' };
        }

        if (!res?.access || !res?.refresh || !res?.user) {
          return { success: false, error: 'Login failed: invalid auth response' };
        }

        localStorage.setItem('access_token', res.access);
        localStorage.setItem('refresh_token', res.refresh);
        dispatch(setUser(res.user));
        toast.success('Login successful');
        if (res.must_change_password) {
          navigate('/change-password');
        } else if (res.user.role === ROLES.SUPPLIER_USER) {
          navigate('/vendor/dashboard');
        } else if (res.user.role === ROLES.SUPPLIER_RELATIONSHIP_MANAGER) {
          navigate('/supplier-relations');
        } else {
          navigate('/');
        }
        return { success: true, mustChangePassword: !!res.must_change_password };
      } catch (err: any) {
        const data = err.response?.data;
        let error = 'Login failed';
        if (data && typeof data === 'object') {
          error = data.error || data.detail || (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) || error;
        }
        return { success: false, error };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, navigate]
  );

  return login;
}

export function useLogout() {
  const dispatch = useAppDispatch();

  const logout = useCallback(async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        await authApi.logout(refresh);
      }
    } catch {
      // ignore
    }
    dispatch(logoutAction());
    toast.success('Logged out');
    window.location.href = '/login';
  }, [dispatch]);

  return logout;
}

export function useAuth() {
  const { user, isAuthenticated, loading } = useAppSelector((s) => s.auth);
  return { user, isAuthenticated, loading };
}

export function usePermission() {
  const { user } = useAuth();

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const isAdmin = user?.role === ROLES.SYSTEM_ADMIN;
  const isFinance = user?.role === ROLES.FINANCE_OFFICER || user?.role === ROLES.BUDGET_CONTROLLER;
  const isVendor = user?.role === ROLES.SUPPLIER_USER;
  const isDeptHead = user?.role === ROLES.DEPARTMENT_HEAD;
  const isDG = user?.role === ROLES.DIRECTOR_GENERAL;

  return { hasRole, isAdmin, isFinance, isVendor, isDeptHead, isDG, role: user?.role };
}
