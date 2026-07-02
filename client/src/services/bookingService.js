/**
 * bookingService.js — API helpers for the booking flow.
 *
 * All calls include the JWT token from localStorage.
 */

const API = '/api/events';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('tg_token')}`,
});

/** Fetch live seat map for a RESERVED_SEATING event */
export const fetchSeats = async (eventId) => {
  const res = await fetch(`${API}/${eventId}/seats`, { headers: authHeaders() });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/** Fetch live zone availability for a ZONED_CAPACITY event */
export const fetchZones = async (eventId) => {
  const res = await fetch(`${API}/${eventId}/zones`, { headers: authHeaders() });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Hold seats or zone quantity for 10 minutes.
 *
 * RESERVED_SEATING: payload = { seats: [{ section, row, seatNumber }] }
 * ZONED_CAPACITY:   payload = { zoneName, quantity }
 */
export const holdSeats = async (eventId, payload) => {
  const res = await fetch(`${API}/${eventId}/hold`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Explicitly release a hold.
 *
 * RESERVED_SEATING: payload = {} (server releases all held by current user)
 * ZONED_CAPACITY:   payload = { holdId }
 */
export const releaseHold = async (eventId, payload = {}) => {
  const res = await fetch(`${API}/${eventId}/release`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};

/**
 * Confirm purchase (stub payment).
 *
 * RESERVED_SEATING: payload = {} (server confirms all HELD by current user)
 * ZONED_CAPACITY:   payload = { holdId }
 */
export const confirmPurchase = async (eventId, payload = {}) => {
  const res = await fetch(`${API}/${eventId}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json().then((data) => ({ ok: res.ok, data }));
};
