import React from 'react';

const sizes = {
  sm: { outer: 20, border: 2 },
  md: { outer: 32, border: 3 },
  lg: { outer: 52, border: 4 },
};

function LoadingSpinner({ size = 'md', color = 'var(--color-primary)', label = 'Loading...' }) {
  const s = sizes[size] || sizes.md;
  return (
    <div
      role="status"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <span
        style={{
          width: s.outer,
          height: s.outer,
          border: `${s.border}px solid var(--color-border)`,
          borderTopColor: color,
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.75s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <LoadingSpinner size="lg" />
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading...</span>
    </div>
  );
}

export default LoadingSpinner;
