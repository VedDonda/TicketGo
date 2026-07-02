/**
 * BookingModal.jsx — Full-screen overlay booking flow.
 *
 * States:
 *  1. SELECTING  — shows SeatMap (RESERVED_SEATING) or ZonePicker (ZONED_CAPACITY)
 *  2. CHECKOUT   — shows held items + 10-min countdown + "Confirm Purchase" / "Cancel"
 *  3. SUCCESS    — shows booking confirmation with ticket details
 *  4. EXPIRED    — shown when countdown hits 00:00 before purchase
 *
 * WebSocket:
 *  - Connects once on mount, joins `event:<id>` room
 *  - Passes socket down to SeatMap / ZonePicker for live updates
 *  - Disconnects on unmount
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import SeatMap   from './SeatMap';
import ZonePicker from './ZonePicker';
import { releaseHold, confirmPurchase } from '../services/bookingService';

const HOLD_SECONDS = 10 * 60; // 600s = 10 minutes
const formatPrice  = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtTime = (secs) => {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
};

// ─── Modal stages ─────────────────────────────────────────────────────────────
const STAGE = { SELECTING: 'SELECTING', CHECKOUT: 'CHECKOUT', SUCCESS: 'SUCCESS', EXPIRED: 'EXPIRED' };

export default function BookingModal({ event, onClose }) {
  const [stage,    setStage]    = useState(STAGE.SELECTING);
  const [holdData, setHoldData] = useState(null);   // data returned by /hold
  const [timeLeft, setTimeLeft] = useState(HOLD_SECONDS);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [successData,  setSuccessData]  = useState(null);

  const socketRef     = useRef(null);
  const timerRef      = useRef(null);
  const releasedRef   = useRef(false); // guard against double-release

  // ── WebSocket setup ─────────────────────────────────────────────────────────
  // Connect directly to the backend port — bypasses Vite's WS proxy which
  // conflicts with Vite's own HMR WebSocket on the same upgrade path.
  // CORS on the server already allows localhost:3000.
  useEffect(() => {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL ||
      `${window.location.protocol}//${window.location.hostname}:5000`;

    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:event', { eventId: event._id });
    });

    return () => {
      socket.emit('leave:event', { eventId: event._id });
      socket.disconnect();
    };
  }, [event._id]);

  // ── Countdown timer (starts after hold is placed) ───────────────────────────
  const startTimer = useCallback((expiresAt) => {
    const target = new Date(expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((target - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(timerRef.current);
        setStage(STAGE.EXPIRED);
        // Auto-release if not already done
        if (!releasedRef.current) {
          releasedRef.current = true;
          // Best-effort silent release — server will lazy-expire anyway
          releaseHold(event._id, holdData ? { holdId: holdData.holdId } : {}).catch(() => {});
        }
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
  }, [event._id, holdData]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Called by SeatMap / ZonePicker when hold is confirmed ───────────────────
  const handleHoldConfirmed = useCallback((data) => {
    setHoldData(data);
    setStage(STAGE.CHECKOUT);
    releasedRef.current = false;
    startTimer(data.expiresAt);
  }, [startTimer]);

  // ── Explicit cancel ─────────────────────────────────────────────────────────
  const handleCancel = async () => {
    clearInterval(timerRef.current);
    if (!releasedRef.current && holdData) {
      releasedRef.current = true;
      try {
        await releaseHold(event._id, holdData.holdId ? { holdId: holdData.holdId } : {});
      } catch { /* silent */ }
    }
    onClose();
  };

  // ── Confirm purchase ─────────────────────────────────────────────────────────
  const handleConfirmPurchase = async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      const payload = holdData?.holdId ? { holdId: holdData.holdId } : {};
      const { ok, data } = await confirmPurchase(event._id, payload);
      if (ok && data.success) {
        clearInterval(timerRef.current);
        releasedRef.current = true;
        setSuccessData(data.data);
        setStage(STAGE.SUCCESS);
      } else {
        setConfirmError(data.message || 'Purchase failed. Please try again.');
        if (data.message?.includes('expired')) setStage(STAGE.EXPIRED);
      }
    } catch {
      setConfirmError('Network error. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  // ── Timer colour (green → amber → red) ────────────────────────────────────
  const timerColor =
    timeLeft > 300 ? '#22c55e' :
    timeLeft > 60  ? '#f59e0b' : '#ef4444';

  // ── Derived: is RESERVED or ZONED? ────────────────────────────────────────
  const isReserved = event.eventType === 'RESERVED_SEATING';

  // ── Styles ─────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.82)',
    backdropFilter: 'blur(10px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
    padding: '20px',
  };

  const panel = {
    background: '#111116',
    border: '1px solid #2a2a35',
    borderRadius: 20,
    width: '100%',
    maxWidth: isReserved ? 860 : 560,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && handleCancel()}>
      <div style={panel}>

        {/* ── Modal header ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #1e1e28', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f0f0f5' }}>
              {stage === STAGE.SELECTING ? (isReserved ? '💺 Select Your Seats' : '🏟️ Select a Zone') :
               stage === STAGE.CHECKOUT  ? '🔒 Confirm Your Booking' :
               stage === STAGE.SUCCESS   ? '🎉 Booking Confirmed!' :
               '⏰ Hold Expired'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#55556a' }}>
              {event.title}
            </p>
          </div>

          {/* Countdown badge — visible only in CHECKOUT stage */}
          {stage === STAGE.CHECKOUT && (
            <div style={{
              background: 'rgba(0,0,0,0.5)', border: `1px solid ${timerColor}`,
              borderRadius: 10, padding: '8px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.62rem', color: '#55556a', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                Hold expires in
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: timerColor,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>
                {fmtTime(timeLeft)}
              </div>
            </div>
          )}

          <button
            onClick={handleCancel}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'transparent', border: '1px solid #2a2a35',
              color: '#8888a0', fontSize: '1.1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* ── Modal body ─────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* ── SELECTING stage ───────────────────────────────────────── */}
          {stage === STAGE.SELECTING && (
            isReserved
              ? <SeatMap eventId={event._id} socket={socketRef.current} onHoldConfirmed={handleHoldConfirmed} />
              : <ZonePicker eventId={event._id} socket={socketRef.current} onHoldConfirmed={handleHoldConfirmed} />
          )}

          {/* ── CHECKOUT stage ────────────────────────────────────────── */}
          {stage === STAGE.CHECKOUT && holdData && (
            <div>
              {/* Held items summary */}
              <div style={{
                background: '#0d0d0f', border: '1px solid #2a2a35', borderRadius: 12,
                padding: '16px 20px', marginBottom: 20,
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 700,
                  color: '#8084e8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Your Selection
                </h3>

                {/* RESERVED_SEATING — list individual seats */}
                {holdData.type === 'RESERVED_SEATING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {holdData.heldTickets.map((t) => (
                      <div key={t._id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '0.88rem',
                      }}>
                        <span style={{ color: '#f0f0f5' }}>
                          {t.section} · Row {t.row} · Seat {t.seatNumber}
                        </span>
                        <span style={{ color: '#8084e8', fontWeight: 700 }}>{formatPrice(t.price)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ZONED_CAPACITY — show zone + qty */}
                {holdData.type === 'ZONED_CAPACITY' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                    <span style={{ color: '#f0f0f5' }}>
                      {holdData.zoneName} × {holdData.quantity} ticket{holdData.quantity > 1 ? 's' : ''}
                    </span>
                    <span style={{ color: '#8084e8', fontWeight: 700 }}>{formatPrice(holdData.totalPrice)}</span>
                  </div>
                )}

                {/* Total */}
                <div style={{
                  marginTop: 14, paddingTop: 14, borderTop: '1px solid #2a2a35',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: '#8888a0', fontSize: '0.85rem' }}>Total</span>
                  <span style={{ color: '#f0f0f5', fontSize: '1.3rem', fontWeight: 900 }}>
                    {formatPrice(holdData.totalPrice)}
                  </span>
                </div>
              </div>

              {/* Payment stub notice */}
              <div style={{
                background: 'rgba(91,95,199,0.08)', border: '1px solid rgba(91,95,199,0.2)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>💳</span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#8888a0', lineHeight: 1.6 }}>
                  <strong style={{ color: '#8084e8' }}>Demo mode:</strong> Clicking "Confirm Purchase"
                  will instantly mark your tickets as booked — no real payment is processed.
                </p>
              </div>

              {confirmError && (
                <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: 14 }}>⚠️ {confirmError}</p>
              )}

              {/* CTAs */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleCancel}
                  style={{
                    flex: 1, padding: '13px', background: 'transparent',
                    border: '1px solid #2a2a35', borderRadius: 10,
                    color: '#8888a0', fontSize: '0.9rem', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Cancel & Release
                </button>
                <button
                  onClick={handleConfirmPurchase}
                  disabled={confirming}
                  style={{
                    flex: 2, padding: '13px',
                    background: confirming ? '#2a2a35' : 'linear-gradient(135deg, #5b5fc7, #8084e8)',
                    border: 'none', borderRadius: 10,
                    color: confirming ? '#55556a' : '#fff',
                    fontSize: '0.95rem', fontWeight: 700,
                    cursor: confirming ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: confirming ? 'none' : '0 4px 24px rgba(91,95,199,0.45)',
                    transition: 'all 0.2s',
                  }}
                >
                  {confirming ? '⏳ Processing…' : '🎟️ Confirm Purchase'}
                </button>
              </div>
            </div>
          )}

          {/* ── SUCCESS stage ─────────────────────────────────────────── */}
          {stage === STAGE.SUCCESS && successData && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {/* Confetti emoji burst */}
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 900, color: '#f0f0f5' }}>
                You're all set!
              </h3>
              <p style={{ margin: '0 0 24px', color: '#8888a0', fontSize: '0.9rem' }}>
                Your tickets have been confirmed. Enjoy the event!
              </p>

              {/* Ticket card(s) */}
              <div style={{
                background: '#0d0d0f', border: '1px solid #2a2a35', borderRadius: 12,
                padding: '20px', textAlign: 'left', marginBottom: 24,
              }}>
                <div style={{ fontSize: '0.7rem', color: '#55556a', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  Booking Summary
                </div>
                {successData.tickets ? (
                  successData.tickets.map((t) => (
                    <div key={t._id} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.88rem', color: '#f0f0f5', marginBottom: 6,
                    }}>
                      <span>{t.section} · Row {t.row} · Seat {t.seatNumber}</span>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ Booked</span>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#f0f0f5' }}>
                    <span>{successData.zoneName} × {successData.quantity} ticket{successData.quantity > 1 ? 's' : ''}</span>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ Booked</span>
                  </div>
                )}
                <div style={{
                  marginTop: 14, paddingTop: 14, borderTop: '1px solid #2a2a35',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ color: '#8888a0', fontSize: '0.85rem' }}>Total paid</span>
                  <span style={{ color: '#f0f0f5', fontSize: '1.1rem', fontWeight: 900 }}>
                    {formatPrice(successData.totalPrice)}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  padding: '13px 40px',
                  background: 'linear-gradient(135deg, #5b5fc7, #8084e8)',
                  border: 'none', borderRadius: 10, color: '#fff',
                  fontSize: '0.95rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 4px 24px rgba(91,95,199,0.45)',
                }}
              >
                Done
              </button>
            </div>
          )}

          {/* ── EXPIRED stage ─────────────────────────────────────────── */}
          {stage === STAGE.EXPIRED && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>⏰</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 900, color: '#f0f0f5' }}>
                Hold Expired
              </h3>
              <p style={{ margin: '0 0 28px', color: '#8888a0', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Your 10-minute hold has expired and the seats have been
                released back to the pool.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={() => { setStage(STAGE.SELECTING); setHoldData(null); setTimeLeft(HOLD_SECONDS); releasedRef.current = false; }}
                  style={{
                    padding: '12px 28px',
                    background: 'linear-gradient(135deg, #5b5fc7, #8084e8)',
                    border: 'none', borderRadius: 10, color: '#fff',
                    fontSize: '0.9rem', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    boxShadow: '0 4px 20px rgba(91,95,199,0.35)',
                  }}
                >
                  Try Again
                </button>
                <button onClick={onClose} style={{
                  padding: '12px 28px', background: 'transparent',
                  border: '1px solid #2a2a35', borderRadius: 10,
                  color: '#8888a0', fontSize: '0.9rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  Close
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
