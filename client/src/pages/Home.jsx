import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, clearSession } from '../services/authService';
import styles from './Home.module.css';

const TicketIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
    <path d="M22 9V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-4z" />
  </svg>
);

export default function Home() {
  const navigate  = useNavigate();
  const user      = getCurrentUser();
  const initial   = user?.name?.[0]?.toUpperCase() ?? 'U';

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className={styles.wrapper}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <Link to="/" className={styles.brand}>
          <div className={styles.brandIcon}><TicketIcon /></div>
          <span className={styles.brandName}>TicketGo</span>
        </Link>

        <div className={styles.navActions}>
          {user ? (
            <div className={styles.userRow}>
              <div className={styles.avatar}>{initial}</div>
              <span className={styles.userName}>{user.name}</span>
              <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
            </div>
          ) : (
            <>
              <Link to="/login"  className={styles.btnOutline}>Sign In</Link>
              <Link to="/signup" className={styles.btnPrimary}>Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <span className={styles.badge}>
          <span className={styles.badgeDot} /> Live Events Platform
        </span>
        <h1 className={styles.heroTitle}>
          Book Tickets for<br />
          <span className={styles.accent}>Unforgettable</span> Experiences
        </h1>
        <p className={styles.heroSub}>
          High-performance ticket booking built for massive crowds.
          Secure, fast, and fair — every seat, every time.
        </p>
        <div className={styles.heroCta}>
          {user ? (
            <>
              <Link to="#" className={styles.btnHero}>
                {user.role === 'ORGANIZER' ? 'Go to Dashboard' : 'Browse Events'}
              </Link>
              <Link to="#" className={styles.btnHeroOutline}>Learn More</Link>
            </>
          ) : (
            <>
              <Link to="/signup" className={styles.btnHero}>Get Started Free</Link>
              <Link to="/login"  className={styles.btnHeroOutline}>Sign In</Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
