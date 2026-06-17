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
  { label: 'EC Member (Alice)', email: 'ecm3@zammsa.gov.zm', pw: 'Test@123' },
  { label: 'EC Member (Brian)', email: 'ecm4@zammsa.gov.zm', pw: 'Test@123' },
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-zammsa-green/5 rounded-full blur-[120px] -mr-64 -mt-64" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -ml-48 -mb-48" />

      <div className="max-w-[440px] w-full relative z-10">
        <div className="flex flex-col items-center text-center mb-10">
           <Link to="/" className="w-14 h-14 bg-zammsa-green rounded-2xl flex items-center justify-center shadow-xl shadow-zammsa-green/20 mb-6 hover:scale-110 transition-all group">
              <span className="text-white text-2xl font-bold italic group-hover:-rotate-12 transition-transform">Z</span>
           </Link>
           <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Access</h1>
           <p className="text-slate-500 font-semibold mt-1 uppercase tracking-[0.2em] text-[10px]">Official ZAMMSA Procurement Portal</p>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-900/5 p-8 lg:p-12 overflow-hidden relative">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
               {error}
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative group">
                   <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-zammsa-green transition-colors" />
                   <input
                     {...loginForm.register('email')}
                     className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-emerald-50 focus:border-zammsa-green transition-all outline-none placeholder:text-slate-300"
                     placeholder="you@zammsa.gov.zm"
                   />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
                   <Link to="/forgot-password" className="text-[10px] font-bold text-zammsa-green hover:underline uppercase tracking-widest">Forgot?</Link>
                </div>
                <div className="relative group">
                   <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-zammsa-green transition-colors" />
                   <input
                     type="password"
                     {...loginForm.register('password')}
                     className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-emerald-50 focus:border-zammsa-green transition-all outline-none placeholder:text-slate-300"
                     placeholder="••••••••••••"
                   />
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight ml-1">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-zammsa-green text-white text-xs font-bold uppercase tracking-widest rounded-2xl hover:bg-zammsa-green-dark transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-zammsa-green/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                {submitting ? <LoadingSpinner /> : (
                  <>
                    <span>Sign into Dashboard</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={mfaForm.handleSubmit(onMFA)} className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-center">
               <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-2 ring-8 ring-emerald-50/50">
                  <ShieldCheckIcon className="w-8 h-8 text-zammsa-green" />
               </div>
               <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Security Check</h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Enter the 6-digit code from your app.</p>
               </div>
               <div className="space-y-4">
                  <input
                    {...mfaForm.register('code')}
                    maxLength={6}
                    className="w-full py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-3xl font-bold tracking-[0.5em] focus:ring-4 focus:ring-emerald-50 focus:border-zammsa-green transition-all outline-none text-slate-900"
                    placeholder="000000"
                    autoFocus
                  />
                  {mfaForm.formState.errors.code && (
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">{mfaForm.formState.errors.code.message}</p>
                  )}
               </div>
               <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-zammsa-green text-white text-xs font-bold uppercase tracking-widest rounded-2xl hover:bg-zammsa-green-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting && <LoadingSpinner />}
                    Verify Identity
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('credentials')}
                    className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                  >
                    Back to login
                  </button>
               </div>
            </form>
          )}

          {/* Test Accounts Section */}
          <div className="mt-10 pt-8 border-t border-slate-100">
             <button 
                type="button" 
                onClick={() => setShowQuick(!showQuick)} 
                className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-slate-300 hover:text-slate-500 uppercase tracking-[0.2em] transition-colors"
             >
                Test Credentials
                <ChevronDownIcon className={`w-3 h-3 transition-transform duration-300 ${showQuick ? 'rotate-180' : ''}`} />
             </button>
             
             {showQuick && (
               <div className="mt-6 grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-300">
                  {TEST_ACCOUNTS.map((a) => (
                    <button
                      key={a.email}
                      type="button"
                      disabled={submitting}
                      onClick={() => quickLogin(a)}
                      className="group flex flex-col items-start p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-zammsa-green/30 hover:bg-white transition-all text-left"
                    >
                      <span className="text-[10px] font-bold text-slate-900 uppercase tracking-tight group-hover:text-zammsa-green">{a.label}</span>
                      <span className="text-[9px] font-medium text-slate-400 group-hover:text-slate-500">{a.email}</span>
                    </button>
                  ))}
               </div>
             )}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
           <Link to="/" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-zammsa-green uppercase tracking-widest transition-colors">
              <GlobeAltIcon className="w-4 h-4" />
              Public Portal
           </Link>
           <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]">
             &copy; {new Date().getFullYear()} ZAMMSA PMS
           </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
