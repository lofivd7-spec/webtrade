import React, { useState, useEffect } from 'react';

const STATUSES = [
  'Initializing API connection...',
  'Synchronizing order books...',
  'Loading asset balances...',
  'Securing user environment...',
  'Finalizing interface...'
];

const SplashScreen: React.FC = () => {
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i < STATUSES.length) {
        setStatusIdx(i);
      } else {
        clearInterval(iv);
      }
    }, 420);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
      style={{ background: '#06090e' }}
    >
      {/* Matte ambient depth light */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(27, 142, 255, 0.035) 0%, rgba(6, 9, 14, 0) 65%)',
        }}
      />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center gap-0">
        {/* Sleek Logo */}
        <img
          src="/mexc-logo.png"
          alt="MEXC"
          className="animate-premium-logo w-44 h-auto"
        />

        {/* Loading Indicator and Status - Staggered Fade-in */}
        <div className="mt-12 flex flex-col items-center gap-6 w-60 animate-premium-fade-in">
          {/* Elegant High-Precision Circular SVG Spinner */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg className="animate-premium-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-[0.04]"
                cx="12"
                cy="12"
                r="10"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <path
                className="opacity-90"
                fill="#1b8eff"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>

          {/* Status text */}
          <div className="flex flex-col items-center gap-1.5 h-10 justify-center">
            <span
              key={statusIdx}
              className="text-[9.5px] font-mono font-medium uppercase tracking-[0.24em] text-center text-textSecondary animate-fade-in-fast"
            >
              {STATUSES[statusIdx]}
            </span>
          </div>
        </div>
      </div>

      {/* Professional Secure Environment Stamp */}
      <div className="absolute bottom-10 flex items-center gap-2 text-[9px] uppercase tracking-[0.22em] text-textMuted/45 font-mono select-none pointer-events-none animate-premium-fade-in">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Secure Trading Environment</span>
      </div>
    </div>
  );
};

export default SplashScreen;
