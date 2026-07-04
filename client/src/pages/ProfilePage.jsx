/**
 * ProfilePage.jsx — User profile, booking history, and password change.
 * Route: /profile
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, clearSession, saveSession } from '../services/authService';
import { fetchProfile, updateProfile, changePassword, fetchMyBookings } from '../services/userService';
import { fetchMyCreatedEvents } from '../services/eventService';

const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const formatDate  = (iso) => new Date(iso).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric',
});
const formatDateTime = (iso) => new Date(iso).toLocaleDateString('en-IN', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});

const CATEGORY_COLORS = {
  MUSIC:      { text: '#a78bfa', bg: 'rgba(139,92,246,0.1)'  },
  SPORTS:     { text: '#34d399', bg: 'rgba(16,185,129,0.1)'  },
  COMEDY:     { text: '#fbbf24', bg: 'rgba(245,158,11,0.1)'  },
  THEATRE:    { text: '#f87171', bg: 'rgba(239,68,68,0.1)'   },
  CONFERENCE: { text: '#60a5fa', bg: 'rgba(59,130,246,0.1)'  },
  OTHER:      { text: '#9ca3af', bg: 'rgba(107,114,128,0.1)' },
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const TicketIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
    <path d="M22 9V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-4z" />
  </svg>
);
const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 0 .5-4.5"/>
    <polyline points="3 3 3 7 7 7"/>
  </svg>
);
const CalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);



export default function ProfilePage() {
  const navigate = useNavigate();
  const localUser = getCurrentUser();
  const initial   = localUser?.name?.[0]?.toUpperCase() ?? 'U';

  const [activeTab, setActiveTab] = useState('bookings');

  // Profile state
  const [profile,        setProfile]        = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editName,       setEditName]       = useState('');
  const [editEmail,      setEditEmail]      = useState('');
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileMsg,     setProfileMsg]     = useState(null); // { type: 'success'|'error', text }

  // Password state
  const [curPwd,     setCurPwd]     = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving,  setPwdSaving]  = useState(false);
  const [pwdMsg,     setPwdMsg]     = useState(null);

  // Bookings state
  const [bookings,        setBookings]        = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [expandedEvent,   setExpandedEvent]   = useState(null);

  // My Events state
  const [myEvents,        setMyEvents]        = useState([]);
  const [myEventsLoading, setMyEventsLoading] = useState(true);

  // ── Load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setProfileLoading(true);
      try {
        const { ok, data } = await fetchProfile();
        if (ok && data.success) {
          setProfile(data.data);
          setEditName(data.data.name);
          setEditEmail(data.data.email);
        }
      } catch { /* silent */ }
      finally { setProfileLoading(false); }
    })();
  }, []);

  // ── Load bookings ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setBookingsLoading(true);
      try {
        const { ok, data } = await fetchMyBookings();
        if (ok && data.success) setBookings(data.data.bookings || []);
      } catch { /* silent */ }
      finally { setBookingsLoading(false); }
    })();
  }, []);

  // ── Load my events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (localUser?.role !== 'ORGANIZER' && localUser?.role !== 'ADMIN') return;
    (async () => {
      setMyEventsLoading(true);
      try {
        const { ok, data } = await fetchMyCreatedEvents();
        if (ok && data.success) setMyEvents(data.data.events || []);
      } catch { /* silent */ }
      finally { setMyEventsLoading(false); }
    })();
  }, [localUser?.role]);

  const handleLogout = () => { clearSession(); navigate('/login'); };

  // ── Save profile ─────────────────────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const { ok, data } = await updateProfile({ name: editName, email: editEmail });
      if (ok && data.success) {
        setProfile(data.data);
        // Update local storage so navbar reflects new name
        const stored = getCurrentUser();
        if (stored) {
          localStorage.setItem('tg_user', JSON.stringify({ ...stored, name: data.data.name, email: data.data.email }));
        }
        setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
      } else {
        setProfileMsg({ type: 'error', text: data.message || 'Update failed.' });
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ──────────────────────────────────────────────────────────
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    setPwdSaving(true);
    try {
      const { ok, data } = await changePassword(curPwd, newPwd);
      if (ok && data.success) {
        setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
        setCurPwd(''); setNewPwd(''); setConfirmPwd('');
      } else {
        setPwdMsg({ type: 'error', text: data.message || 'Failed to change password.' });
      }
    } catch {
      setPwdMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setPwdSaving(false);
    }
  };

  // ── Styles helpers ────────────────────────────────────────────────────────────
  const inputStyle = (focused) => ({
    width: '100%', padding: '11px 14px',
    background: '#0d0d10', border: `1px solid ${focused ? '#5b5fc7' : '#2a2a35'}`,
    borderRadius: 8, color: '#f0f0f5', fontSize: '0.9rem',
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  });

  const labelStyle = {
    display: 'block', fontSize: '0.72rem', fontWeight: 700,
    color: '#55556a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
  };

  const msgBox = (msg) => msg ? (
    <div style={{
      padding: '10px 14px', borderRadius: 8, fontSize: '0.83rem', marginTop: 14,
      background: msg.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.08)',
      border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(248,113,113,0.25)'}`,
      color: msg.type === 'success' ? '#22c55e' : '#f87171',
    }}>
      {msg.text}
    </div>
  ) : null;

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: '#0a0a0d', color: '#f0f0f5' }}>

      {/* Ambient background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 0%, rgba(91,95,199,0.15) 0%, transparent 60%)'
      }} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px 80px', position: 'relative' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg,#5b5fc7,#8084e8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 900, color: '#fff',
              boxShadow: '0 4px 20px rgba(91,95,199,0.35)',
            }}>
              {initial}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#f0f0f5' }}>
                {profile?.name || localUser?.name}
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '0.83rem', color: '#55556a' }}>
                {profile?.email || localUser?.email} · {profile?.role || localUser?.role}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 32,
          background: 'rgba(17,17,22,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
          borderRadius: 14, padding: 6,
        }}>
          {[
            { id: 'bookings',  label: 'My Bookings', Icon: HistoryIcon },
            ...(localUser?.role === 'ORGANIZER' || localUser?.role === 'ADMIN' ? [{ id: 'my-events', label: 'My Events', Icon: TicketIcon }] : []),
            { id: 'profile',   label: 'Profile',     Icon: UserIcon    },
            { id: 'password',  label: 'Password',    Icon: LockIcon    },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1, padding: '9px 16px',
                background: activeTab === id ? '#5b5fc7' : 'transparent',
                border: 'none', borderRadius: 9,
                color: activeTab === id ? '#fff' : '#8888a0',
                fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all 0.15s',
              }}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        {/* ── BOOKINGS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'bookings' && (
          <div>
            {bookingsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#55556a' }}>
                Loading bookings...
              </div>
            ) : bookings.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 24px',
                background: '#111116', border: '1px solid #1e1e28', borderRadius: 16,
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0f0f5', marginBottom: 8 }}>
                  No bookings yet
                </div>
                <p style={{ margin: '0 0 20px', color: '#55556a', fontSize: '0.88rem' }}>
                  Your confirmed ticket purchases will appear here.
                </p>
                <Link to="/" style={{
                  padding: '10px 22px', background: '#5b5fc7', color: '#fff',
                  borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem',
                }}>
                  Browse Events
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bookings.map((booking) => {
                  const cs  = CATEGORY_COLORS[booking.event?.category] || CATEGORY_COLORS.OTHER;
                  const isOpen = expandedEvent === booking.event?._id?.toString();
                  return (
                    <div
                      key={booking.event?._id}
                      style={{
                        background: '#111116', border: '1px solid #1e1e28',
                        borderRadius: 14, overflow: 'hidden',
                      }}
                    >
                      {/* Event row */}
                      <div
                        onClick={() => setExpandedEvent(isOpen ? null : booking.event?._id?.toString())}
                        style={{
                          padding: '16px 20px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                          {/* Color dot */}
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: cs.text, flexShrink: 0,
                            boxShadow: `0 0 8px ${cs.text}`,
                          }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#f0f0f5', fontSize: '0.95rem',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {booking.event?.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <span style={{ color: '#55556a', fontSize: '0.73rem' }}><CalIcon /></span>
                              <span style={{ color: '#55556a', fontSize: '0.75rem' }}>
                                {booking.event?.date ? formatDateTime(booking.event.date) : '—'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: '#55556a', marginBottom: 2 }}>
                              {booking.tickets?.length || 0} ticket{(booking.tickets?.length || 0) !== 1 ? 's' : ''}
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f0f0f5' }}>
                              {formatPrice(booking.totalPrice)}
                            </div>
                          </div>
                          <span style={{ color: '#55556a', fontSize: '0.8rem', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                        </div>
                      </div>

                      {/* Expanded tickets */}
                      {isOpen && (
                        <div style={{ borderTop: '1px solid #1e1e28', padding: '16px 20px' }}>
                          <div style={{ fontSize: '0.68rem', color: '#55556a', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
                            Tickets
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                            {booking.tickets.map((t) => (
                              <div key={t._id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 12px', background: '#0d0d10',
                                border: '1px solid #1e1e28', borderRadius: 8,
                              }}>
                                <span style={{ fontSize: '0.85rem', color: '#f0f0f5' }}>
                                  {t.isZone ? `${t.quantity}x ${t.section}` : `${t.section} · Row ${t.row} · Seat ${t.seatNumber}`}
                                </span>
                                <span style={{ fontSize: '0.85rem', color: '#8084e8', fontWeight: 700 }}>
                                  {formatPrice(t.price)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Link
                              to={`/events/${booking.event?._id}`}
                              style={{
                                fontSize: '0.82rem', color: '#8084e8', fontWeight: 700,
                                textDecoration: 'none',
                              }}
                            >
                              View Event
                            </Link>
                            <div style={{ fontSize: '0.8rem' }}>
                              <span style={{ color: '#55556a' }}>Booked on </span>
                              <span style={{ color: '#8888a0' }}>{formatDate(booking.bookedAt)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MY EVENTS TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'my-events' && (
          <div>
            {myEventsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#55556a' }}>
                Loading events...
              </div>
            ) : myEvents.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 24px',
                background: 'rgba(17,17,22,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: 16,
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0f0f5', marginBottom: 8 }}>
                  No events created yet
                </div>
                <Link to="/events/create" style={{
                  display: 'inline-block', marginTop: 12, padding: '10px 22px', background: 'linear-gradient(135deg,#5b5fc7,#8084e8)', color: '#fff',
                  borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem',
                }}>
                  Create Event
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {myEvents.map((ev) => {
                  const cs = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.OTHER;
                  return (
                    <Link
                      to={`/events/${ev._id}/dashboard`}
                      key={ev._id}
                      style={{
                        background: 'rgba(17,17,22,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
                        borderRadius: 14, overflow: 'hidden', padding: '16px 20px', textDecoration: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                        transition: 'border-color 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#5b5fc7'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                        {ev.imageUrl ? (
                           <img src={ev.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                           <div style={{ width: 44, height: 44, borderRadius: 8, background: cs.bg, border: `1px solid ${cs.text}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cs.text, fontSize: '0.6rem', fontWeight: 700 }}>{ev.category}</div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#f0f0f5', fontSize: '0.95rem',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span style={{ color: '#55556a', fontSize: '0.73rem' }}><CalIcon /></span>
                            <span style={{ color: '#55556a', fontSize: '0.75rem' }}>
                              {ev.date ? formatDateTime(ev.date) : '—'}
                            </span>
                            <span style={{
                              marginLeft: 6, padding: '2px 8px', borderRadius: 12, fontSize: '0.6rem', fontWeight: 800,
                              background: ev.status === 'PUBLISHED' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                              color: ev.status === 'PUBLISHED' ? '#22c55e' : '#f59e0b'
                            }}>{ev.status}</span>
                          </div>
                        </div>
                      </div>
                      <span style={{ color: '#8084e8', fontSize: '0.8rem', fontWeight: 700 }}>View ➝</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ──────────────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div style={{
            background: 'rgba(17,17,22,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
            borderRadius: 16, padding: '32px 40px',
          }}>
            <h2 style={{ margin: '0 0 28px', fontSize: '1.15rem', fontWeight: 800, color: '#f0f0f5', letterSpacing: '0.3px' }}>
              Profile Information
            </h2>

            {profileLoading ? (
              <p style={{ color: '#55556a' }}>Loading...</p>
            ) : (
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (profileMsg) setProfileMsg(null);
                    }}
                    required
                    style={inputStyle(false)}
                    onFocus={(e) => e.target.style.borderColor = '#5b5fc7'}
                    onBlur={(e) => e.target.style.borderColor = '#2a2a35'}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => {
                      setEditEmail(e.target.value);
                      if (profileMsg) setProfileMsg(null);
                    }}
                    required
                    style={inputStyle(false)}
                    onFocus={(e) => e.target.style.borderColor = '#5b5fc7'}
                    onBlur={(e) => e.target.style.borderColor = '#2a2a35'}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Role</label>
                  <div style={{
                    padding: '11px 14px', background: '#0d0d10',
                    border: '1px solid #1e1e28', borderRadius: 8,
                    color: '#55556a', fontSize: '0.9rem',
                  }}>
                    {profile?.role}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Member Since</label>
                  <div style={{
                    padding: '11px 14px', background: '#0d0d10',
                    border: '1px solid #1e1e28', borderRadius: 8,
                    color: '#55556a', fontSize: '0.9rem',
                  }}>
                    {profile?.createdAt ? formatDate(profile.createdAt) : '—'}
                  </div>
                </div>
                {msgBox(profileMsg)}
                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    marginTop: 6, padding: '12px 28px',
                    background: profileSaving ? '#2a2a35' : 'linear-gradient(135deg,#5b5fc7,#8084e8)',
                    border: 'none', borderRadius: 10,
                    color: profileSaving ? '#55556a' : '#fff',
                    fontSize: '0.9rem', fontWeight: 700,
                    cursor: profileSaving ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: profileSaving ? 'none' : '0 4px 20px rgba(91,95,199,0.35)',
                  }}
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── PASSWORD TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'password' && (
          <div style={{
            background: 'rgba(17,17,22,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
            borderRadius: 16, padding: '32px 40px',
          }}>
            <h2 style={{ margin: '0 0 28px', fontSize: '1.15rem', fontWeight: 800, color: '#f0f0f5', letterSpacing: '0.3px' }}>
              Change Password
            </h2>

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Current Password</label>
                <input
                  type="password"
                  value={curPwd}
                  onChange={(e) => {
                    setCurPwd(e.target.value);
                    if (pwdMsg) setPwdMsg(null);
                  }}
                  required
                  placeholder="Enter current password"
                  style={inputStyle(false)}
                  onFocus={(e) => e.target.style.borderColor = '#5b5fc7'}
                  onBlur={(e) => e.target.style.borderColor = '#2a2a35'}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewPwd(val);
                    if (pwdMsg?.type === 'error' && pwdMsg.text.includes('6 characters') && val.length >= 6) setPwdMsg(null);
                    if (pwdMsg?.type === 'error' && pwdMsg.text.includes('match') && val === confirmPwd) setPwdMsg(null);
                    if (pwdMsg?.type === 'success') setPwdMsg(null);
                  }}
                  required
                  placeholder="At least 6 characters"
                  style={inputStyle(false)}
                  onFocus={(e) => e.target.style.borderColor = '#5b5fc7'}
                  onBlur={(e) => e.target.style.borderColor = '#2a2a35'}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConfirmPwd(val);
                    if (pwdMsg?.type === 'error' && pwdMsg.text.includes('match') && val === newPwd) setPwdMsg(null);
                    if (pwdMsg?.type === 'success') setPwdMsg(null);
                  }}
                  required
                  placeholder="Repeat new password"
                  style={inputStyle(false)}
                  onFocus={(e) => e.target.style.borderColor = '#5b5fc7'}
                  onBlur={(e) => e.target.style.borderColor = '#2a2a35'}
                />
              </div>
              {msgBox(pwdMsg)}
              <button
                type="submit"
                disabled={pwdSaving}
                style={{
                  marginTop: 16, padding: '12px 28px',
                  background: pwdSaving ? '#2a2a35' : 'linear-gradient(135deg,#5b5fc7,#8084e8)',
                  border: 'none', borderRadius: 10,
                  color: pwdSaving ? '#55556a' : '#fff',
                  fontSize: '0.9rem', fontWeight: 700,
                  cursor: pwdSaving ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: pwdSaving ? 'none' : '0 4px 20px rgba(91,95,199,0.35)',
                }}
              >
                {pwdSaving ? 'Saving...' : 'Change Password'}
              </button>
            </form>
          </div>
        )}
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
    </div>
  );
}
