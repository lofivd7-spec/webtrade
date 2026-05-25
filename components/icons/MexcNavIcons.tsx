import React from 'react';

type IconProps = {
  active?: boolean;
  className?: string;
  size?: number;
};

function Svg(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 22, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    />
  );
}

/**
 * MEXC-like duotone icons. Use `currentColor`, rely on parent text color.
 * Active state slightly increases fill opacity.
 */

export const NavHomeIcon: React.FC<IconProps> = ({ active = false, className, size = 22 }) => {
  if (active) {
    return (
      <Svg className={`${className} animate-nav-bounce`} size={size} aria-hidden>
        <path
          d="M20 10.75v8.5a1.75 1.75 0 01-1.75 1.75h-3.5a.75.75 0 01-.75-.75v-4.5h-4v4.5a.75.75 0 01-.75.75h-3.5A1.75 1.75 0 014 19.25v-8.5a1.75 1.75 0 01.55-1.25l6.5-5.5a1.75 1.75 0 012.4 0l6.5 5.5c.35.3.55.7.55 1.25z"
          fill="var(--color-neon)"
        />
      </Svg>
    );
  } else {
    return (
      <Svg className={className} size={size} aria-hidden>
        <path
          d="M20 10.75v8.5a1.75 1.75 0 01-1.75 1.75h-3.5a.75.75 0 01-.75-.75v-4.5h-4v4.5a.75.75 0 01-.75.75h-3.5A1.75 1.75 0 014 19.25v-8.5a1.75 1.75 0 01.55-1.25l6.5-5.5a1.75 1.75 0 012.4 0l6.5 5.5c.35.3.55.7.55 1.25z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
};

export const NavMarketsIcon: React.FC<IconProps> = ({ active = false, className, size = 22 }) => {
  if (active) {
    return (
      <Svg className={`${className} animate-nav-bounce`} size={size} aria-hidden>
        <rect x="4" y="9" width="3.5" height="11" rx="1" fill="var(--color-neon)" />
        <rect x="10.25" y="4" width="3.5" height="16" rx="1" fill="var(--color-neon)" />
        <rect x="16.5" y="12" width="3.5" height="8" rx="1" fill="var(--color-neon)" />
      </Svg>
    );
  } else {
    return (
      <Svg className={className} size={size} aria-hidden>
        <rect x="4" y="9" width="3.5" height="11" rx="1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="10.25" y="4" width="3.5" height="16" rx="1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="16.5" y="12" width="3.5" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
};

export const NavTradeIcon: React.FC<IconProps> = ({ active = false, className, size = 22 }) => {
  if (active) {
    return (
      <Svg className={`${className} animate-nav-bounce`} size={size} aria-hidden>
        <path d="M8 19V5m0 0L4 9m4-4l4 4" stroke="var(--color-neon)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 5v14m0 0l-4-4m4 4l4-4" stroke="var(--color-neon)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  } else {
    return (
      <Svg className={className} size={size} aria-hidden>
        <path d="M8 19V5m0 0L4 9m4-4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 5v14m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
};

export const NavWalletIcon: React.FC<IconProps> = ({ active = false, className, size = 22 }) => {
  if (active) {
    return (
      <Svg className={`${className} animate-nav-bounce`} size={size} aria-hidden>
        <path
          d="M19 5H5a3 3 0 00-3 3v8a3 3 0 003 3h14a3 3 0 003-3V8a3 3 0 00-3-3zm-1.5 8.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
          fill="var(--color-neon)"
        />
      </Svg>
    );
  } else {
    return (
      <Svg className={className} size={size} aria-hidden>
        <path
          d="M19 5H5a3 3 0 00-3 3v8a3 3 0 003 3h14a3 3 0 003-3V8a3 3 0 00-3-3z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      </Svg>
    );
  }
};

