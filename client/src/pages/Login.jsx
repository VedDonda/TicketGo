import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import RoleToggle from '../components/RoleToggle';
import FormField from '../components/FormField';
import { loginRequest, saveSession } from '../services/authService';

const ROLE_OPTIONS = [
  { label: 'Buy Tickets', value: 'CUSTOMER' },
  { label: 'Host Events', value: 'ORGANIZER' },
];

const authClasses = {
  title: "text-[1.9rem] font-bold text-text-primary mb-[6px] tracking-[-0.4px]",
  subtitle: "text-[0.9rem] text-text-secondary mb-[28px]",
  roleLabel: "text-[0.78rem] font-semibold uppercase tracking-[0.8px] text-text-secondary mb-[10px]",
  alertBase: "p-[11px_16px] rounded-sm text-[0.85rem] font-medium mb-[18px]",
  alertErr: "bg-[rgba(224,92,106,0.12)] text-error border border-[rgba(224,92,106,0.25)]",
  alertOk: "bg-[rgba(78,202,139,0.12)] text-success border border-[rgba(78,202,139,0.25)]",
  submitBtn: "w-full p-[13px] bg-accent text-white border-none rounded-sm font-inter text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 mt-2 flex items-center justify-center min-h-[46px] tracking-[0.2px] enabled:hover:bg-accent-hover enabled:hover:-translate-y-[1px] enabled:hover:shadow-[0_6px_20px_rgba(91,95,199,0.45)] active:translate-y-0 disabled:opacity-65 disabled:cursor-not-allowed",
  spinner: "w-[18px] h-[18px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin inline-block",
  footer: "text-center mt-[22px] text-[0.86rem] text-text-secondary",
  link: "text-accent no-underline font-semibold transition-colors duration-200 hover:text-[#8084e8] hover:underline"
};

export default function Login() {
  const navigate = useNavigate();

  const [role,     setRole]     = useState('CUSTOMER');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [errors,   setErrors]   = useState({});
  const [alert,    setAlert]    = useState(null); // { msg, type }
  const [loading,  setLoading]  = useState(false);

  const validate = () => {
    const e = {};
    if (!email)    e.email    = 'Email is required';
    if (!password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      const { ok, data } = await loginRequest(email, password);
      if (!ok) { setAlert({ msg: data.message || 'Login failed', type: 'err' }); return; }
      saveSession(data);
      navigate('/');
    } catch {
      setAlert({ msg: 'Network error. Please try again.', type: 'err' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className={authClasses.title}>Welcome back</h1>
      <p className={authClasses.subtitle}>Sign in to your account</p>

      <p className={authClasses.roleLabel}>I want to</p>
      <RoleToggle value={role} onChange={setRole} options={ROLE_OPTIONS} />

      {alert && (
        <div className={`${authClasses.alertBase} ${alert.type === 'err' ? authClasses.alertErr : authClasses.alertOk}`}>
          {alert.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          id="login-email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
          autoComplete="email"
        />
        <FormField
          id="login-password"
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
          autoComplete="current-password"
        />

        <button className={authClasses.submitBtn} type="submit" disabled={loading}>
          {loading ? <span className={authClasses.spinner} /> : 'Sign In'}
        </button>
      </form>

      <p className={authClasses.footer}>
        Don't have an account?{' '}
        <Link to="/signup" className={authClasses.link}>Sign up</Link>
      </p>
    </AuthLayout>
  );
}
