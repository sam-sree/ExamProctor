import React from 'react';

export default function WarningDots({ count }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {[1, 2, 3].map(num => (
        <div 
          key={num}
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: num <= count ? '1.5px solid var(--danger)' : '1.5px solid var(--border)',
            background: num <= count ? 'var(--danger)' : 'transparent',
            transition: 'var(--transition-default)'
          }}
        />
      ))}
    </div>
  );
}
