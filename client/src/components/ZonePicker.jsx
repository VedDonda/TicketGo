// Component for selecting ticket zones
import { useState, useEffect, useCallback } from "react";
import { fetchZones, holdSeats } from "../services/bookingService";
const MAX_QTY = 20;
const formatPrice = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function ZonePicker({ eventId, socket, onHoldConfirmed }) {
  const [zones, setZones] = useState([]);
  const [qtys, setQtys] = useState({});
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState(null);
  const [holdError, setHoldError] = useState(null);
  const loadZones = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { ok, data } = await fetchZones(eventId);

      if (ok && data.success) {
        setZones(data.data.zones);
      } else {
        setError(data.message || "Failed to load zones");
      }
    } catch {
      setError("Could not load zones. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadZones();
  }, [loadZones]);
  useEffect(() => {
    if (!socket) return;

    const handleZoneUpdate = ({ zoneName, availableSeats }) => {
      setZones((prev) =>
        prev.map((z) =>
          z.zoneName === zoneName ? { ...z, availableSeats } : z,
        ),
      );
    };

    socket.on("zone:update", handleZoneUpdate);

    return () => {
      socket.off("zone:update", handleZoneUpdate);
    };
  }, [socket]);
  const getQty = (zoneName) => qtys[zoneName] || 0;

  const setZoneQty = (zoneName, value, maxAvailable) => {
    const zone = zones.find((z) => z.zoneName === zoneName);

    if (!zone || zone.availableSeats === 0) return;
    const newQty = Math.max(
      0,
      Math.min(value, Math.min(MAX_QTY, maxAvailable)),
    );

    setQtys((prev) => ({ ...prev, [zoneName]: newQty }));
    setHoldError(null);
  };

  const selectedZones = zones.filter((z) => getQty(z.zoneName) > 0);
  const totalTickets = selectedZones.reduce(
    (s, z) => s + getQty(z.zoneName),
    0,
  );
  const totalPrice = selectedZones.reduce(
    (s, z) => s + z.price * getQty(z.zoneName),
    0,
  );
  const overLimit = totalTickets > MAX_QTY;

  const handleReserve = async () => {
    if (totalTickets === 0 || overLimit) return;
    setHolding(true);
    setHoldError(null);

    try {
      const zonesPayload = selectedZones.map((z) => ({
        zoneName: z.zoneName,
        quantity: getQty(z.zoneName),
      }));
      const { ok, data } = await holdSeats(eventId, { zones: zonesPayload });

      if (ok && data.success) {
        onHoldConfirmed({
          type: "ZONED_CAPACITY",
          holds: data.data.holds,
          totalPrice: data.data.totalPrice,
          expiresAt: data.data.expiresAt,
        });
      } else {
        setHoldError(data.message || "Failed to reserve. Please try again.");
        await loadZones();
        setQtys({});
      }
    } catch {
      setHoldError("Network error. Please try again.");
    } finally {
      setHolding(false);
    }
  };

  if (loading)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#8888a0",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <p>Loading zones...</p>
      </div>
    );
  if (error)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "#f87171",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <p style={{ marginBottom: 12 }}>{error}</p>
        <button onClick={loadZones} style={btnStyle("#5b5fc7")}>
          Retry
        </button>
      </div>
    );

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {zones.map((zone) => {
          const qty = getQty(zone.zoneName);
          const isSoldOut = zone.availableSeats === 0;
          const fillPct =
            zone.totalSeats > 0
              ? Math.round((zone.availableSeats / zone.totalSeats) * 100)
              : 0;
          const fillColor =
            fillPct > 50 ? "#22c55e" : fillPct > 20 ? "#f59e0b" : "#ef4444";
          const isActive = qty > 0;

          return (
            <div
              key={zone.zoneName}
              style={{
                background: isActive ? "rgba(91,95,199,0.08)" : "#0d0d10",
                border: `1px solid ${isActive ? "#5b5fc7" : isSoldOut ? "#1a1a22" : "#2a2a35"}`,
                borderRadius: 10,
                padding: "14px 18px",
                opacity: isSoldOut ? 0.45 : 1,
                transition: "border-color 0.15s",
              }}
            >
              {}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div>
                  <span
                    style={{
                      fontWeight: 700,
                      color: isSoldOut ? "#55556a" : "#f0f0f5",
                      fontSize: "0.93rem",
                    }}
                  >
                    {zone.zoneName}
                  </span>
                  {isSoldOut && (
                    <span
                      style={{
                        marginLeft: 8,
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#f87171",
                        borderRadius: 4,
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        textTransform: "uppercase",
                      }}
                    >
                      Sold Out
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#8084e8",
                      fontWeight: 700,
                      marginTop: 2,
                    }}
                  >
                    {formatPrice(zone.price)} / ticket
                  </div>
                </div>
                {}
                {!isSoldOut && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <button
                      onClick={() =>
                        setZoneQty(zone.zoneName, qty - 1, zone.availableSeats)
                      }
                      disabled={qty === 0}
                      style={stepperBtn(qty === 0)}
                    >
                      −
                    </button>
                    <span
                      style={{
                        minWidth: 28,
                        textAlign: "center",
                        fontSize: "1rem",
                        fontWeight: 800,
                        color: qty > 0 ? "#f0f0f5" : "#55556a",
                      }}
                    >
                      {qty}
                    </span>
                    <button
                      onClick={() =>
                        setZoneQty(zone.zoneName, qty + 1, zone.availableSeats)
                      }
                      disabled={
                        qty >= Math.min(MAX_QTY, zone.availableSeats) ||
                        overLimit
                      }
                      style={stepperBtn(
                        qty >= Math.min(MAX_QTY, zone.availableSeats) ||
                          overLimit,
                      )}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              {}
              <div
                style={{
                  height: 3,
                  background: "#1a1a22",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${fillPct}%`,
                    background: fillColor,
                    borderRadius: 2,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <div
                style={{ fontSize: "0.72rem", color: "#55556a", marginTop: 4 }}
              >
                {isSoldOut
                  ? "No seats available"
                  : `${zone.availableSeats.toLocaleString("en-IN")} available`}
              </div>
            </div>
          );
        })}
      </div>
      {}
      <div
        style={{
          marginTop: 20,
          paddingTop: 20,
          borderTop: "1px solid #1e1e28",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          {totalTickets > 0 ? (
            <>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#8888a0",
                  marginBottom: 2,
                }}
              >
                {totalTickets} ticket{totalTickets !== 1 ? "s" : ""} selected
                {selectedZones.length > 1 &&
                  ` across ${selectedZones.length} zones`}
              </div>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 900,
                  color: "#f0f0f5",
                }}
              >
                {formatPrice(totalPrice)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: "0.85rem", color: "#55556a" }}>
              No tickets selected
            </div>
          )}
          {overLimit && (
            <div
              style={{ marginTop: 4, color: "#f87171", fontSize: "0.78rem" }}
            >
              Max {MAX_QTY} tickets per transaction
            </div>
          )}
          {holdError && (
            <div
              style={{ marginTop: 4, color: "#f87171", fontSize: "0.78rem" }}
            >
              {holdError}
            </div>
          )}
        </div>
        <button
          onClick={handleReserve}
          disabled={totalTickets === 0 || overLimit || holding}
          style={{
            padding: "12px 28px",
            background: totalTickets > 0 && !overLimit ? "#5b5fc7" : "#2a2a35",
            border: "none",
            borderRadius: 10,
            color: totalTickets > 0 && !overLimit ? "#fff" : "#55556a",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor:
              totalTickets > 0 && !overLimit && !holding
                ? "pointer"
                : "not-allowed",
            fontFamily: "Inter, sans-serif",
            boxShadow:
              totalTickets > 0 && !overLimit
                ? "0 4px 20px rgba(91,95,199,0.35)"
                : "none",
            transition: "all 0.2s",
          }}
        >
          {holding ? "Processing..." : "Proceed to Pay"}
        </button>
      </div>
    </div>
  );
}

function stepperBtn(disabled) {
  return {
    width: 30,
    height: 30,
    borderRadius: 6,
    background: disabled ? "#0d0d10" : "#1a1a22",
    border: `1px solid ${disabled ? "#1a1a22" : "#2a2a35"}`,
    color: disabled ? "#2a2a35" : "#f0f0f5",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, sans-serif",
    transition: "all 0.1s",
  };
}

function btnStyle(bg) {
  return {
    marginTop: 12,
    padding: "8px 20px",
    background: bg,
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  };
}
