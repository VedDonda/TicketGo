// Page for booking event tickets
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { io } from "socket.io-client";
import SeatMap from "../components/SeatMap";
import ZonePicker from "../components/ZonePicker";
import { releaseHold, confirmPurchase } from "../services/bookingService";
import { fetchEventById } from "../services/eventService";
import { getCurrentUser, clearSession } from "../services/authService";
const HOLD_SECONDS = 10 * 60;
const formatPrice = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

const fmtTime = (secs) => {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");

  return `${m}:${s}`;
};

const STAGE = {
  LOADING: "LOADING",
  SELECTING: "SELECTING",
  CHECKOUT: "CHECKOUT",
  SUCCESS: "SUCCESS",
  EXPIRED: "EXPIRED",
};
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
const CATEGORY_COLORS = {
  MUSIC: {
    bg: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.4)",
    text: "#a78bfa",
  },
  SPORTS: {
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.35)",
    text: "#34d399",
  },
  COMEDY: {
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    text: "#fbbf24",
  },
  THEATRE: {
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    text: "#f87171",
  },
  CONFERENCE: {
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.35)",
    text: "#60a5fa",
  },
  OTHER: {
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.35)",
    text: "#9ca3af",
  },
};
const CalIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const PinIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const BackIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const initial = user?.name?.[0]?.toUpperCase() ?? "U";
  const [event, setEvent] = useState(null);
  const [eventError, setEventError] = useState(null);
  const [stage, setStage] = useState(STAGE.LOADING);
  const [holdData, setHoldData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(HOLD_SECONDS);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const releasedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const { ok, data } = await fetchEventById(id);

        if (ok && data.success) {
          setEvent(data.data.event);
          setStage(STAGE.SELECTING);
        } else {
          setEventError(data.message || "Event not found");
          setStage(STAGE.SELECTING);
        }
      } catch {
        setEventError("Could not load event.");
        setStage(STAGE.SELECTING);
      }
    })();
  }, [id]);
  useEffect(() => {
    if (!event) return;
    const backendUrl =
      import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;
    socket.on("connect", () =>
      socket.emit("join:event", { eventId: event._id }),
    );

    return () => {
      socket.emit("leave:event", { eventId: event._id });
      socket.disconnect();
    };
  }, [event?._id]);
  const startTimer = useCallback(
    (expiresAt) => {
      const target = new Date(expiresAt).getTime();

      const tick = () => {
        const remaining = Math.max(0, Math.round((target - Date.now()) / 1000));

        setTimeLeft(remaining);

        if (remaining === 0) {
          clearInterval(timerRef.current);
          setStage(STAGE.EXPIRED);

          if (!releasedRef.current) {
            releasedRef.current = true;
            releaseHold(event._id, {}).catch(() => {});
          }
        }
      };

      tick();
      timerRef.current = setInterval(tick, 1000);
    },
    [event?._id],
  );

  useEffect(() => () => clearInterval(timerRef.current), []);
  const handleHoldConfirmed = useCallback(
    (data) => {
      setHoldData(data);
      setStage(STAGE.CHECKOUT);
      releasedRef.current = false;
      startTimer(data.expiresAt);
    },
    [startTimer],
  );

  const handleCancel = () => {
    clearInterval(timerRef.current);
    navigate(`/events/${id}`);
  };

  const handleChangeSeat = async () => {
    clearInterval(timerRef.current);

    if (!releasedRef.current && holdData) {
      releasedRef.current = true;

      try {
        await releaseHold(event._id, {});
      } catch {}
    }

    setHoldData(null);
    setTimeLeft(HOLD_SECONDS);
    releasedRef.current = false;
    setStage(STAGE.SELECTING);
  };

  const handleConfirmPurchase = async () => {
    setConfirming(true);
    setConfirmError(null);

    try {
      const { ok, data } = await confirmPurchase(event._id, {});

      if (ok && data.success) {
        clearInterval(timerRef.current);
        releasedRef.current = true;
        setSuccessData(data.data);
        setStage(STAGE.SUCCESS);
      } else {
        setConfirmError(data.message || "Purchase failed. Please try again.");
        if (data.message?.includes("expired")) setStage(STAGE.EXPIRED);
      }
    } catch {
      setConfirmError("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const timerColor =
    timeLeft > 300 ? "#22c55e" : timeLeft > 60 ? "#f59e0b" : "#ef4444";
  const isReserved = event?.eventType === "RESERVED_SEATING";
  const cs = event
    ? CATEGORY_COLORS[event.category] || CATEGORY_COLORS.OTHER
    : CATEGORY_COLORS.OTHER;
  const stageLabel =
    {
      [STAGE.LOADING]: "Loading...",
      [STAGE.SELECTING]: isReserved ? "Select Seats" : "Select Zones",
      [STAGE.CHECKOUT]: "Review & Confirm",
      [STAGE.SUCCESS]: "Booking Confirmed",
      [STAGE.EXPIRED]: "Hold Expired",
    }[stage] || "";
  const currentStep =
    { [STAGE.SELECTING]: 1, [STAGE.CHECKOUT]: 2, [STAGE.SUCCESS]: 3 }[stage] ||
    0;

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "Inter, sans-serif",
        background: "#0a0a0d",
        color: "#f0f0f5",
      }}
    >
      {}
      {eventError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 64px)",
            flexDirection: "column",
            gap: 16,
            textAlign: "center",
            padding: 32,
          }}
        >
          <h2 style={{ margin: 0, color: "#f0f0f5" }}>Event not found</h2>
          <p style={{ color: "#e05c6a", margin: 0 }}>{eventError}</p>
          <Link
            to="/"
            style={{
              padding: "10px 24px",
              background: "#5b5fc7",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Back to Events
          </Link>
        </div>
      )}
      {}
      {stage === STAGE.LOADING && !eventError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 64px)",
            color: "#8888a0",
          }}
        >
          <p style={{ margin: 0 }}>Loading...</p>
        </div>
      )}
      {}
      {event && !eventError && (
        <>
          {}
          <div
            style={{
              height: 3,
              background: `linear-gradient(90deg, ${cs.text}, rgba(91,95,199,0.4))`,
            }}
          />
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "28px 24px 80px",
            }}
          >
            {}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 24,
              }}
            >
              <button
                onClick={handleCancel}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: "1px solid #2a2a35",
                  color: "#8888a0",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <BackIcon /> Back to Event
              </button>
              <span style={{ color: "#2a2a35" }}>›</span>
              <span
                style={{
                  color: "#8084e8",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                }}
              >
                {stageLabel}
              </span>
            </div>
            {}
            {currentStep > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 32,
                }}
              >
                {[
                  { n: 1, label: isReserved ? "Select Seats" : "Select Zones" },
                  { n: 2, label: "Review & Pay" },
                  { n: 3, label: "Confirmed" },
                ].map(({ n, label }, idx) => {
                  const done = currentStep > n;
                  const active = currentStep === n;
                  const color = done
                    ? "#22c55e"
                    : active
                      ? "#8084e8"
                      : "#2a2a35";

                  return (
                    <div
                      key={n}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flex: idx < 2 ? 1 : 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: done
                              ? "rgba(34,197,94,0.1)"
                              : active
                                ? "rgba(128,132,232,0.1)"
                                : "#111116",
                            border: `2px solid ${color}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            color,
                          }}
                        >
                          {done ? "✓" : n}
                        </div>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            color: done
                              ? "#22c55e"
                              : active
                                ? "#f0f0f5"
                                : "#55556a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                      {idx < 2 && (
                        <div
                          style={{
                            flex: 1,
                            height: 2,
                            margin: "0 10px",
                            marginBottom: 20,
                            background: done ? "#22c55e" : "#1e1e28",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  stage === STAGE.SUCCESS ||
                  stage === STAGE.EXPIRED ||
                  stage === STAGE.SELECTING
                    ? "1fr"
                    : "1fr 320px",
                gap: 24,
                alignItems: "start",
              }}
            >
              {}
              <div
                style={{
                  background: "#111116",
                  border: "1px solid #1e1e28",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
                }}
              >
                {}
                <div
                  style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid #1e1e28",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <h1
                      style={{
                        margin: 0,
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        color: "#f0f0f5",
                      }}
                    >
                      {stageLabel}
                    </h1>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: "0.78rem",
                        color: "#55556a",
                      }}
                    >
                      {event.title}
                    </p>
                  </div>
                  {}
                  {stage === STAGE.CHECKOUT && (
                    <div
                      style={{
                        background: "#0d0d10",
                        border: `1.5px solid ${timerColor}`,
                        borderRadius: 10,
                        padding: "8px 18px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.58rem",
                          color: "#55556a",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: 1,
                        }}
                      >
                        Hold expires in
                      </div>
                      <div
                        style={{
                          fontSize: "1.6rem",
                          fontWeight: 900,
                          color: timerColor,
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "-1px",
                        }}
                      >
                        {fmtTime(timeLeft)}
                      </div>
                    </div>
                  )}
                </div>
                {}
                <div style={{ padding: "24px" }}>
                  {}
                  {stage === STAGE.SELECTING &&
                    (isReserved ? (
                      <SeatMap
                        eventId={event._id}
                        socket={socketRef.current}
                        onHoldConfirmed={handleHoldConfirmed}
                      />
                    ) : (
                      <ZonePicker
                        eventId={event._id}
                        socket={socketRef.current}
                        onHoldConfirmed={handleHoldConfirmed}
                      />
                    ))}
                  {}
                  {stage === STAGE.CHECKOUT && holdData && (
                    <div>
                      {}
                      <div
                        style={{
                          background: "#0d0d10",
                          border: "1px solid #1e1e28",
                          borderRadius: 12,
                          padding: "18px 20px",
                          marginBottom: 18,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "#8084e8",
                            textTransform: "uppercase",
                            letterSpacing: "0.8px",
                            marginBottom: 14,
                          }}
                        >
                          Your Selection
                        </div>
                        {}
                        {holdData.type === "RESERVED_SEATING" && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            {holdData.heldTickets.map((t) => (
                              <div
                                key={t._id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "8px 12px",
                                  background: "rgba(128,132,232,0.04)",
                                  border: "1px solid #1e1e28",
                                  borderRadius: 8,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "0.87rem",
                                    color: "#f0f0f5",
                                  }}
                                >
                                  {t.section} · Row {t.row} · Seat{" "}
                                  {t.seatNumber}
                                </span>
                                <span
                                  style={{
                                    color: "#8084e8",
                                    fontWeight: 700,
                                    fontSize: "0.87rem",
                                  }}
                                >
                                  {formatPrice(t.price)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {}
                        {holdData.type === "ZONED_CAPACITY" &&
                          holdData.holds && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                              }}
                            >
                              {holdData.holds.map((h) => (
                                <div
                                  key={h.holdId}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "8px 12px",
                                    background: "rgba(128,132,232,0.04)",
                                    border: "1px solid #1e1e28",
                                    borderRadius: 8,
                                  }}
                                >
                                  <div>
                                    <div
                                      style={{
                                        fontSize: "0.87rem",
                                        color: "#f0f0f5",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {h.zoneName}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.73rem",
                                        color: "#55556a",
                                      }}
                                    >
                                      {h.quantity} ticket
                                      {h.quantity > 1 ? "s" : ""} ×{" "}
                                      {formatPrice(h.price)}
                                    </div>
                                  </div>
                                  <span
                                    style={{
                                      color: "#8084e8",
                                      fontWeight: 700,
                                      fontSize: "0.87rem",
                                    }}
                                  >
                                    {formatPrice(h.subtotal)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        {}
                        <div
                          style={{
                            marginTop: 14,
                            paddingTop: 14,
                            borderTop: "1px solid #1e1e28",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{ color: "#8888a0", fontSize: "0.85rem" }}
                          >
                            Total
                          </span>
                          <span
                            style={{
                              color: "#f0f0f5",
                              fontSize: "1.4rem",
                              fontWeight: 900,
                            }}
                          >
                            {formatPrice(holdData.totalPrice)}
                          </span>
                        </div>
                      </div>
                      {}
                      <div
                        style={{
                          background: "rgba(91,95,199,0.05)",
                          border: "1px solid rgba(91,95,199,0.15)",
                          borderRadius: 10,
                          padding: "12px 16px",
                          marginBottom: 18,
                          fontSize: "0.8rem",
                          color: "#8888a0",
                          lineHeight: 1.6,
                        }}
                      >
                        <strong style={{ color: "#8084e8" }}>Demo mode:</strong>{" "}
                        No real payment is processed. Clicking Confirm will mark
                        your tickets as booked instantly.
                      </div>
                      {confirmError && (
                        <div
                          style={{
                            background: "rgba(248,113,113,0.07)",
                            border: "1px solid rgba(248,113,113,0.2)",
                            borderRadius: 8,
                            padding: "10px 14px",
                            marginBottom: 16,
                            color: "#f87171",
                            fontSize: "0.85rem",
                          }}
                        >
                          {confirmError}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          onClick={handleCancel}
                          title="Go back without releasing your hold — seats stay reserved for you"
                          style={{
                            flex: 1,
                            padding: "13px",
                            background: "transparent",
                            border: "1px solid #2a2a35",
                            borderRadius: 10,
                            color: "#8888a0",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          ← Back
                        </button>
                        <button
                          onClick={handleChangeSeat}
                          title="Release your current seats and go back to seat selection"
                          style={{
                            flex: 1,
                            padding: "13px",
                            background: "transparent",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: 10,
                            color: "#f87171",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Change Seats
                        </button>
                        <button
                          onClick={handleConfirmPurchase}
                          disabled={confirming}
                          style={{
                            flex: 2,
                            padding: "13px",
                            background: confirming
                              ? "#2a2a35"
                              : "linear-gradient(135deg, #5b5fc7, #8084e8)",
                            border: "none",
                            borderRadius: 10,
                            color: confirming ? "#55556a" : "#fff",
                            fontSize: "0.95rem",
                            fontWeight: 800,
                            cursor: confirming ? "not-allowed" : "pointer",
                            fontFamily: "Inter, sans-serif",
                            boxShadow: confirming
                              ? "none"
                              : "0 4px 24px rgba(91,95,199,0.4)",
                          }}
                        >
                          {confirming ? "Processing..." : "Confirm Purchase"}
                        </button>
                      </div>
                    </div>
                  )}
                  {}
                  {stage === STAGE.SUCCESS && successData && (
                    <div style={{ textAlign: "center", padding: "32px 16px" }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          background: "rgba(34,197,94,0.1)",
                          border: "2px solid rgba(34,197,94,0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto 20px",
                          fontSize: "1.6rem",
                        }}
                      >
                        ✓
                      </div>
                      <h2
                        style={{
                          margin: "0 0 8px",
                          fontSize: "1.5rem",
                          fontWeight: 900,
                          color: "#f0f0f5",
                        }}
                      >
                        Booking Confirmed
                      </h2>
                      <p
                        style={{
                          margin: "0 0 28px",
                          color: "#8888a0",
                          fontSize: "0.9rem",
                        }}
                      >
                        Your tickets have been booked successfully.
                      </p>
                      <div
                        style={{
                          background: "#0d0d10",
                          border: "1px solid #1e1e28",
                          borderRadius: 12,
                          padding: "20px",
                          textAlign: "left",
                          marginBottom: 28,
                          maxWidth: 480,
                          margin: "0 auto 28px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.68rem",
                            color: "#55556a",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.6px",
                            marginBottom: 12,
                          }}
                        >
                          Booking Summary
                        </div>
                        {}
                        {successData.tickets &&
                          (() => {
                            const bySection = successData.tickets.reduce(
                              (acc, t) => {
                                if (!acc[t.section]) acc[t.section] = [];
                                acc[t.section].push(t);

                                return acc;
                              },
                              {},
                            );

                            return (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                }}
                              >
                                {Object.entries(bySection).map(
                                  ([section, seats]) => (
                                    <div
                                      key={section}
                                      style={{
                                        background: "rgba(34,197,94,0.03)",
                                        border:
                                          "1px solid rgba(34,197,94,0.12)",
                                        borderRadius: 8,
                                        overflow: "hidden",
                                      }}
                                    >
                                      {}
                                      <div
                                        style={{
                                          padding: "6px 10px",
                                          background: "rgba(34,197,94,0.06)",
                                          borderBottom:
                                            "1px solid rgba(34,197,94,0.1)",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            color: "#f0f0f5",
                                          }}
                                        >
                                          {section}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "0.67rem",
                                            color: "#55556a",
                                            background: "#1e1e28",
                                            padding: "1px 5px",
                                            borderRadius: 3,
                                          }}
                                        >
                                          {seats.length} seat
                                          {seats.length > 1 ? "s" : ""}
                                        </span>
                                      </div>
                                      {}
                                      {seats.map((t, i) => (
                                        <div
                                          key={t._id}
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "7px 10px 7px 18px",
                                            borderBottom:
                                              i < seats.length - 1
                                                ? "1px solid rgba(34,197,94,0.07)"
                                                : "none",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: "0.83rem",
                                              color: "#8888a0",
                                            }}
                                          >
                                            Row {t.row} · Seat {t.seatNumber}
                                          </span>
                                          <span
                                            style={{
                                              color: "#22c55e",
                                              fontWeight: 700,
                                              fontSize: "0.75rem",
                                            }}
                                          >
                                            Booked
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ),
                                )}
                              </div>
                            );
                          })()}
                        {}
                        {successData.zones && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {successData.zones.map((z) => (
                              <div
                                key={z.zoneName}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "7px 10px",
                                  background: "rgba(34,197,94,0.04)",
                                  border: "1px solid rgba(34,197,94,0.12)",
                                  borderRadius: 7,
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.87rem",
                                      color: "#f0f0f5",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {z.zoneName}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "0.73rem",
                                      color: "#55556a",
                                    }}
                                  >
                                    {z.quantity} ticket
                                    {z.quantity > 1 ? "s" : ""}
                                  </div>
                                </div>
                                <span
                                  style={{
                                    color: "#22c55e",
                                    fontWeight: 700,
                                    fontSize: "0.78rem",
                                  }}
                                >
                                  Booked
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: 14,
                            paddingTop: 14,
                            borderTop: "1px solid #1e1e28",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{ color: "#8888a0", fontSize: "0.85rem" }}
                          >
                            Total paid
                          </span>
                          <span
                            style={{
                              color: "#f0f0f5",
                              fontSize: "1.2rem",
                              fontWeight: 900,
                            }}
                          >
                            {formatPrice(successData.totalPrice)}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => navigate("/")}
                          style={{
                            padding: "12px 28px",
                            background: "transparent",
                            border: "1px solid #2a2a35",
                            borderRadius: 10,
                            color: "#8888a0",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Browse Events
                        </button>
                        <button
                          onClick={() => navigate(`/events/${id}`)}
                          style={{
                            padding: "12px 28px",
                            background:
                              "linear-gradient(135deg, #5b5fc7, #8084e8)",
                            border: "none",
                            borderRadius: 10,
                            color: "#fff",
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                            boxShadow: "0 4px 20px rgba(91,95,199,0.4)",
                          }}
                        >
                          View Event
                        </button>
                      </div>
                    </div>
                  )}
                  {}
                  {stage === STAGE.EXPIRED && (
                    <div style={{ textAlign: "center", padding: "40px 16px" }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          background: "rgba(239,68,68,0.08)",
                          border: "2px solid rgba(239,68,68,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto 20px",
                          fontSize: "1.5rem",
                          color: "#f87171",
                        }}
                      >
                        !
                      </div>
                      <h2
                        style={{
                          margin: "0 0 10px",
                          fontSize: "1.4rem",
                          fontWeight: 900,
                          color: "#f0f0f5",
                        }}
                      >
                        Hold Expired
                      </h2>
                      <p
                        style={{
                          margin: "0 0 28px",
                          color: "#8888a0",
                          fontSize: "0.9rem",
                          lineHeight: 1.6,
                        }}
                      >
                        Your 10-minute hold has expired and the seats have been
                        released.
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => {
                            setStage(STAGE.SELECTING);
                            setHoldData(null);
                            setTimeLeft(HOLD_SECONDS);
                            releasedRef.current = false;
                          }}
                          style={{
                            padding: "12px 28px",
                            background:
                              "linear-gradient(135deg, #5b5fc7, #8084e8)",
                            border: "none",
                            borderRadius: 10,
                            color: "#fff",
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Try Again
                        </button>
                        <button
                          onClick={() => navigate(`/events/${id}`)}
                          style={{
                            padding: "12px 28px",
                            background: "transparent",
                            border: "1px solid #2a2a35",
                            borderRadius: 10,
                            color: "#8888a0",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          Back to Event
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {}
              {stage === STAGE.CHECKOUT && (
                <div
                  style={{
                    position: "sticky",
                    top: 84,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      background: "#111116",
                      border: "1px solid #1e1e28",
                      borderRadius: 14,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: 3,
                        background: `linear-gradient(90deg, ${cs.text}, rgba(91,95,199,0.4))`,
                      }}
                    />
                    <div style={{ padding: 18 }}>
                      <span
                        style={{
                          background: cs.bg,
                          border: `1px solid ${cs.border}`,
                          color: cs.text,
                          borderRadius: 4,
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {event.category}
                      </span>
                      <h3
                        style={{
                          margin: "10px 0 14px",
                          fontSize: "0.95rem",
                          fontWeight: 800,
                          color: "#f0f0f5",
                          lineHeight: 1.3,
                        }}
                      >
                        {event.title}
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            color: "#8888a0",
                            fontSize: "0.82rem",
                          }}
                        >
                          <span style={{ color: "#5b5fc7", marginTop: 1 }}>
                            <CalIcon />
                          </span>
                          {formatDate(event.date)} · {formatTime(event.date)}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            color: "#8888a0",
                            fontSize: "0.82rem",
                          }}
                        >
                          <span style={{ color: "#5b5fc7", marginTop: 1 }}>
                            <PinIcon />
                          </span>
                          {event.venue?.name}, {event.venue?.city}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(34,197,94,0.04)",
                      border: "1px solid rgba(34,197,94,0.1)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      fontSize: "0.78rem",
                      color: "#55556a",
                      lineHeight: 1.55,
                    }}
                  >
                    Seats are held for 10 minutes. Complete your purchase before
                    the timer runs out.
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
    </div>
  );
}
