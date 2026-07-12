const BASE_URL = import.meta.env.VITE_API_URL || "https://ticketgo-hu5q.onrender.com";
const API = `${BASE_URL}/api/users`;
const AUTH_API = `${BASE_URL}/api/auth`;
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("tg_token")}`,
});

export const fetchProfile = async () => {
  const res = await fetch(`${API}/me/profile`, { headers: authHeaders() });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const updateProfile = async (payload) => {
  const res = await fetch(`${API}/me/profile`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ name: payload.name }),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const changePassword = async (currentPassword, newPassword) => {
  const res = await fetch(`${API}/me/password`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const fetchMyBookings = async () => {
  const res = await fetch(`${API}/me/bookings`, { headers: authHeaders() });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const fetchMyEventTickets = async (eventId) => {
  const res = await fetch(`${BASE_URL}/api/events/${eventId}/my-tickets`, {
    headers: authHeaders(),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const forgotPassword = async (email) => {
  const res = await fetch(`${AUTH_API}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const resetPassword = async (email, otp, newPassword) => {
  const res = await fetch(`${AUTH_API}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, newPassword }),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};
