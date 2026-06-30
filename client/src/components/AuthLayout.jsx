import styles from './AuthLayout.module.css';

// Ticket SVG icon
const TicketIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 9V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-4z" />
  </svg>
);

export default function AuthLayout({ children }) {
  return (
    <div className={styles.wrapper}>
      {/* ── Left: Concert Visual ── */}
      <div className={styles.panel}>
        <div className={styles.glowDots}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className={styles.glowDot} style={{ '--i': i }} />
          ))}
        </div>
        <div className={styles.crowd} />
        <div className={styles.panelContent}>
          <div className={styles.logo}>
            <TicketIcon />
          </div>
          <h2 className={styles.brandName}>TicketGo</h2>
          <p className={styles.tagline}>Premium ticketing for unforgettable experiences</p>
        </div>
      </div>

      {/* ── Right: Form area ── */}
      <div className={styles.formSide}>
        <div className={styles.formBox}>{children}</div>
      </div>
    </div>
  );
}
