import React from 'react';
import { useProctoringStore } from '../store/proctoringStore';

export default function DisqualificationRiskBar({ showLabel = true, width = '140px' }) {
  const pCheat = useProctoringStore(state => state.pCheat);
  
  // Calculate how close we are to 0.85 (which is the disqualification threshold)
  const riskPercent = Math.min(Math.round((pCheat / 0.85) * 100), 100);
  
  // Determine color based on risk percentage
  let barColor = 'var(--success)';
  
  if (riskPercent >= 75) {
    barColor = 'var(--danger)';
  } else if (riskPercent >= 35) {
    barColor = 'var(--warn)';
  }

  const isCritical = riskPercent >= 75;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width }}>
      {showLabel && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '11px', 
          fontWeight: 600, 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em'
        }}>
          <span>Suspicion</span>
          <span style={{ 
            color: barColor, 
            fontWeight: 700
          }}>
            {riskPercent}%
          </span>
        </div>
      )}
      <div style={{ 
        width: '100%', 
        height: '6px', 
        background: 'var(--border)', 
        borderRadius: '3px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{ 
          width: `${riskPercent}%`, 
          height: '100%', 
          background: barColor, 
          borderRadius: '3px',
          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease',
          boxShadow: isCritical ? '0 0 8px var(--danger)' : 'none'
        }} />
      </div>
    </div>
  );
}
