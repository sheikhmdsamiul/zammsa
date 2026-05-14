import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useLogin } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';

const TEST_ACCOUNTS = [
  { label: 'System Admin', email: 'admin@zammsa.zm', pw: 'Test@123' },
  { label: 'Director General', email: 'dg@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Dir. Procurement', email: 'dirproc@zammsa.zm', pw: 'Test@123' },
  { label: 'Proc. Manager', email: 'pm@zammsa.zm', pw: 'Test@123' },
  { label: 'Proc. Officer', email: 'po@zammsa.zm', pw: 'Test@123' },
  { label: 'Dept Head', email: 'dh@zammsa.zm', pw: 'Test@123' },
  { label: 'Dept Staff', email: 'staff@zammsa.zm', pw: 'Test@123' },
  { label: 'Finance Officer', email: 'fo@zammsa.zm', pw: 'Test@123' },
  { label: 'Budget Controller', email: 'bc@zammsa.zm', pw: 'Test@123' },
  { label: 'ZPC Member', email: 'zpc@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'EC Chair', email: 'ecchair@zammsa.zm', pw: 'Test@123' },
  { label: 'EC Member', email: 'ecm1@zammsa.zm', pw: 'Test@123' },
  { label: 'Contract Manager', email: 'cm@zammsa.zm', pw: 'Test@123' },
  { label: 'ZPPA Reporter', email: 'zppa@zammsa.zm', pw: 'Test@123' },
  { label: 'Auditor', email: 'auditor@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Supplier', email: 'vendor@healthpharma.zm', pw: 'Vendor@123' },
];

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

const mfaSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type LoginForm = z.infer<typeof loginSchema>;
type MFAForm = z.infer<typeof mfaSchema>;

const Login: React.FC = () => {
  const login = useLogin();
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  const [showQuick, setShowQuick] = useState(false);

  const mfaForm = useForm<MFAForm>({
    resolver: zodResolver(mfaSchema),
  });

  const onLogin = async (data: LoginForm) => {
    setError('');
    setSubmitting(true);
    const result = await login(data);
    setSubmitting(false);
    if (!result.success) {
      if (result.error?.includes('MFA') || result.error?.includes('mfa')) {
        setEmail(data.email);
        setStep('mfa');
      } else {
        setError(result.error || 'Login failed');
      }
    }
  };

  const onMFA = async (data: MFAForm) => {
    setError('');
    setSubmitting(true);
    try {
      const { authApi } = await import('../../api/auth');
      const res = await authApi.mfaLogin(email, data.code);
      localStorage.setItem('access_token', res.access);
      localStorage.setItem('refresh_token', res.refresh);
      const { setUser } = await import('../../store/authSlice');
      const { store } = await import('../../store');
      store.dispatch(setUser(res.user));
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'MFA verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'mfa') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-zammsa-green">ZAMMSA</h1>
            <p className="text-gray-500">Two-Factor Authentication</p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          <form onSubmit={mfaForm.handleSubmit(onMFA)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Enter the 6-digit code from your authenticator app
              </label>
              <input
                {...mfaForm.register('code')}
                maxLength={6}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-zammsa-green focus:border-zammsa-green text-center text-2xl tracking-widest"
                placeholder="000000"
              />
              {mfaForm.formState.errors.code && (
                <p className="mt-1 text-sm text-red-600">{mfaForm.formState.errors.code.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 bg-zammsa-green text-white rounded-lg hover:bg-zammsa-green-dark disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <LoadingSpinner size="sm" />}
              Verify
            </button>
            <button
              type="button"
              onClick={() => setStep('credentials')}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-zammsa-green rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">Z</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-zammsa-green">ZAMMSA</h1>
          <p className="text-gray-500">Procurement System</p>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              {...loginForm.register('email')}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-zammsa-green focus:border-zammsa-green"
              placeholder="you@example.gov.zm"
            />
            {loginForm.formState.errors.email && (
              <p className="mt-1 text-sm text-red-600">{loginForm.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              {...loginForm.register('password')}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-zammsa-green focus:border-zammsa-green"
              placeholder="Enter your password"
            />
            {loginForm.formState.errors.password && (
              <p className="mt-1 text-sm text-red-600">{loginForm.formState.errors.password.message}</p>
            )}
          </div>
          <div className="flex items-center justify-end">
            <Link to="/forgot-password" className="text-sm text-zammsa-green hover:underline">
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-zammsa-green text-white rounded-lg hover:bg-zammsa-green-dark disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <LoadingSpinner size="sm" />}
            Sign In
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button type="button" onClick={() => setShowQuick(!showQuick)} className="w-full text-xs text-gray-400 hover:text-gray-600 text-center">
            {showQuick ? '- Hide Quick Test Accounts' : '+ Quick Test Accounts'}
          </button>
          {showQuick && (
            <div className="mt-3 grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {TEST_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => { loginForm.setValue('email', a.email); loginForm.setValue('password', a.pw); }}
                  className="text-left px-2 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 hover:border-zammsa-green truncate"
                  title={a.label}
                >
                  <span className="font-medium text-gray-700">{a.label}</span>
                  <span className="block text-gray-400 truncate">{a.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Zambia Medicines & Medical Supplies Agency
        </p>
      </div>
    </div>
  );
};

export default Login;
