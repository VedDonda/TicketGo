const BASE_URL = import.meta.env.VITE_API_URL || "https://ticketgo-hu5q.onrender.com";
const API = `${BASE_URL}/api/events`;

export const fetchEvents = async (params = {}) => {
  const query = new URLSearchParams();

  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);
  if (params.category) query.set("category", params.category);
  if (params.city) query.set("city", params.city);
  if (params.search) query.set("search", params.search);
  const res = await fetch(`${API}?${query.toString()}`);

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const baseUrl = BASE_URL.replace(/\/api.*$/, "");
  return `${baseUrl}${url}`;
};

export const fetchEventById = async (id) => {
  const token = localStorage.getItem("tg_token");
  const headers = {};

  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}/${id}`, { headers });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const createEventRequest = async (payload) => {
  const token = localStorage.getItem("tg_token");
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const deleteEventRequest = async (id) => {
  const token = localStorage.getItem("tg_token");
  const res = await fetch(`${API}/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const uploadImageRequest = async (file) => {
  const token = localStorage.getItem("tg_token");
  const formData = new FormData();

  formData.append("image", file);
  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const updateEventImageRequest = async (id, imageUrl) => {
  const token = localStorage.getItem("tg_token");
  const res = await fetch(`${API}/${id}/image`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageUrl }),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const fetchMyCreatedEvents = async () => {
  const token = localStorage.getItem("tg_token");
  const res = await fetch(`${API}/organizer/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const publishEventRequest = async (eventId) => {
  const token = localStorage.getItem("tg_token");
  const res = await fetch(`${API}/${eventId}/publish`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const fetchDashboardMetrics = async (eventId) => {
  const token = localStorage.getItem("tg_token");
  const res = await fetch(`${API}/${eventId}/dashboard-metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};
