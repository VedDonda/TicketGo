// Admin API service
import { getToken } from "./authService";

const API_URL = `${import.meta.env.VITE_API_URL || "https://ticketgo-hu5q.onrender.com"}/api/admin`;

export const fetchPendingOrganizers = async () => {
  try {
    const res = await fetch(`${API_URL}/organizers/pending`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return { ok: res.ok, data: await res.json() };
  } catch (error) {
    return { ok: false, data: { message: "Network error" } };
  }
};

export const approveOrganizer = async (id) => {
  try {
    const res = await fetch(`${API_URL}/organizers/${id}/approve`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return { ok: res.ok, data: await res.json() };
  } catch (error) {
    return { ok: false, data: { message: "Network error" } };
  }
};

export const rejectOrganizer = async (id) => {
  try {
    const res = await fetch(`${API_URL}/organizers/${id}/reject`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    return { ok: res.ok, data: await res.json() };
  } catch (error) {
    return { ok: false, data: { message: "Network error" } };
  }
};
