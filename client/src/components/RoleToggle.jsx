import React from "react";

// Toggle component for user roles
export default function RoleToggle({ value, onChange, options }) {
  const baseBtnClass =
    "flex-1 py-[9px] px-4 rounded-[6px] font-inter text-[0.875rem] font-medium cursor-pointer transition-all duration-200";
  const activeClass =
    "bg-accent text-white shadow-[0_2px_12px_rgba(91,95,199,0.4)]";
  const inactiveClass =
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5";

  return (
    <div
      className="flex bg-bg-input rounded-sm p-1 mb-6 border border-border"
      role="group"
    >
      {options.map((opt) => {
        const isActive = value === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            className={`${baseBtnClass} ${isActive ? activeClass : inactiveClass}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
