import React from 'react';
import { useExamTimer } from '../hooks/useExamTimer';

export default function TimerBar({ initialSeconds, onTimeUp, isPaused }) {
  const { formatted, isWarning, isDanger, progressPercent } = useExamTimer(initialSeconds, isPaused);
  
  React.useEffect(() => {
    if (progressPercent <= 0 && onTimeUp) {
      onTimeUp();
    }
  }, [progressPercent, onTimeUp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div 
        style={{ 
          fontSize: '36px', 
          fontWeight: 800,
          color: isDanger ? 'var(--danger)' : isWarning ? 'var(--warn)' : 'var(--text-primary)',
          transition: 'color 300ms ease'
        }}
        className={isDanger ? 'animate-pulse-once' : ''}
      >
        {formatted}
      </div>
      <div style={{ width: '120px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ 
          width: `${progressPercent}%`, 
          height: '100%', 
          background: isDanger ? 'var(--danger)' : 'var(--timer-grad)',
          transition: 'width 1000ms linear, background 300ms ease'
        }} />
      </div>
    </div>
  );
}
