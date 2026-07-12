// Interactive seat map component
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchSeats, holdSeats } from "../services/bookingService";
const MAX_SEATS = 20;
const SEAT_STYLES = {
  AVAILABLE: {
    bg: "#1e3a2f",
    border: "#22c55e",
    color: "#22c55e",
    hover: "#166534",
    cursor: "pointer",
  },
  HELD: {
    bg: "#3a2e1e",
    border: "#f59e0b",
    color: "#f59e0b",
    hover: "#3a2e1e",
    cursor: "not-allowed",
  },
  BOOKED: {
    bg: "#1a1a22",
    border: "#2a2a35",
    color: "#55556a",
    hover: "#1a1a22",
    cursor: "not-allowed",
  },
  SELECTED: {
    bg: "#2d2b5e",
    border: "#8084e8",
    color: "#c4b5fd",
    hover: "#3730a3",
    cursor: "pointer",
  },
};
const formatPrice = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function SeatMap({ eventId, socket, onHoldConfirmed }) {
  const [seatData, setSeatData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState(null);
  const [holdError, setHoldError] = useState(null);
  const loadSeats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { ok, data } = await fetchSeats(eventId);

      if (ok && data.success) {
        setSeatData(data.data.seats);
      } else {
        setError(data.message || "Failed to load seats");
      }
    } catch {
      setError("Could not load seat map. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);
  useEffect(() => {
    if (!socket) return;

    const handleSeatUpdate = ({ updatedSeats }) => {
      setSeatData((prev) => {
        if (!prev) return prev;
        const next = { ...prev };

        for (const seat of updatedSeats) {
          if (next[seat.section]?.[seat.row]) {
            next[seat.section][seat.row] = next[seat.section][seat.row].map(
              (s) =>
                s.seatNumber === seat.seatNumber
                  ? { ...s, status: seat.status, isMyHold: false }
                  : s,
            );
          }
        }

        return next;
      });
      setSelected((prev) =>
        prev.filter(
          (sel) =>
            !updatedSeats.some(
              (u) =>
                u.section === sel.section &&
                u.row === sel.row &&
                u.seatNumber === sel.seatNumber &&
                u.status !== "AVAILABLE",
            ),
        ),
      );
    };

    const handleSeatReleased = () => {
      loadSeats();
    };

    socket.on("seat:update", handleSeatUpdate);
    socket.on("seat:released", handleSeatReleased);

    return () => {
      socket.off("seat:update", handleSeatUpdate);
      socket.off("seat:released", handleSeatReleased);
    };
  }, [socket, loadSeats]);

  const toggleSeat = (seat) => {
    if (seat.status === "HELD" || seat.status === "BOOKED") return;
    setHoldError(null);
    setSelected((prev) => {
      const isSelected = prev.some((s) => s._id === seat._id);

      if (isSelected) return prev.filter((s) => s._id !== seat._id);

      if (prev.length >= MAX_SEATS) {
        setHoldError(
          `You can select at most ${MAX_SEATS} seats per transaction.`,
        );

        return prev;
      }

      return [...prev, seat];
    });
  };

  const handleConfirmHold = async () => {
    if (selected.length === 0) return;
    setHolding(true);
    setHoldError(null);

    try {
      const payload = {
        seats: selected.map((s) => ({
          section: s.section,
          row: s.row,
          seatNumber: s.seatNumber,
        })),
      };
      const { ok, data } = await holdSeats(eventId, payload);

      if (ok && data.success) {
        onHoldConfirmed({
          type: "RESERVED_SEATING",
          heldTickets: data.data.heldTickets,
          totalPrice: data.data.totalPrice,
          expiresAt: data.data.expiresAt,
        });
      } else {
        setHoldError(data.message || "Failed to place hold. Please try again.");
        await loadSeats();
        setSelected([]);
      }
    } catch {
      setHoldError("Network error. Please try again.");
    } finally {
      setHolding(false);
    }
  };

  const getSeatStatus = (seat) => {
    if (selected.some((s) => s._id === seat._id)) return "SELECTED";

    return seat.status;
  };

  if (loading)
    return (
      <div
        style={{ textAlign: "center", padding: "60px 20px", color: "#8888a0" }}
      >
        <p style={{ fontFamily: "Inter, sans-serif" }}>Loading seat map...</p>
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
        <p>{error}</p>
        <button onClick={loadSeats} style={btnStyle("#5b5fc7")}>
          Retry
        </button>
      </div>
    );
  const sections = Object.keys(seatData || {});
  const totalSelected = selected.length;
  const totalPrice = selected.reduce((sum, s) => sum + (s.price || 0), 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {}
      <div
        style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}
      >
        {[
          { label: "Available", status: "AVAILABLE" },
          { label: "Selected", status: "SELECTED" },
          { label: "Held", status: "HELD" },
          { label: "Booked", status: "BOOKED" },
        ].map(({ label, status }) => {
          const st = SEAT_STYLES[status];

          return (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.75rem",
                color: "#8888a0",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: st.bg,
                  border: `1px solid ${st.border}`,
                }}
              />
              {label}
            </div>
          );
        })}
      </div>
      {}
      <div
        style={{
          textAlign: "center",
          background: "rgba(91,95,199,0.1)",
          border: "1px solid rgba(91,95,199,0.25)",
          borderRadius: 8,
          padding: "8px 20px",
          marginBottom: 28,
          color: "#8084e8",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}
      >
        ▬▬▬▬▬▬▬ STAGE ▬▬▬▬▬▬▬
      </div>
      {}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          overflowY: "auto",
          overflowX: "auto",
          maxHeight: "55vh",
          paddingBottom: 16,
        }}
      >
        {sections.map((section) => {
          const rows = seatData[section];
          const rowKeys = Object.keys(rows).sort();

          return (
            <div key={section}>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  color: "#5b5fc7",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: "1px solid #1e1e28",
                }}
              >
                {section}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rowKeys.map((row) => (
                  <div
                    key={row}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {}
                    <span
                      style={{
                        width: 22,
                        fontSize: "0.7rem",
                        color: "#55556a",
                        fontWeight: 700,
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {row}
                    </span>
                    {}
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        flexWrap: "nowrap",
                        minWidth: "max-content",
                      }}
                    >
                      {rows[row].map((seat) => {
                        const status = getSeatStatus(seat);
                        const st = SEAT_STYLES[status];
                        const interactive =
                          status === "AVAILABLE" || status === "SELECTED";

                        return (
                          <button
                            key={seat._id}
                            title={`${section} · Row ${row} · Seat ${seat.seatNumber} · ${formatPrice(seat.price)}`}
                            onClick={() => interactive && toggleSeat(seat)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 5,
                              background: st.bg,
                              border: `1.5px solid ${st.border}`,
                              color: st.color,
                              fontSize: "0.6rem",
                              fontWeight: 700,
                              cursor: st.cursor,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.12s",
                              outline: "none",
                              padding: 0,
                            }}
                            onMouseEnter={(e) => {
                              if (interactive)
                                e.currentTarget.style.background = st.hover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = st.bg;
                            }}
                          >
                            {seat.seatNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {}
      <div
        style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: "1px solid #2a2a35",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          {totalSelected > 0 ? (
            <>
              <p
                style={{
                  margin: "0 0 3px",
                  fontSize: "0.78rem",
                  color: "#8888a0",
                }}
              >
                {totalSelected} seat{totalSelected !== 1 ? "s" : ""} selected
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "1.3rem",
                  fontWeight: 900,
                  color: "#f0f0f5",
                }}
              >
                {formatPrice(totalPrice)}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: "#55556a", fontSize: "0.85rem" }}>
              Select seats (max {MAX_SEATS})
            </p>
          )}
          {holdError && (
            <p
              style={{
                margin: "6px 0 0",
                color: "#f87171",
                fontSize: "0.78rem",
              }}
            >
              {holdError}
            </p>
          )}
        </div>
        <button
          onClick={handleConfirmHold}
          disabled={totalSelected === 0 || holding}
          style={{
            padding: "12px 28px",
            background: totalSelected > 0 ? "#5b5fc7" : "#2a2a35",
            border: "none",
            borderRadius: 10,
            color: totalSelected > 0 ? "#fff" : "#55556a",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: totalSelected > 0 ? "pointer" : "not-allowed",
            fontFamily: "Inter, sans-serif",
            transition: "all 0.2s",
            boxShadow:
              totalSelected > 0 ? "0 4px 20px rgba(91,95,199,0.35)" : "none",
          }}
        >
          {holding ? "Processing..." : "Proceed to Pay"}
        </button>
      </div>
    </div>
  );
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
