/**
 * ZonePicker.jsx — Zone selection UI for ZONED_CAPACITY events.
 *
 * Features:
 * - Cards for each zone with live availableSeats from GET /zones
 * - Qty stepper per zone (1–20 cap, capped by availableSeats)
 * - Single active zone selection at a time
 * - Live updates via Socket.IO `zone:update` events
 * - "Reserve" sends POST /hold and notifies parent
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchZones, holdSeats } from '../services/bookingService';

const MAX_QTY = 20;
const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export default function ZonePicker({ eventId, socket, onHoldConfirmed }) {
  const [zones,      setZones]      = useState([]);     // Inventory docs
  const [myHold,     setMyHold]     = useState(null);   // existing active hold
  const [selectedZone, setSelectedZone] = useState(null); // zoneName
  const [qty,        setQty]        = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [holding,    setHolding]    = useState(false);
  const [error,      setError]      = useState(null);
  const [holdError,  setHoldError]  = useState(null);

  // ── Fetch zones ─────────────────────────────────────────────────────────────
  const loadZones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { ok, data } = await fetchZones(eventId);
      if (ok && data.success) {
        setZones(data.data.zones);
        if (data.data.myHold) setMyHold(data.data.myHold);
      } else {
        setError(data.message || 'Failed to load zones');
      }
    } catch {
      setError('Could not load zones. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadZones(); }, [loadZones]);

  // ── Socket.IO — real-time zone updates ─────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleZoneUpdate = ({ zoneName, availableSeats }) => {
      setZones((prev) =>
        prev.map((z) =>
          z.zoneName === zoneName ? { ...z, availableSeats } : z
        )
      );
    };

    socket.on('zone:update', handleZoneUpdate);
    return () => { socket.off('zone:update', handleZoneUpdate); };
  }, [socket]);

  // ── Select a zone ────────────────────────────────────────────────────────────
  const selectZone = (zoneName) => {
    setSelectedZone(zoneName);
    setQty(1);
    setHoldError(null);
  };

  // ── Confirm hold ─────────────────────────────────────────────────────────────
  const handleReserve = async () => {
    if (!selectedZone) return;
    setHolding(true);
    setHoldError(null);
    try {
      const { ok, data } = await holdSeats(eventId, { zoneName: selectedZone, quantity: qty });
      if (ok && data.success) {
        onHoldConfirmed({
          type:       'ZONED_CAPACITY',
          holdId:     data.data.holdId,
          zoneName:   data.data.zoneName,
          quantity:   data.data.quantity,
          totalPrice: data.data.totalPrice,
          expiresAt:  data.data.expiresAt,
        });
      } else {
        setHoldError(data.message || 'Failed to reserve. Please try again.');
        await loadZones();
        setSelectedZone(null);
      }
    } catch {
      setHoldError('Network error. Please try again.');
    } finally {
      setHolding(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8888a0', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏟️</div>
      <p>Loading zones…</p>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#f87171', fontFamily: 'Inter, sans-serif' }}>
      <p>{error}</p>
      <button onClick={loadZones} style={btnStyle('#5b5fc7')}>Retry</button>
    </div>
  );

  const activeZone = zones.find((z) => z.zoneName === selectedZone);
  const totalPrice = activeZone ? activeZone.price * qty : 0;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Intro text ─────────────────────────────────────────────────── */}
      <p style={{ margin: '0 0 20px', color: '#8888a0', fontSize: '0.87rem' }}>
        Select a zone and choose how many tickets you need.
      </p>

      {/* ── Zone cards ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50vh', overflowY: 'auto' }}>
        {zones.map((zone) => {
          const isSelected  = selectedZone === zone.zoneName;
          const isSoldOut   = zone.availableSeats === 0;
          const fillPct     = zone.availableSeats > 0
            ? Math.round((zone.availableSeats / zone.totalSeats) * 100)
            : 0;

          const fillColor =
            fillPct > 50 ? '#22c55e' :
            fillPct > 20 ? '#f59e0b' : '#ef4444';

          return (
            <div
              key={zone.zoneName}
              onClick={() => !isSoldOut && selectZone(zone.zoneName)}
              style={{
                background:   isSelected ? 'rgba(91,95,199,0.12)' : '#0d0d0f',
                border:       `1.5px solid ${isSelected ? '#8084e8' : isSoldOut ? '#1a1a22' : '#2a2a35'}`,
                borderRadius: 10,
                padding:      '14px 18px',
                cursor:       isSoldOut ? 'not-allowed' : 'pointer',
                transition:   'all 0.15s',
                opacity:      isSoldOut ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isSoldOut && !isSelected) e.currentTarget.style.borderColor = '#5b5fc7';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = isSoldOut ? '#1a1a22' : '#2a2a35';
              }}
            >
              {/* Top row: name + price */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isSelected && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#8084e8',
                      display: 'inline-block', flexShrink: 0,
                    }} />
                  )}
                  <span style={{ fontWeight: 700, color: isSoldOut ? '#55556a' : '#f0f0f5', fontSize: '0.95rem' }}>
                    {zone.zoneName}
                  </span>
                  {isSoldOut && (
                    <span style={{
                      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171', borderRadius: 20, fontSize: '0.62rem', fontWeight: 700,
                      padding: '2px 8px', textTransform: 'uppercase',
                    }}>Sold Out</span>
                  )}
                </div>
                <span style={{
                  background: isSelected ? 'rgba(128,132,232,0.2)' : 'rgba(91,95,199,0.1)',
                  border: `1px solid ${isSelected ? 'rgba(128,132,232,0.4)' : 'rgba(91,95,199,0.25)'}`,
                  color: isSelected ? '#c4b5fd' : '#8084e8',
                  borderRadius: 6, padding: '3px 10px', fontSize: '0.85rem', fontWeight: 800,
                }}>
                  {formatPrice(zone.price)} / ticket
                </span>
              </div>

              {/* Availability bar */}
              <div style={{ marginBottom: 4 }}>
                <div style={{
                  height: 4, background: '#1a1a22', borderRadius: 2, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${fillPct}%`,
                    background: fillColor, borderRadius: 2,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#55556a' }}>
                {isSoldOut
                  ? 'No seats available'
                  : `${zone.availableSeats.toLocaleString('en-IN')} of ${zone.totalSeats.toLocaleString('en-IN')} seats available`}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Qty stepper + Reserve button ─────────────────────────────── */}
      {selectedZone && activeZone && (
        <div style={{
          marginTop: 20, paddingTop: 20, borderTop: '1px solid #2a2a35',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}>
          {/* Stepper */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#55556a', fontWeight: 600 }}>
              QUANTITY (max {Math.min(MAX_QTY, activeZone.availableSeats)})
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                style={stepperBtn()}
              >−</button>
              <span style={{
                minWidth: 40, textAlign: 'center',
                fontSize: '1.2rem', fontWeight: 800, color: '#f0f0f5',
              }}>{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(Math.min(MAX_QTY, activeZone.availableSeats), q + 1))}
                style={stepperBtn()}
              >+</button>
            </div>
          </div>

          {/* Total + CTA */}
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.78rem', color: '#8888a0' }}>
              {qty} × {formatPrice(activeZone.price)}
            </p>
            <p style={{ margin: '0 0 10px', fontSize: '1.35rem', fontWeight: 900, color: '#f0f0f5' }}>
              {formatPrice(totalPrice)}
            </p>
            <button
              onClick={handleReserve}
              disabled={holding}
              style={{
                padding: '11px 28px',
                background: holding ? '#2a2a35' : '#5b5fc7',
                border: 'none', borderRadius: 10,
                color: holding ? '#55556a' : '#fff',
                fontSize: '0.95rem', fontWeight: 700,
                cursor: holding ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                boxShadow: holding ? 'none' : '0 4px 20px rgba(91,95,199,0.35)',
                transition: 'all 0.2s',
              }}
            >
              {holding ? '⏳ Processing…' : 'Proceed to Pay'}
            </button>
          </div>
        </div>
      )}

      {holdError && (
        <p style={{ marginTop: 12, color: '#f87171', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
          ⚠️ {holdError}
        </p>
      )}
    </div>
  );
}

function stepperBtn() {
  return {
    width: 32, height: 32, borderRadius: 8,
    background: '#161619', border: '1px solid #2a2a35',
    color: '#f0f0f5', fontSize: '1.1rem', fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
  };
}

function btnStyle(bg) {
  return {
    marginTop: 12, padding: '8px 20px', background: bg,
    border: 'none', borderRadius: 8, color: '#fff',
    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  };
}