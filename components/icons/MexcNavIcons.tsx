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
  const fill = active ? 0.22 : 0.12;
  return (
    <Svg className={className} size={size} aria-hidden>
      <path
        d="M4.2 10.3 11.1 4.6c.55-.46 1.35-.46 1.9 0l6.9 5.7c.34.28.54.7.54 1.15V20a1.7 1.7 0 0 1-1.7 1.7H15a.9.9 0 0 1-.9-.9v-4.8a1.2 1.2 0 0 0-1.2-1.2h-1.8a1.2 1.2 0 0 0-1.2 1.2v4.8a.9.9 0 0 1-.9.9H5.36A1.7 1.7 0 0 1 3.66 20v-8.55c0-.45.2-.87.54-1.15Z"
        fill="currentColor"
        opacity={fill}
      />
      <path
        d="M4.2 10.3 11.1 4.6c.55-.46 1.35-.46 1.9 0l6.9 5.7c.34.28.54.7.54 1.15V20a1.7 1.7 0 0 1-1.7 1.7H5.36A1.7 1.7 0 0 1 3.66 20v-8.55c0-.45.2-.87.54-1.15Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const NavMarketsIcon: React.FC<IconProps> = ({ active = false, className, size = 22 }) => {
  const fill = active ? 0.24 : 0.12;
  return (
    <Svg className={className} size={size} aria-hidden>
      <path
        d="M6 19a1 1 0 0 1-1-1V6.2c0-.66.54-1.2 1.2-1.2h11.6c.66 0 1.2.54 1.2 1.2V18a1 1 0 0 1-1 1H6Z"
        fill="currentColor"
        opacity={fill}
      />
      <path
        d="M7 15.5 10.1 12l2.2 2.2L17.2 8.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 5h11.6c.66 0 1.2.54 1.2 1.2V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6.2C5 5.54 5.54 5 6.2 5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const NavTradeIcon: React.FC<IconProps> = ({ active = false, className, size = 22 }) => {
  const fill = active ? 0.26 : 0.12;
  return (
    <Svg className={className} size={size} aria-hidden>
      <path
        d="M7.4 17.8c-.55 0-1-.45-1-1v-8c0-.55.45-1 1-1h9.2c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1H7.4Z"
        fill="currentColor"
        opacity={fill}
      />
      <path
        d="M8.5 12.8h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 7.8V6.1c0-.61.49-1.1 1.1-1.1h4.3c.61 0 1.1.49 1.1 1.1v4.2c0 .61-.49 1.1-1.1 1.1h-1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      <path
        d="M7.4 7.8h9.2c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1H7.4c-.55 0-1-.45-1-1v-8c0-.55.45-1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const NavWalletIcon: React.FC<IconProps> = ({ active = false, className, size = 22 }) => {
  const fill = active ? 0.24 : 0.11;
  return (
    <Svg className={className} size={size} aria-hidden>
      <path
        d="M6.2 7.2h11.2c.88 0 1.6.72 1.6 1.6v8.6c0 .88-.72 1.6-1.6 1.6H6.2c-.88 0-1.6-.72-1.6-1.6V8.8c0-.88.72-1.6 1.6-1.6Z"
        fill="currentColor"
        opacity={fill}
      />
      <path
        d="M6.2 7.2h11.2c.88 0 1.6.72 1.6 1.6v8.6c0 .88-.72 1.6-1.6 1.6H6.2c-.88 0-1.6-.72-1.6-1.6V8.8c0-.88.72-1.6 1.6-1.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M19 11.2h-3.2c-.88 0-1.6.72-1.6 1.6s.72 1.6 1.6 1.6H19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
      />
      <circle cx="15.9" cy="12.8" r="0.9" fill="currentColor" opacity={active ? 0.9 : 0.7} />
      <path
        d="M7.2 7.2V6.4c0-.77.63-1.4 1.4-1.4h8.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={0.85}
      />
    </Svg>
  );
};

