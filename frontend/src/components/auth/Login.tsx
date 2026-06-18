import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useLogin } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ROLES } from '../../config/rbac';
import {
  ShieldCheckIcon, MailIcon, LockClosedIcon,
  ArrowRightIcon, GlobeAltIcon, ChevronDownIcon
} from '@heroicons/react/outline';

const TEST_ACCOUNTS = [
  { label: 'System Admin', email: 'admin@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Director General', email: 'dg@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Dir. Procurement', email: 'director@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Proc. Officer', email: 'procurement.officer@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Dept Head', email: 'dept.head@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Dept Staff', email: 'staff@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Budget Controller', email: 'bc@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Finance Officer', email: 'finance.officer@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'ZPC Member', email: 'zpc@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'EC Member', email: 'evaluator@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Contract Manager', email: 'contract@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'ZPPA Reporter', email: 'zppa@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Auditor', email: 'auditor@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Supplier', email: 'supplier@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Supplier Rel. Mgr', email: 'supplier.manager@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Proc. Manager', email: 'pm@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'EC Chair', email: 'ecchair@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'Integration Mgr', email: 'integration@zammsa.gov.zm', pw: 'Test@123' },
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
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const mfaForm = useForm<MFAForm>({
    resolver: zodResolver(mfaSchema),
  });

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role === ROLES.SUPPLIER_USER) navigate('/vendor/dashboard', { replace: true });
    else if (user.role === ROLES.SUPPLIER_RELATIONSHIP_MANAGER) navigate('/supplier-relations', { replace: true });
    else if (user.role === ROLES.SYSTEM_ADMIN) navigate('/admin', { replace: true });
    else navigate('/dashboard', { replace: true });
  }, [isAuthenticated, user, navigate]);

  const onLogin = async (data: LoginForm) => {
    setError('');
    setSubmitting(true);
    const result = await login(data);
    setSubmitting(false);
    if (!result.success) {
      if (result.error?.toLowerCase().includes('mfa')) {
        setEmail(data.email);
        setStep('mfa');
      } else {
        setError(result.error || 'Invalid credentials');
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

  const quickLogin = async (account: (typeof TEST_ACCOUNTS)[number]) => {
    loginForm.setValue('email', account.email);
    loginForm.setValue('password', account.pw);
    await onLogin({ email: account.email, password: account.pw });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-[420px] w-full">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-12 h-12 bg-zammsa-green rounded-xl flex items-center justify-center shadow-lg shadow-zammsa-green/20 mb-5">
            <span className="text-white text-xl font-bold">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in</h1>
          <p className="text-sm text-slate-500 mt-1">ZAMMSA Procurement Portal</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-100 rounded-lg">
              <p className="text-xs font-semibold text-rose-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                {error}
              </p>
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
                <div className="relative">
                  <MailIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    {...loginForm.register('email')}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all placeholder:text-slate-300"
                    placeholder="you@zammsa.gov.zm"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-[11px] font-medium text-rose-600 mt-1">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <Link to="/forgot-password" className="text-[11px] font-medium text-zammsa-green hover:underline">Forgot?</Link>
                </div>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    {...loginForm.register('password')}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all placeholder:text-slate-300"
                    placeholder="Enter your password"
                  />
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-[11px] font-medium text-rose-600 mt-1">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-zammsa-green text-white text-sm font-semibold rounded-lg hover:bg-zammsa-green-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <LoadingSpinner /> : (
                  <>
                    Sign in
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={mfaForm.handleSubmit(onMFA)} className="space-y-5 text-center">
              <div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <ShieldCheckIcon className="w-6 h-6 text-zammsa-green" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Security check</h2>
                <p className="text-sm text-slate-500 mt-1">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <div>
                <input
                  {...mfaForm.register('code')}
                  maxLength={6}
                  className="w-full py-3 bg-white border border-slate-200 rounded-lg text-center text-2xl font-bold tracking-[0.4em] focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green outline-none transition-all text-slate-900"
                  placeholder="000000"
                  autoFocus
                />
                {mfaForm.formState.errors.code && (
                  <p className="text-[11px] font-medium text-rose-600 mt-1">{mfaForm.formState.errors.code.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-zammsa-green text-white text-sm font-semibold rounded-lg hover:bg-zammsa-green-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <LoadingSpinner />}
                  Verify identity
                </button>
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowQuick(!showQuick)}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              Test accounts
              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${showQuick ? 'rotate-180' : ''}`} />
            </button>

            {showQuick && (
              <div className="mt-4 grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1 animate-in fade-in duration-200">
                {TEST_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    disabled={submitting}
                    onClick={() => quickLogin(a)}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-lg hover:border-zammsa-green/30 hover:bg-white transition-all text-left"
                  >
                    <span className="text-xs font-semibold text-slate-800">{a.label}</span>
                    <span className="text-[10px] text-slate-400">{a.email.split('@')[0]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Link to="/" className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-zammsa-green transition-colors">
            <GlobeAltIcon className="w-4 h-4" />
            Public portal
          </Link>
          <p className="text-[10px] font-medium text-slate-300">
            &copy; {new Date().getFullYear()} ZAMMSA PMS
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
