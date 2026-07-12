const TicketIcon = () => (
  <svg
    className="w-9 h-9"
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M22 9V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-4z" />
  </svg>
);
const GLOW_COLORS = [
  "from-[#ff9f45]",
  "from-[#c060ff]",
  "from-[#4a7fff]",
  "from-[#ff9f45]",
  "from-[#c060ff]",
];

// Layout wrapper for authentication pages
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {}
      <div className="relative flex min-h-[240px] flex-none md:flex-1 flex-col items-center justify-center overflow-hidden before:absolute before:inset-0 before:z-0 before:bg-panel-gradient after:absolute after:inset-0 after:z-10 after:bg-beam after:animate-beamShift">
        <div className="absolute bottom-[22%] left-0 right-0 z-20 flex justify-center gap-[60px]">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`h-[80px] w-[6px] animate-spotlight rounded-[3px] bg-gradient-to-b ${GLOW_COLORS[i]} to-transparent blur-[2px]`}
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-20 h-[45%] bg-crowd" />
        <div className="relative z-30 px-10 text-center md:-mt-[60px]">
          <div className="mb-5 inline-flex h-[72px] w-[72px] animate-float items-center justify-center rounded-[20px] border border-white/10 bg-white/10 backdrop-blur-md">
            <TicketIcon />
          </div>
          <h2 className="mb-2.5 text-[1.8rem] md:text-[2.4rem] font-extrabold tracking-[-0.5px] text-white">
            TicketGo
          </h2>
          <p className="text-base text-white/55">
            Premium ticketing for unforgettable experiences
          </p>
        </div>
      </div>
      {}
      <div className="flex w-full items-center justify-center border-t border-border bg-bg-card px-6 py-8 md:min-w-[420px] md:w-[480px] md:border-l md:border-t-0 md:px-[52px] md:py-12">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
