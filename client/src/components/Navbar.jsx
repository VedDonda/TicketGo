// Navigation bar component
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser, clearSession } from "../services/authService";
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

export default function Navbar() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const initial = user?.name?.[0]?.toUpperCase() ?? "U";

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
        height: "64px",
        background: "rgba(13,13,15,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #2a2a35",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textDecoration: "none",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: "linear-gradient(135deg,#5b5fc7,#8084e8)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TicketIcon />
        </div>
        <span
          style={{
            fontSize: "1.15rem",
            fontWeight: 900,
            color: "#f0f0f5",
            letterSpacing: "-0.5px",
          }}
        >
          TicketGo
        </span>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {user ? (
          <>
            {user.role === "ADMIN" && (
              <Link
                to="/admin/dashboard"
                style={{
                  padding: "7px 16px",
                  background: "rgba(78,202,139,0.15)",
                  border: "1px solid rgba(78,202,139,0.3)",
                  color: "#4eca8b",
                  borderRadius: "8px",
                  fontSize: "0.83rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Admin Dashboard
              </Link>
            )}
            {(user.role === "ORGANIZER" || user.role === "ADMIN") && (
              <Link
                to="/events/create"
                style={{
                  padding: "7px 16px",
                  background: "rgba(91,95,199,0.15)",
                  border: "1px solid rgba(91,95,199,0.3)",
                  color: "#8084e8",
                  borderRadius: "8px",
                  fontSize: "0.83rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                + Create Event
              </Link>
            )}
            <Link
              to="/profile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#5b5fc7,#8084e8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  color: "#fff",
                  boxShadow: "0 2px 10px rgba(91,95,199,0.3)",
                }}
              >
                {initial}
              </div>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "#f0f0f5",
                  fontWeight: 600,
                }}
              >
                {user.name}
              </span>
            </Link>
            <button
              onClick={handleLogout}
              style={{
                padding: "7px 14px",
                background: "transparent",
                border: "1px solid #2a2a35",
                color: "#8888a0",
                borderRadius: "8px",
                fontSize: "0.82rem",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                transition: "all 0.2s",
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#e05c6a";
                e.currentTarget.style.color = "#e05c6a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#2a2a35";
                e.currentTarget.style.color = "#8888a0";
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                padding: "8px 20px",
                border: "1.5px solid #2a2a35",
                color: "#f0f0f5",
                borderRadius: "10px",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "#55556a")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "#2a2a35")
              }
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              style={{
                padding: "9px 20px",
                background: "linear-gradient(135deg,#5b5fc7,#8084e8)",
                color: "#fff",
                borderRadius: "10px",
                fontSize: "0.875rem",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(91,95,199,0.3)",
              }}
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
