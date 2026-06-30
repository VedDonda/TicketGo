import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import RoleToggle from '../components/RoleToggle';
import FormField from '../components/FormField';
import { signupRequest, saveSession } from '../services/authService';
import styles from './Auth.module.css';

const ROLE_OPTIONS = [
  { label: 'Ticket Buyer', value: 'CUSTOMER' },
  { label: 'Event Host',   value: 'ORGANIZER' },
];

export default function Signup() {
  const navigate = useNavigate();

  const [role,     setRole]     = useState('CUSTOMER');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [errors,   setErrors]   = useState({});
  const [alert,    setAlert]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const validate = () => {
    const e = {};
    if (!name)                           e.name     = 'Name is required';
    if (!email)                          e.email    = 'Email is required';
    if (!password)                       e.password = 'Password is required';
    else if (password.length < 6)        e.password = 'Min 6 characters';
    if (password && confirm !== password) e.confirm  = 'Passwords do not match';
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
      const { ok, data } = await signupRequest(name, email, password, role);
      if (!ok) { setAlert({ msg: data.message || 'Signup failed', type: 'err' }); return; }
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
      <h1 className={styles.title}>Create account</h1>
      <p className={styles.subtitle}>Join thousands of event-goers today</p>

      <p className={styles.roleLabel}>I am a</p>
      <RoleToggle value={role} onChange={setRole} options={ROLE_OPTIONS} />

      {alert && (
        <div className={`${styles.alert} ${styles[`alert_${alert.type}`]}`}>
          {alert.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          id="signup-name"
          label="Full Name"
          type="text"
          placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
          autoComplete="name"
        />
        <FormField
          id="signup-email"
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
          id="signup-password"
          label="Password"
          type="password"
          placeholder="Min. 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
          autoComplete="new-password"
        />
        <FormField
          id="signup-confirm"
          label="Confirm Password"
          type="password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          required
          autoComplete="new-password"
        />

        <button className={styles.submitBtn} type="submit" disabled={loading}>
          {loading ? <span className={styles.spinner} /> : 'Create Account'}
        </button>
      </form>

      <p className={styles.footer}>
        Already have an account?{' '}
        <Link to="/login" className={styles.link}>Sign in</Link>
      </p>
    </AuthLayout>
  );
}
