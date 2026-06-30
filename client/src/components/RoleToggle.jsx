import styles from './RoleToggle.module.css';

export default function RoleToggle({ value, onChange, options }) {
  return (
    <div className={styles.toggle} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.btn} ${value === opt.value ? styles.active : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
