import React, { useState } from 'react';
import {
  Recycle,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Truck,
  UserCheck,
  ArrowLeft,
  Phone
} from 'lucide-react';
import { AuthView, getAuthRouteForView, validatePhoneNumber } from '../../utils/ecoLogic.ts';

interface LoginPageProps {
  view: AuthView;
  onNavigateRoute: (path: string) => void;
  onLogin: (identifier: string, password?: string) => Promise<void>;
  onRegisterCitizen: (data: any) => Promise<void>;
  onRegisterStaff: (data: {
    name: string;
    username: string;
    password: string;
    role: 'supervisor' | 'collector';
    area?: string;
  }) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  isLoading?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  view,
  onNavigateRoute,
  onLogin,
  onRegisterCitizen,
  onRegisterStaff,
  onGoogleSignIn,
  isLoading = false
}) => {
  // Common Login form (used by Admin, Supervisor, Collector, and Citizen)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Citizen Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regArea, setRegArea] = useState('Warangal Urban');
  const [regWard, setRegWard] = useState('Ward 1');
  const [regPincode, setRegPincode] = useState('506001');

  // Supervisor / Collector Sign Up form (collects Name, Username, Password; NO Google Sign-Up)
  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffConfirmPassword, setStaffConfirmPassword] = useState('');
  const [staffArea, setStaffArea] = useState('Warangal Urban');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await onLogin(loginIdentifier, loginPassword);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify your username/email and password.');
    }
  };

  const handleCitizenRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const phoneValidation = validatePhoneNumber(regPhone);
    if (!phoneValidation.valid) {
      setErrorMsg(phoneValidation.error || 'Please enter a valid contact phone number.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    try {
      await onRegisterCitizen({
        name: regName,
        email: regEmail,
        phone: phoneValidation.normalized,
        password: regPassword,
        address: regAddress,
        area: regArea,
        ward: regWard,
        pincode: regPincode
      });
      setSuccessMsg('Account created successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
    }
  };

  const handleStaffRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const staffRole = view === 'supervisor-signup' ? 'supervisor' : view === 'collector-signup' ? 'collector' : null;
    if (!staffRole) return;

    if (!staffName.trim()) {
      setErrorMsg('Full name is required');
      return;
    }
    if (staffUsername.trim().length < 3) {
      setErrorMsg('Username must be at least 3 characters');
      return;
    }
    if (staffPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }
    if (staffPassword !== staffConfirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    try {
      await onRegisterStaff({
        name: staffName.trim(),
        username: staffUsername.trim(),
        password: staffPassword,
        role: staffRole,
        area: staffArea
      });
      setSuccessMsg(`${staffRole === 'supervisor' ? 'Supervisor' : 'Collector'} account created!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
    }
  };

  const isStaffSignup = view === 'supervisor-signup' || view === 'collector-signup';

  const headerMeta =
    view === 'supervisor-signup'
      ? {
          title: 'Supervisor Sign Up',
          subtitle: 'Create your EcoTrack Supervisor Operations account',
          badge: 'Supervisor Registration',
          iconBg: 'from-blue-700 to-indigo-600',
          Icon: UserCheck,
          buttonBg: 'bg-blue-700 hover:bg-blue-800'
        }
      : view === 'collector-signup'
        ? {
            title: 'Collector Sign Up',
            subtitle: 'Create your EcoTrack Field Collector account',
            badge: 'Collector Registration',
            iconBg: 'from-amber-600 to-orange-500',
            Icon: Truck,
            buttonBg: 'bg-amber-600 hover:bg-amber-700'
          }
        : {
            title: 'EcoTrack',
            subtitle: 'Smarter Waste Collection. Cleaner Communities.',
            badge: null,
            iconBg: 'from-emerald-700 to-emerald-500',
            Icon: Recycle,
            buttonBg: 'bg-emerald-600 hover:bg-emerald-700'
          };

  const HeaderIcon = headerMeta.Icon;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-200">
        {/* Brand Logo & Heading */}
        <div className="text-center">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${headerMeta.iconBg} mx-auto flex items-center justify-center text-white shadow-md`}
          >
            <HeaderIcon className="w-7 h-7" />
          </div>
          {headerMeta.badge && (
            <span className="inline-block mt-2.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
              {headerMeta.badge}
            </span>
          )}
          <h2 className="text-2xl font-extrabold text-slate-900 mt-2.5">{headerMeta.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{headerMeta.subtitle}</p>
        </div>

        {/* Common Sign In / Citizen Registration tabs (hidden on dedicated staff signup-only routes) */}
        {!isStaffSignup && (
          <div className="mt-5 flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                onNavigateRoute(getAuthRouteForView('common-login'));
              }}
              className={`flex-1 py-2 rounded-lg transition ${
                view === 'common-login' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                onNavigateRoute(getAuthRouteForView('citizen-signup'));
              }}
              className={`flex-1 py-2 rounded-lg transition ${
                view === 'citizen-signup' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
              }`}
            >
              Citizen Registration
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* VIEW 1: COMMON LOGIN PAGE FOR ALL ROLES */}
        {view === 'common-login' && (
          <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Username or Email</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                Remember me
              </label>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  setErrorMsg('Please contact your EcoTrack Municipal Administrator for password reset assistance.');
                }}
                className="text-emerald-700 font-semibold hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            {/* Google Sign-In accepted for Citizen accounts */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold">Citizen Quick Access</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full min-h-[42px] py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google (Citizens)</span>
            </button>
          </form>
        )}

        {/* VIEW 2 & 3: DEDICATED SIGNUP-ONLY ROUTES FOR SUPERVISOR & COLLECTOR */}
        {isStaffSignup && (
          <form onSubmit={handleStaffRegisterSubmit} className="mt-5 space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                placeholder={view === 'supervisor-signup' ? 'e.g. Anjali Deshmukh' : 'e.g. Kiran Reddy'}
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                placeholder={view === 'supervisor-signup' ? 'e.g. anjali.supervisor' : 'e.g. kiran.collector'}
                value={staffUsername}
                onChange={(e) => setStaffUsername(e.target.value)}
                autoComplete="username"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  placeholder="Min 6 chars"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Confirm Password *</label>
                <input
                  type="password"
                  placeholder="Repeat password"
                  value={staffConfirmPassword}
                  onChange={(e) => setStaffConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Assigned Zone / Area</label>
              <select
                value={staffArea}
                onChange={(e) => setStaffArea(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
              >
                <option value="Warangal Urban">Warangal Urban</option>
                <option value="Hanamkonda Central">Hanamkonda Central</option>
                <option value="Subedari">Subedari</option>
                <option value="Kazipet Junction">Kazipet Junction</option>
                <option value="University Campus Zone">University Campus Zone</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full min-h-[44px] py-2.5 rounded-xl text-white font-bold text-xs shadow-xs transition ${headerMeta.buttonBg}`}
            >
              {isLoading
                ? 'Creating Account...'
                : view === 'supervisor-signup'
                  ? 'Complete Supervisor Sign Up'
                  : 'Complete Collector Sign Up'}
            </button>

            <div className="pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => onNavigateRoute('/')}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-emerald-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Already have an account? Sign In</span>
              </button>
            </div>
          </form>
        )}

        {/* VIEW 4: CITIZEN REGISTRATION */}
        {view === 'citizen-signup' && (
          <form onSubmit={handleCitizenRegisterSubmit} className="mt-5 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">
              <div>
                <label htmlFor="citizen-reg-name" className="block font-bold text-slate-700 mb-0.5">
                  Full Name *
                </label>
                <input
                  id="citizen-reg-name"
                  type="text"
                  placeholder="e.g. Ramesh Chandra"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>
              <div>
                <label htmlFor="citizen-reg-phone" className="block font-bold text-slate-700 mb-0.5">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    id="citizen-reg-phone"
                    type="tel"
                    placeholder="+91 98480 12345"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    autoComplete="tel"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-mono tabular-nums"
                    required
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">
              Your phone number is shared with the assigned collector when you book a waste pickup.
            </p>

            <div>
              <label htmlFor="citizen-reg-email" className="block font-bold text-slate-700 mb-0.5">
                Email Address *
              </label>
              <input
                id="citizen-reg-email"
                type="email"
                placeholder="name@domain.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                autoComplete="email"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Password *</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Confirm Password *</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Household Address *</label>
              <input
                type="text"
                placeholder="House no, Street name, Landmark"
                value={regAddress}
                onChange={(e) => setRegAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Area *</label>
                <select
                  value={regArea}
                  onChange={(e) => setRegArea(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px]"
                >
                  <option value="Warangal Urban">Warangal Urban</option>
                  <option value="Hanamkonda Central">Hanamkonda Central</option>
                  <option value="Subedari">Subedari</option>
                  <option value="Kazipet Junction">Kazipet Junction</option>
                  <option value="University Campus Zone">University Campus</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Ward *</label>
                <select
                  value={regWard}
                  onChange={(e) => setRegWard(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px]"
                >
                  <option value="Ward 1">Ward 1</option>
                  <option value="Ward 2">Ward 2</option>
                  <option value="Ward 4">Ward 4</option>
                  <option value="Ward 7">Ward 7</option>
                  <option value="Ward 9">Ward 9</option>
                  <option value="Ward 11">Ward 11</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">PIN Code *</label>
                <input
                  type="text"
                  value={regPincode}
                  onChange={(e) => setRegPincode(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
            >
              {isLoading ? 'Registering...' : 'Complete Citizen Registration'}
            </button>

            {/* Google Sign-Up accepted for Citizens */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold">Or sign up with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full min-h-[42px] py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign up with Google</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
