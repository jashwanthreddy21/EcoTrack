import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Truck,
  UserCheck,
  ArrowLeft,
  Phone
} from 'lucide-react';
import loginBackdropUrl from '../../assets/images/ecotrack_login_backdrop_1794820337604.jpg';
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

  // Supervisor / Collector Sign Up form
  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffConfirmPassword, setStaffConfirmPassword] = useState('');
  const [staffArea, setStaffArea] = useState('Warangal Urban');

  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleClick = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setSuccessMsg('');
    setGoogleLoading(true);
    try {
      await onGoogleSignIn();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google authentication failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    try {
      await onLogin(loginIdentifier, loginPassword);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify your email address and password.');
    }
  };

  const handleCitizenRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

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
    setInfoMsg('');

    const staffRole =
      view === 'supervisor-signup' ? 'supervisor' : view === 'collector-signup' ? 'collector' : null;
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

  const cardHeading =
    view === 'supervisor-signup'
      ? 'Supervisor Sign Up'
      : view === 'collector-signup'
        ? 'Collector Sign Up'
        : view === 'citizen-signup'
          ? 'Create Citizen Account'
          : 'Login to Your Account';

  const switchAuthView = (target: AuthView) => {
    setErrorMsg('');
    setInfoMsg('');
    setSuccessMsg('');
    onNavigateRoute(getAuthRouteForView(target));
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-[#d8eeff] via-[#ecf6ff] to-[#d9f0c7] flex items-center">
      {/* Full-bleed Sunlit Municipal Skyline & Recycling Truck Illustration */}
      <img
        src={loginBackdropUrl}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-bottom select-none pointer-events-none"
      />
      {/* Subtle sky & readability veil on small viewports so text stays crisp */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#e4f3ff]/45 via-transparent to-transparent lg:from-transparent pointer-events-none"
      />

      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-10">
          {/* Left Hero Brand Column (positioned in open sky above the illustrated truck) */}
          <section className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left lg:pl-10 lg:-mt-44">
            <div className="flex flex-col items-center">
              <img
                src="/app-icon.svg"
                alt="EcoTrack App Icon"
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/95 p-1 shadow-md border border-emerald-100/80 object-contain"
              />
              <h1 className="mt-2.5 text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-[#085c2e] leading-none">
                EcoTrack
              </h1>
              <p className="mt-2.5 text-base sm:text-xl font-semibold text-[#0d7a34] tracking-tight">
                Smart Waste Management
              </p>
            </div>

            {isStaffSignup && (
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#085c2e]">
                {view === 'supervisor-signup' ? (
                  <UserCheck className="w-4 h-4 shrink-0" />
                ) : (
                  <Truck className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {view === 'supervisor-signup'
                    ? 'Supervisor Operations Portal Registration'
                    : 'Field Collector Dispatch Registration'}
                </span>
              </div>
            )}
          </section>

          {/* Right Auth Card */}
          <section className="lg:col-span-6 flex justify-center lg:justify-end">
            <div
              className={`w-full ${
                view === 'citizen-signup' ? 'max-w-[490px]' : 'max-w-[420px]'
              } bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_22px_50px_-12px_rgba(15,23,42,0.18)] border border-white px-6 py-7 sm:px-9 sm:py-9`}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center tracking-tight">
                {cardHeading}
              </h2>

              {errorMsg && (
                <div
                  role="alert"
                  className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* VIEW 1: COMMON LOGIN FOR ALL ROLES */}
              {view === 'common-login' && (
                <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="login-email-input"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      id="login-email-input"
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="user@example.com"
                      autoComplete="username"
                      className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50/70 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0d7a34] focus:ring-2 focus:ring-emerald-600/15 focus:outline-hidden transition"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password-input"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        className="w-full pl-3.5 pr-11 py-2.5 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50/70 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0d7a34] focus:ring-2 focus:ring-emerald-600/15 focus:outline-hidden transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-emerald-600 transition"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-[46px] mt-1 py-2.5 px-5 rounded-lg bg-[#0d7a34] hover:bg-[#096429] active:scale-[0.99] text-white font-semibold text-sm shadow-xs transition disabled:opacity-60 whitespace-nowrap"
                  >
                    {isLoading ? 'Logging in...' : 'Login'}
                  </button>

                  <div className="text-center pt-1">
                    <a
                      href="#forgot"
                      onClick={(e) => {
                        e.preventDefault();
                        setErrorMsg('');
                        setInfoMsg(
                          'Please contact your EcoTrack Municipal Administrator for password reset assistance.'
                        );
                      }}
                      className="text-sm font-medium text-[#0d7a34] hover:text-[#085c2e] hover:underline"
                    >
                      Forgot Password?
                    </a>
                  </div>

                  {/* Subtle Citizen Secondary Options */}
                  <div className="pt-4 mt-2 border-t border-slate-100 space-y-3">
                    <button
                      type="button"
                      disabled={googleLoading || isLoading}
                      onClick={handleGoogleClick}
                      className="w-full min-h-[42px] py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                      <span>{googleLoading ? 'Connecting to Google...' : 'Sign in with Google (Citizens)'}</span>
                    </button>

                    <div className="text-center text-xs text-slate-600">
                      New resident?{' '}
                      <button
                        type="button"
                        onClick={() => switchAuthView('citizen-signup')}
                        className="font-semibold text-[#0d7a34] hover:underline"
                      >
                        Citizen Registration
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* VIEW 2 & 3: DEDICATED SIGNUP-ONLY ROUTES FOR SUPERVISOR & COLLECTOR */}
              {isStaffSignup && (
                <form onSubmit={handleStaffRegisterSubmit} className="mt-5 space-y-3.5 text-xs">
                  <div>
                    <label htmlFor="staff-name" className="block font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      id="staff-name"
                      type="text"
                      placeholder={
                        view === 'supervisor-signup' ? 'e.g. Anjali Deshmukh' : 'e.g. Kiran Reddy'
                      }
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="staff-username" className="block font-semibold text-slate-700 mb-1">
                      Username *
                    </label>
                    <input
                      id="staff-username"
                      type="text"
                      placeholder={
                        view === 'supervisor-signup'
                          ? 'e.g. anjali.supervisor'
                          : 'e.g. kiran.collector'
                      }
                      value={staffUsername}
                      onChange={(e) => setStaffUsername(e.target.value)}
                      autoComplete="username"
                      className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="staff-password" className="block font-semibold text-slate-700 mb-1">
                        Password *
                      </label>
                      <input
                        id="staff-password"
                        type="password"
                        placeholder="Min 6 chars"
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="staff-confirm" className="block font-semibold text-slate-700 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        id="staff-confirm"
                        type="password"
                        placeholder="Repeat password"
                        value={staffConfirmPassword}
                        onChange={(e) => setStaffConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="staff-area" className="block font-semibold text-slate-700 mb-1">
                      Assigned Zone / Area
                    </label>
                    <select
                      id="staff-area"
                      value={staffArea}
                      onChange={(e) => setStaffArea(e.target.value)}
                      className="w-full px-3.5 py-2.5 min-h-[42px] rounded-lg border border-slate-200 bg-slate-50/70 text-xs font-medium"
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
                    className="w-full min-h-[44px] py-2.5 rounded-lg bg-[#0d7a34] hover:bg-[#096429] text-white font-semibold text-sm shadow-xs transition whitespace-nowrap"
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
                      onClick={() => switchAuthView('common-login')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0d7a34] hover:underline"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Already have an account? Login</span>
                    </button>
                  </div>
                </form>
              )}

              {/* VIEW 4: CITIZEN REGISTRATION */}
              {view === 'citizen-signup' && (
                <form onSubmit={handleCitizenRegisterSubmit} className="mt-5 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="citizen-reg-name" className="block font-semibold text-slate-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        id="citizen-reg-name"
                        type="text"
                        placeholder="e.g. Ramesh Chandra"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="citizen-reg-phone" className="block font-semibold text-slate-700 mb-1">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
                        <input
                          id="citizen-reg-phone"
                          type="tel"
                          placeholder="+91 98480 12345"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          autoComplete="tel"
                          className="w-full pl-8 pr-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden font-mono tabular-nums"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Your phone number is shared with the assigned collector when you book a waste pickup.
                  </p>

                  <div>
                    <label htmlFor="citizen-reg-email" className="block font-semibold text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      id="citizen-reg-email"
                      type="email"
                      placeholder="name@domain.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="citizen-reg-pass" className="block font-semibold text-slate-700 mb-1">
                        Password *
                      </label>
                      <input
                        id="citizen-reg-pass"
                        type="password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="citizen-reg-confirm" className="block font-semibold text-slate-700 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        id="citizen-reg-confirm"
                        type="password"
                        placeholder="••••••••"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="citizen-reg-address" className="block font-semibold text-slate-700 mb-1">
                      Household Address *
                    </label>
                    <input
                      id="citizen-reg-address"
                      type="text"
                      placeholder="House no, Street name, Landmark"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0d7a34] focus:outline-hidden"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="citizen-reg-area" className="block font-semibold text-slate-700 mb-1">
                        Area *
                      </label>
                      <select
                        id="citizen-reg-area"
                        value={regArea}
                        onChange={(e) => setRegArea(e.target.value)}
                        className="w-full p-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 text-[11px]"
                      >
                        <option value="Warangal Urban">Warangal Urban</option>
                        <option value="Hanamkonda Central">Hanamkonda Central</option>
                        <option value="Subedari">Subedari</option>
                        <option value="Kazipet Junction">Kazipet Junction</option>
                        <option value="University Campus Zone">University Campus</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="citizen-reg-ward" className="block font-semibold text-slate-700 mb-1">
                        Ward *
                      </label>
                      <select
                        id="citizen-reg-ward"
                        value={regWard}
                        onChange={(e) => setRegWard(e.target.value)}
                        className="w-full p-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 text-[11px]"
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
                      <label htmlFor="citizen-reg-pincode" className="block font-semibold text-slate-700 mb-1">
                        PIN Code *
                      </label>
                      <input
                        id="citizen-reg-pincode"
                        type="text"
                        value={regPincode}
                        onChange={(e) => setRegPincode(e.target.value)}
                        className="w-full p-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50/70 text-[11px] font-mono tabular-nums"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-[44px] mt-2 py-2.5 rounded-lg bg-[#0d7a34] hover:bg-[#096429] text-white font-semibold text-sm shadow-xs transition whitespace-nowrap"
                  >
                    {isLoading ? 'Registering...' : 'Complete Citizen Registration'}
                  </button>

                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <button
                      type="button"
                      disabled={googleLoading || isLoading}
                      onClick={handleGoogleClick}
                      className="w-full min-h-[40px] py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                      <span>{googleLoading ? 'Connecting to Google...' : 'Sign up with Google'}</span>
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => switchAuthView('common-login')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0d7a34] hover:underline"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Already have an account? Login</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
