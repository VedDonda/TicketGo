const API_BASE = '/api/auth';

/* ── Helpers ── */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showAlert(el, msg, type = 'err') {
  el.textContent = msg;
  el.className = `alert visible alert-${type}`;
}
function hideAlert(el) { el.className = 'alert'; }

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

function showFieldError(inputEl, msg) {
  const errEl = inputEl.closest('.field-group')?.querySelector('.field-error');
  inputEl.classList.add('error');
  if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
}
function clearFieldErrors() {
  $$('.field-input.error').forEach(el => el.classList.remove('error'));
  $$('.field-error.visible').forEach(el => el.classList.remove('visible'));
}

/* ── Password toggle ── */
function initPasswordToggles() {
  $$('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.innerHTML = isText ? eyeClosedIcon() : eyeOpenIcon();
    });
  });
}

function eyeOpenIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function eyeClosedIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

/* ── Role toggle ── */
function initRoleToggle(onRoleChange) {
  const btns = $$('.role-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (onRoleChange) onRoleChange(btn.dataset.role);
    });
  });
}

function getActiveRole() {
  const active = $('.role-btn.active');
  return active ? active.dataset.role : 'CUSTOMER';
}

/* ── Token helpers ── */
function saveSession(data) {
  localStorage.setItem('tg_token', data.token);
  localStorage.setItem('tg_user',  JSON.stringify(data.user));
}

function getToken()     { return localStorage.getItem('tg_token'); }
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('tg_user')); } catch { return null; }
}
function clearSession() {
  localStorage.removeItem('tg_token');
  localStorage.removeItem('tg_user');
}

/* ── Redirect if already logged in ── */
function redirectIfLoggedIn() {
  if (getToken()) window.location.href = '/';
}

/* ── LOGIN ── */
async function handleLogin(e) {
  e.preventDefault();
  clearFieldErrors();

  const emailEl = $('#login-email');
  const pwEl    = $('#login-password');
  const alertEl = $('#login-alert');
  const btn     = $('#login-btn');

  const email    = emailEl.value.trim();
  const password = pwEl.value;

  let valid = true;
  if (!email)    { showFieldError(emailEl, 'Email is required');    valid = false; }
  if (!password) { showFieldError(pwEl,    'Password is required'); valid = false; }
  if (!valid) return;

  hideAlert(alertEl);
  setLoading(btn, true);

  try {
    const res  = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(alertEl, data.message || 'Login failed');
      return;
    }

    saveSession(data);
    window.location.href = '/';
  } catch {
    showAlert(alertEl, 'Network error. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

/* ── SIGNUP ── */
async function handleSignup(e) {
  e.preventDefault();
  clearFieldErrors();

  const nameEl  = $('#signup-name');
  const emailEl = $('#signup-email');
  const pwEl    = $('#signup-password');
  const cpwEl   = $('#signup-confirm-password');
  const alertEl = $('#signup-alert');
  const btn     = $('#signup-btn');

  const name     = nameEl.value.trim();
  const email    = emailEl.value.trim();
  const password = pwEl.value;
  const confirm  = cpwEl.value;
  const role     = getActiveRole();

  let valid = true;
  if (!name)                       { showFieldError(nameEl,  'Name is required');               valid = false; }
  if (!email)                      { showFieldError(emailEl, 'Email is required');               valid = false; }
  if (!password)                   { showFieldError(pwEl,    'Password is required');            valid = false; }
  else if (password.length < 6)    { showFieldError(pwEl,    'Min 6 characters');                valid = false; }
  if (password && confirm !== password) { showFieldError(cpwEl, 'Passwords do not match');      valid = false; }
  if (!valid) return;

  hideAlert(alertEl);
  setLoading(btn, true);

  try {
    const res  = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(alertEl, data.message || 'Signup failed');
      return;
    }

    saveSession(data);
    window.location.href = '/';
  } catch {
    showAlert(alertEl, 'Network error. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

/* ── HOME PAGE ── */
function initHome() {
  const user = getCurrentUser();
  const navActions = $('#nav-actions');
  if (!navActions) return;

  if (user) {
    const initial = user.name ? user.name[0].toUpperCase() : 'U';
    navActions.innerHTML = `
      <div class="nav-user">
        <div class="nav-avatar">${initial}</div>
        <span>${user.name}</span>
        <button class="btn-logout" id="logout-btn">Logout</button>
      </div>
    `;
    $('#logout-btn').addEventListener('click', () => {
      clearSession();
      window.location.reload();
    });

    // Update hero CTA
    const heroCta = $('#hero-cta');
    if (heroCta) {
      const roleLabel = user.role === 'ORGANIZER' ? 'Dashboard' : 'Browse Events';
      heroCta.innerHTML = `
        <a href="#" class="btn-hero">${roleLabel}</a>
        <a href="#" class="btn-hero-outline">Learn More</a>
      `;
    }
  }
}
