// Home page entry component
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, clearSession } from "../services/authService";
import { fetchEvents } from "../services/eventService";
const TicketIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
  >
    <path d="M22 9V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-4z" />
  </svg>
);
const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const CalendarIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const LocationIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);
const ChevronIcon = ({ dir = "right" }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: dir === "left" ? "rotate(180deg)" : "none" }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const CATEGORIES = [
  "ALL",
  "MUSIC",
  "SPORTS",
  "COMEDY",
  "THEATRE",
  "CONFERENCE",
  "OTHER",
];
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

const formatDate = (iso) => {
  const d = new Date(iso);

  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const categoryStyle = (cat) => CATEGORY_COLORS[cat] || CATEGORY_COLORS.OTHER;

function EventCard({ event }) {
  const cs = categoryStyle(event.category);

  return (
    <Link
      to={`/events/${event._id}`}
      style={{
        background: "#161619",
        border: "1px solid #2a2a35",
        borderRadius: "16px",
        overflow: "hidden",
        transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.borderColor = "#5b5fc7";
        e.currentTarget.style.boxShadow = "0 12px 40px rgba(91,95,199,0.18)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "#2a2a35";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {}
      <div
        style={{
          height: "140px",
          background: `linear-gradient(135deg, ${cs.bg.replace("0.15", "0.4")} 0%, rgba(13,13,15,0.8) 100%), #0d0d0f`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderBottom: `1px solid ${cs.border}`,
        }}
      >
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              inset: 0,
              opacity: 0.6,
            }}
          />
        )}
        {}
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: cs.bg,
            border: `1px solid ${cs.border}`,
            color: cs.text,
            borderRadius: "20px",
            fontSize: "0.7rem",
            fontWeight: 700,
            padding: "3px 10px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {event.category}
        </span>
        {}
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#8888a0",
            borderRadius: "20px",
            fontSize: "0.65rem",
            fontWeight: 600,
            padding: "3px 9px",
          }}
        >
          {event.eventType === "RESERVED_SEATING"
            ? "Reserved"
            : "General Admission"}
        </span>
      </div>
      {}
      <div
        style={{
          padding: "18px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "0.97rem",
            fontWeight: 700,
            color: "#f0f0f5",
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {event.title}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#8888a0",
              fontSize: "0.8rem",
            }}
          >
            <CalendarIcon />
            <span>{formatDate(event.date)}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#8888a0",
              fontSize: "0.8rem",
            }}
          >
            <LocationIcon />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {event.venue?.name}, {event.venue?.city}
            </span>
          </div>
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#55556a" }}>
            by {event.organizer?.name || "Organizer"}
          </span>
          <span
            style={{
              background: "rgba(91,95,199,0.15)",
              border: "1px solid rgba(91,95,199,0.35)",
              color: "#8084e8",
              borderRadius: "8px",
              fontSize: "0.78rem",
              fontWeight: 600,
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            View <ArrowRightIcon />
          </span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: "#161619",
        border: "1px solid #2a2a35",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "140px",
          background:
            "linear-gradient(90deg,#1e1e24 25%,#252530 50%,#1e1e24 75%)",
          backgroundSize: "400% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div
        style={{
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {[80, 60, 40].map((w) => (
          <div
            key={w}
            style={{
              height: "12px",
              width: `${w}%`,
              borderRadius: "6px",
              background:
                "linear-gradient(90deg,#1e1e24 25%,#252530 50%,#1e1e24 75%)",
              backgroundSize: "400% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const initial = user?.name?.[0]?.toUpperCase() ?? "U";
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { ok, data } = await fetchEvents({
        page,
        limit: 9,
        category: category !== "ALL" ? category : undefined,
        search: search || undefined,
      });

      if (ok && data.success) {
        setEvents(data.data.events);
        setPagination(data.data.pagination);
      } else {
        setError("Failed to load events");
      }
    } catch {
      setError("Could not reach the server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, [page, category, search]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "Inter, sans-serif",
        background: "#0d0d0f",
        color: "#f0f0f5",
      }}
    >
      {}
      <style>{`
        @keyframes shimmer { 0%{background-position:100% 0} 100%{background-position:-100% 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseCustom { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        .fade-up { animation: fadeUp 0.5s ease both; }
      `}</style>
      {}
      <section
        style={{
          padding: "60px 40px 40px",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at 50% 0%, rgba(91,95,199,0.15) 0%, transparent 65%)",
        }}
      >
        {}
        <form
          className="fade-up"
          onSubmit={handleSearch}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0",
            maxWidth: "600px",
            margin: "0 auto",
            animationDelay: "0.1s",
            background: "rgba(17,17,22,0.8)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              padding: "0 18px",
              color: "#8084e8",
              display: "flex",
              alignItems: "center",
            }}
          >
            <SearchIcon />
          </div>
          <input
            type="text"
            id="event-search"
            placeholder="Search for amazing live events..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#f0f0f5",
              fontSize: "0.95rem",
              padding: "16px 0",
              fontFamily: "Inter, sans-serif",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "16px 28px",
              background: "linear-gradient(135deg,#5b5fc7,#8084e8)",
              border: "none",
              color: "#fff",
              fontWeight: 800,
              fontSize: "0.9rem",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Find Events
          </button>
        </form>
      </section>
      {}
      <section
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px 80px" }}
      >
        {}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: 800,
                letterSpacing: "-0.5px",
              }}
            >
              Upcoming Events
            </h2>
            {pagination && !loading && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.82rem",
                  color: "#55556a",
                }}
              >
                {pagination.totalCount} event
                {pagination.totalCount !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
          {}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                id={`cat-${cat}`}
                onClick={() => handleCategoryChange(cat)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  border:
                    category === cat
                      ? "1px solid #5b5fc7"
                      : "1px solid #2a2a35",
                  background:
                    category === cat ? "rgba(91,95,199,0.2)" : "transparent",
                  color: category === cat ? "#8084e8" : "#8888a0",
                  transition: "all 0.15s",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        {}
        {search && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            <span style={{ fontSize: "0.83rem", color: "#8888a0" }}>
              Results for{" "}
              <strong style={{ color: "#f0f0f5" }}>"{search}"</strong>
            </span>
            <button
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(1);
              }}
              style={{
                background: "rgba(224,92,106,0.12)",
                border: "1px solid rgba(224,92,106,0.3)",
                color: "#e05c6a",
                borderRadius: "6px",
                fontSize: "0.72rem",
                padding: "2px 10px",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              ✕ Clear
            </button>
          </div>
        )}
        {}
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))",
              gap: "20px",
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "rgba(224,92,106,0.05)",
              border: "1px solid rgba(224,92,106,0.15)",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                fontSize: "2rem",
                marginBottom: "12px",
                color: "#f87171",
              }}
            >
              !
            </div>
            <p style={{ color: "#e05c6a", fontWeight: 600 }}>{error}</p>
            <button
              onClick={loadEvents}
              style={{
                marginTop: "16px",
                padding: "10px 24px",
                background: "#5b5fc7",
                border: "none",
                color: "#fff",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
              }}
            >
              Try Again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              background: "#161619",
              border: "1px solid #2a2a35",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                fontSize: "3rem",
                marginBottom: "16px",
                color: "#5b5fc7",
                fontWeight: 800,
              }}
            >
              ***
            </div>
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: "1.1rem",
                color: "#f0f0f5",
              }}
            >
              No events found
            </h3>
            <p style={{ color: "#55556a", fontSize: "0.875rem" }}>
              {search
                ? "Try a different search term."
                : "No upcoming events in this category yet."}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))",
              gap: "20px",
            }}
          >
            {events.map((ev) => (
              <EventCard key={ev._id} event={ev} />
            ))}
          </div>
        )}
        {}
        {pagination && pagination.totalPages > 1 && !loading && !error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              marginTop: "40px",
            }}
          >
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              id="prev-page"
              style={{
                width: 36,
                height: 36,
                borderRadius: "8px",
                cursor: pagination.hasPrevPage ? "pointer" : "not-allowed",
                background: "transparent",
                border: "1px solid #2a2a35",
                color: pagination.hasPrevPage ? "#f0f0f5" : "#2a2a35",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              <ChevronIcon dir="left" />
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  id={`page-${p}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: page === p ? "#5b5fc7" : "transparent",
                    border:
                      page === p ? "1px solid #5b5fc7" : "1px solid #2a2a35",
                    color: page === p ? "#fff" : "#8888a0",
                    fontWeight: page === p ? 700 : 400,
                    fontSize: "0.875rem",
                    fontFamily: "Inter, sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              id="next-page"
              style={{
                width: 36,
                height: 36,
                borderRadius: "8px",
                cursor: pagination.hasNextPage ? "pointer" : "not-allowed",
                background: "transparent",
                border: "1px solid #2a2a35",
                color: pagination.hasNextPage ? "#f0f0f5" : "#2a2a35",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              <ChevronIcon />
            </button>
          </div>
        )}
      </section>
      {}
      <footer
        style={{
          padding: "32px 40px",
          borderTop: "1px solid #2a2a35",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: "#5b5fc7",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TicketIcon />
          </div>
          <span style={{ fontWeight: 800, color: "#f0f0f5" }}>TicketGo</span>
        </div>
        <p style={{ margin: 0, color: "#55556a", fontSize: "0.8rem" }}>
          © {new Date().getFullYear()} TicketGo. Built for massive crowds.
        </p>
      </footer>
    </div>
  );
}
