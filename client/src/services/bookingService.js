const API = `${import.meta.env.VITE_API_URL || ""}/api/events`;
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("tg_token")}`,
});

// Booking API service
import { getToken } from "./authService";

export const fetchSeats = async (eventId) => {
  const res = await fetch(`${API}/${eventId}/seats`, {
    headers: authHeaders(),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const fetchZones = async (eventId) => {
  const res = await fetch(`${API}/${eventId}/zones`, {
    headers: authHeaders(),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const holdSeats = async (eventId, payload) => {
  const res = await fetch(`${API}/${eventId}/hold`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const releaseHold = async (eventId, payload = {}) => {
  const res = await fetch(`${API}/${eventId}/release`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};

export const confirmPurchase = async (eventId, payload = {}) => {
  const res = await fetch(`${API}/${eventId}/confirm`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  return res.json().then((data) => ({ ok: res.ok, data }));
};
