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
