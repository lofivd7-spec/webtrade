import React, { useState, useEffect } from 'react';

const STATUSES = [
  'Connecting to secure server…',
  'Fetching market data…',
  'Loading account assets…',
  'Verifying security protocols…',
  'Finalizing setup…',
];

const SplashScreen: React.FC = () => {
  const [statusIdx, setStatusIdx] = useState(0);
  const [barProgress, setBarProgress] = useState(0);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i < STATUSES.length) {
        setStatusIdx(i);
        setBarProgress(Math.min(100, (i / STATUSES.length) * 100));
      } else {
        clearInterval(iv);
        setBarProgress(100);
      }
    }, 420);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: '#070B12' }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(42,123,255,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-0">
        {/* Logo */}
        <img
          src="/mexc-logo.png"
          alt="MEXC"
          className="animate-splash-logo w-52 h-auto"
        />

        {/* Spacer */}
        <div className="mt-14 flex flex-col items-center gap-5 w-52">
          {/* Progress bar track */}
          <div className="w-full h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${barProgress}%`,
                background: 'linear-gradient(90deg, #1a5cd0 0%, #2A7BFF 60%, #5aa0ff 100%)',
                boxShadow: '0 0 8px rgba(42,123,255,0.6)',
              }}
            />
          </div>

          {/* Status text */}
          <div className="flex flex-col items-center gap-1.5">
            <span
              key={statusIdx}
              className="text-[10px] font-medium uppercase tracking-[0.28em] text-center animate-fade-in-fast"
              style={{ color: 'rgba(42,123,255,0.85)' }}
            >
              {STATUSES[statusIdx]}
            </span>
            <span className="text-[9px] uppercase tracking-[0.12em]" style={{ color: 'rgba(110,122,140,0.55)' }}>
              MEXC Global · Secure Environment
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
