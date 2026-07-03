const API = '/api/users';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('tg_token')}`,
});

export const fetchProfile = async () => {
  const res = await fetch(`${API}/me/profile`, { headers: authHeaders() });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const updateProfile = async (payload) => {
  const res = await fetch(`${API}/me/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const changePassword = async (currentPassword, newPassword) => {
  const res = await fetch(`${API}/me/password`, {
    method: 'PUT',
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
  const res = await fetch(`/api/events/${eventId}/my-tickets`, { headers: authHeaders() });
  return res.json().then((data) => ({ ok: res.ok, data }));
};
