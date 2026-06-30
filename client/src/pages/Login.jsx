import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import RoleToggle from '../components/RoleToggle';
import FormField from '../components/FormField';
import { loginRequest, saveSession } from '../services/authService';
import styles from './Auth.module.css';

const ROLE_OPTIONS = [
  { label: 'Buy Tickets', value: 'CUSTOMER' },
  { label: 'Host Events', value: 'ORGANIZER' },
];

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
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.subtitle}>Sign in to your account</p>

      <p className={styles.roleLabel}>I want to</p>
      <RoleToggle value={role} onChange={setRole} options={ROLE_OPTIONS} />

      {alert && (
        <div className={`${styles.alert} ${styles[`alert_${alert.type}`]}`}>
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

        <button className={styles.submitBtn} type="submit" disabled={loading}>
          {loading ? <span className={styles.spinner} /> : 'Sign In'}
        </button>
      </form>

      <p className={styles.footer}>
        Don't have an account?{' '}
        <Link to="/signup" className={styles.link}>Sign up</Link>
      </p>
    </AuthLayout>
  );
}
