const API = '/api/events';

/**
 * Fetch the paginated public event feed.
 * @param {object} params - { page, limit, category, city, search }
 */
export const fetchEvents = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page)     query.set('page',     params.page);
  if (params.limit)    query.set('limit',    params.limit);
  if (params.category) query.set('category', params.category);
  if (params.city)     query.set('city',     params.city);
  if (params.search)   query.set('search',   params.search);

  const res = await fetch(`${API}?${query.toString()}`);
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Fetch a single event by ID.
 */
export const fetchEventById = async (id) => {
  const res = await fetch(`${API}/${id}`);
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Create a new event (ORGANIZER / ADMIN only).
 * Sends the JWT token from localStorage.
 * @param {object} payload - Full event body
 */
export const createEventRequest = async (payload) => {
  const token = localStorage.getItem('tg_token');
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Delete an event by ID (ADMIN only).
 */
export const deleteEventRequest = async (id) => {
  const token = localStorage.getItem('tg_token');
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Upload an image file for an event.
 */
export const uploadImageRequest = async (file) => {
  const token = localStorage.getItem('tg_token');
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Update the image of an event.
 */
export const updateEventImageRequest = async (id, imageUrl) => {
  const token = localStorage.getItem('tg_token');
  const res = await fetch(`${API}/${id}/image`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ imageUrl })
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Fetch events created by the logged-in organizer.
 */
export const fetchMyCreatedEvents = async () => {
  const token = localStorage.getItem('tg_token');
  const res = await fetch(`${API}/organizer/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Publish a draft event.
 */
export const publishEventRequest = async (eventId) => {
  const token = localStorage.getItem('tg_token');
  const res = await fetch(`${API}/${eventId}/publish`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Fetch dashboard metrics for an event.
 */
export const fetchDashboardMetrics = async (eventId) => {
  const token = localStorage.getItem('tg_token');
  const res = await fetch(`${API}/${eventId}/dashboard-metrics`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};
