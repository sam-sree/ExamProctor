import React from 'react';

export default function VolumeHeatBar({ level }) {
  const getGradient = () => {
    return `linear-gradient(90deg, 
      var(--success) 0%, 
      var(--success) 30%, 
      var(--warn) 60%, 
      var(--danger) 100%)`;
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
        Live audio level
      </div>
      <div style={{ 
        width: '100%', 
        height: '16px', 
        background: 'var(--border)', 
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${level}%`,
          background: getGradient(),
          transition: 'width 50ms linear'
        }} />
      </div>
    </div>
  );
}
