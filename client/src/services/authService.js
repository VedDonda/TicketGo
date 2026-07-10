// Token helpers
export const saveSession = (data) => {
  localStorage.setItem('tg_token', data.token);
  localStorage.setItem('tg_user', JSON.stringify(data.user));
};

export const getToken = () => localStorage.getItem('tg_token');

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('tg_user'));
  } catch {
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem('tg_token');
  localStorage.removeItem('tg_user');
};

// API calls
const API = '/api/auth';

export const loginRequest = async (email, password) => {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const signupRequest = async (name, email, password, role) => {
  const res = await fetch(`${API}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role }),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const verifyOtpRequest = async (email, otp) => {
  const res = await fetch(`${API}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const resendOtpRequest = async (email) => {
  const res = await fetch(`${API}/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};
