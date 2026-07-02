import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getCurrentUser, clearSession } from '../services/authService';
import { fetchEventById } from '../services/eventService';
import BookingModal from '../components/BookingModal';

// ─── Icons ────────────────────────────────────────────────────────────────────
const TicketIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
    <path d="M22 9V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-4z" />
  </svg>
);
const CalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const PinIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const SeatIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>
  </svg>
);
const ZoneIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  MUSIC:      { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)',  text: '#a78bfa' },
  SPORTS:     { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#34d399' },
  COMEDY:     { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#fbbf24' },
  THEATRE:    { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171' },
  CONFERENCE: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', text: '#60a5fa' },
  OTHER:      { bg: 'rgba(107,114,128,0.12)',border: 'rgba(107,114,128,0.35)',text: '#9ca3af' },
};
const CAT_EMOJI = { MUSIC:'🎵', SPORTS:'🏆', COMEDY:'😂', THEATRE:'🎭', CONFERENCE:'💼', OTHER:'🎪' };

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function EventDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const user     = getCurrentUser();
  const initial  = user?.name?.[0]?.toUpperCase() ?? 'U';

  const [event,           setEvent]           = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { ok, data } = await fetchEventById(id);
        if (ok && data.success) setEvent(data.data.event);
        else setError(data.message || 'Event not found');
      } catch {
        setError('Could not load event. Check your connection.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleLogout = () => { clearSession(); navigate('/login'); };

  const cs = event ? (CATEGORY_COLORS[event.category] || CATEGORY_COLORS.OTHER) : {};

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#8888a0' }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>🎟️</div>
        <p style={{ fontFamily: 'Inter, sans-serif' }}>Loading event…</p>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>😕</div>
        <h2 style={{ color: '#f0f0f5', margin: '0 0 8px' }}>Event not found</h2>
        <p style={{ color: '#e05c6a', marginBottom: 24 }}>{error}</p>
        <Link to="/" style={{ padding: '10px 24px', background: '#5b5fc7', color: '#fff',
          borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>← Back to Events</Link>
      </div>
    </div>
  );

  // ── Seat/Zone price range ─────────────────────────────────────────────────
  const priceRange = (() => {
    if (!event) return null;
    if (event.eventType === 'RESERVED_SEATING' && event.seatingConfig?.length) {
      const prices = event.seatingConfig.map(s => s.price);
      const min = Math.min(...prices), max = Math.max(...prices);
      return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
    }
    if (event.eventType === 'ZONED_CAPACITY' && event.zoningConfig?.length) {
      const prices = event.zoningConfig.map(z => z.price);
      const min = Math.min(...prices), max = Math.max(...prices);
      return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
    }
    return 'See details';
  })();

  const totalCapacity = (() => {
    if (event.eventType === 'RESERVED_SEATING' && event.seatingConfig?.length)
      return event.seatingConfig.reduce((t, s) => t + s.rows * s.seatsPerRow, 0);
    if (event.eventType === 'ZONED_CAPACITY' && event.zoningConfig?.length)
      return event.zoningConfig.reduce((t, z) => t + z.totalSeats, 0);
    return event.venue?.totalCapacity || 0;
  })();

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: '#0d0d0f', color: '#f0f0f5' }}>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 64, background: 'rgba(13,13,15,0.95)',
        backdropFilter: 'blur(12px)', borderBottom: '1px solid #2a2a35',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, background: '#5b5fc7', borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TicketIcon />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0f0f5' }}>TicketGo</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#5b5fc7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>{initial}</div>
          <span style={{ fontSize: '0.875rem', color: '#f0f0f5' }}>{user?.name}</span>
          <button onClick={handleLogout} style={{
            padding: '6px 14px', background: 'transparent', border: '1px solid #2a2a35',
            color: '#8888a0', borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
          }}>Logout</button>
        </div>
      </nav>

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div style={{
        height: 300, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${cs.bg?.replace('0.15','0.5')} 0%, rgba(13,13,15,0.9) 100%), #0d0d0f`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', inset: 0, background:
          `radial-gradient(ellipse 80% 80% at 50% 50%, ${cs.bg?.replace('0.15','0.25')} 0%, transparent 70%)` }} />

        {event.imageUrl ? (
          <img src={event.imageUrl} alt={event.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }} />
        ) : (
          <span style={{ fontSize: '6rem', position: 'relative', filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.1))' }}>
            {CAT_EMOJI[event.category] || '🎟️'}
          </span>
        )}

        {/* Back link */}
        <Link to="/" style={{
          position: 'absolute', top: 20, left: 24,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#8888a0', textDecoration: 'none', fontSize: '0.83rem',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
          padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)',
          transition: 'color 0.2s',
        }}>← Back to Events</Link>

        {/* Status badge */}
        <span style={{
          position: 'absolute', top: 20, right: 24,
          background: event.status === 'PUBLISHED' ? 'rgba(78,202,139,0.15)' : 'rgba(245,158,11,0.15)',
          border: event.status === 'PUBLISHED' ? '1px solid rgba(78,202,139,0.4)' : '1px solid rgba(245,158,11,0.4)',
          color: event.status === 'PUBLISHED' ? '#4eca8b' : '#fbbf24',
          borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>{event.status}</span>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px', display: 'grid',
        gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start', marginTop: -60, position: 'relative' }}>

        {/* ── Left column ─────────────────────────────────────────── */}
        <div>
          {/* Category + type pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{
              background: cs.bg, border: `1px solid ${cs.border}`, color: cs.text,
              borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>{event.category}</span>
            <span style={{
              background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#8888a0', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px',
            }}>{event.eventType === 'RESERVED_SEATING' ? '💺 Reserved Seating' : '🟢 General Admission'}</span>
          </div>

          {/* Title */}
          <h1 style={{ margin: '0 0 24px', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            {event.title}
          </h1>

          {/* Meta info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
            {[
              { icon: <CalIcon />, label: 'Date', value: formatDate(event.date) },
              { icon: <CalIcon />, label: 'Time', value: formatTime(event.date) },
              { icon: <PinIcon />, label: 'Venue', value: event.venue?.name },
              { icon: <PinIcon />, label: 'City',  value: `${event.venue?.city}, ${event.venue?.address}` },
              { icon: <UserIcon />, label: 'Organiser', value: event.organizer?.name || '—' },
              { icon: <SeatIcon />, label: 'Total Capacity', value: totalCapacity.toLocaleString('en-IN') },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{
                background: '#161619', border: '1px solid #2a2a35', borderRadius: 10, padding: '12px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ color: '#5b5fc7', marginTop: 2, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#55556a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: '0.88rem', color: '#f0f0f5', fontWeight: 500 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{ background: '#161619', border: '1px solid #2a2a35', borderRadius: 12, padding: '24px', marginBottom: 28 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#8084e8' }}>About this event</h2>
            <p style={{ margin: 0, color: '#8888a0', lineHeight: 1.75, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
              {event.description}
            </p>
          </div>

          {/* Seating / Zones breakdown */}
          {event.eventType === 'RESERVED_SEATING' && event.seatingConfig?.length > 0 && (
            <div style={{ background: '#161619', border: '1px solid #2a2a35', borderRadius: 12, padding: '24px' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#8084e8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <SeatIcon /> Seating Sections
              </h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {event.seatingConfig.map((sec, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#0d0d0f', border: '1px solid #2a2a35', borderRadius: 8,
                    padding: '10px 16px',
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#f0f0f5', fontSize: '0.9rem' }}>{sec.section}</span>
                      <span style={{ color: '#55556a', fontSize: '0.78rem', marginLeft: 10 }}>
                        {sec.rows} rows × {sec.seatsPerRow} seats = {(sec.rows * sec.seatsPerRow).toLocaleString('en-IN')} seats
                      </span>
                    </div>
                    <span style={{
                      background: 'rgba(91,95,199,0.15)', border: '1px solid rgba(91,95,199,0.3)',
                      color: '#8084e8', borderRadius: 6, padding: '3px 10px', fontSize: '0.82rem', fontWeight: 700,
                    }}>{formatPrice(sec.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.eventType === 'ZONED_CAPACITY' && event.zoningConfig?.length > 0 && (
            <div style={{ background: '#161619', border: '1px solid #2a2a35', borderRadius: 12, padding: '24px' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#8084e8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ZoneIcon /> Zones
              </h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {event.zoningConfig.map((zone, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#0d0d0f', border: '1px solid #2a2a35', borderRadius: 8,
                    padding: '10px 16px',
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#f0f0f5', fontSize: '0.9rem' }}>{zone.zoneName}</span>
                      <span style={{ color: '#55556a', fontSize: '0.78rem', marginLeft: 10 }}>
                        {zone.totalSeats.toLocaleString('en-IN')} seats available
                      </span>
                    </div>
                    <span style={{
                      background: 'rgba(91,95,199,0.15)', border: '1px solid rgba(91,95,199,0.3)',
                      color: '#8084e8', borderRadius: 6, padding: '3px 10px', fontSize: '0.82rem', fontWeight: 700,
                    }}>{formatPrice(zone.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column — Booking card ─────────────────────────── */}
        <div style={{ position: 'sticky', top: 84 }}>
          <div style={{
            background: '#161619', border: '1px solid #2a2a35', borderRadius: 16, padding: 24,
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          }}>
            {/* Price */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #2a2a35' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#55556a', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px' }}>Starting from</p>
              <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#f0f0f5', letterSpacing: '-0.5px' }}>
                {priceRange}
              </p>
            </div>

            {/* Date + Venue summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#8888a0', fontSize: '0.85rem' }}>
                <CalIcon />
                <span>{formatDate(event.date)} · {formatTime(event.date)}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#8888a0', fontSize: '0.85rem' }}>
                <PinIcon />
                <span>{event.venue?.name}, {event.venue?.city}</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              id="book-ticket-btn"
              onClick={() => setShowBookingModal(true)}
              style={{
                width: '100%', padding: '14px', background: '#5b5fc7', border: 'none',
                borderRadius: 10, color: '#fff', fontSize: '1rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                boxShadow: '0 4px 20px rgba(91,95,199,0.4)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#4a4eb8'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#5b5fc7'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              🎟️ Book Tickets
            </button>

            <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: '0.75rem', color: '#55556a' }}>
              Secure checkout · Instant confirmation
            </p>

            {/* Capacity info */}
            <div style={{
              marginTop: 20, paddingTop: 20, borderTop: '1px solid #2a2a35',
              display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem',
            }}>
              <span style={{ color: '#55556a' }}>Total capacity</span>
              <span style={{ color: '#f0f0f5', fontWeight: 700 }}>{totalCapacity.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: 8 }}>
              <span style={{ color: '#55556a' }}>Event type</span>
              <span style={{ color: '#f0f0f5', fontWeight: 600 }}>
                {event.eventType === 'RESERVED_SEATING' ? '💺 Reserved' : '🟢 GA'}
              </span>
            </div>
          </div>

          {/* Share / Save (placeholder) */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {['🔗 Share', '❤️ Save'].map(label => (
              <button key={label} onClick={() => {}} style={{
                flex: 1, padding: '10px', background: 'transparent',
                border: '1px solid #2a2a35', borderRadius: 8, color: '#8888a0',
                fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#5b5fc7'; e.currentTarget.style.color = '#8084e8'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = '#8888a0'; }}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Booking Modal ───────────────────────────────────────────────── */}
      {showBookingModal && (
        <BookingModal
          event={event}
          onClose={() => setShowBookingModal(false)}
        />
      )}

    </div>
  );
}
