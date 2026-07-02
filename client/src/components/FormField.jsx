import { useState } from 'react';

const EyeOpen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosed = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function FormField({ label, id, type = 'text', error, required, ...props }) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === 'password';
  const inputType  = isPassword && showPw ? 'text' : type;

  const baseInputClass = "w-full px-4 py-3 bg-bg-input border-[1.5px] border-border rounded-sm text-text-primary font-inter text-[0.9rem] outline-none transition-all duration-200 placeholder:text-text-muted focus:border-border-focus focus:bg-bg-input-focus focus:shadow-[0_0_0_3px_rgba(91,95,199,0.15)]";
  const errorInputClass = "!border-error !shadow-[0_0_0_3px_rgba(224,92,106,0.15)]";
  const passwordPaddingClass = "pr-[44px]";

  return (
    <div className="mb-[18px]">
      <label htmlFor={id} className="block text-[0.825rem] font-semibold text-text-primary mb-[7px]">
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          type={inputType}
          className={`${baseInputClass} ${error ? errorInputClass : ''} ${isPassword ? passwordPaddingClass : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-text-muted cursor-pointer flex items-center p-[2px] transition-colors duration-200 hover:text-text-secondary"
            onClick={() => setShowPw((v) => !v)}
            aria-label="Toggle password visibility"
          >
            {showPw ? <EyeClosed /> : <EyeOpen />}
          </button>
        )}
      </div>

      {error && <p className="text-[0.78rem] text-error mt-[5px]">{error}</p>}
    </div>
  );
}
