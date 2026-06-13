import React from 'react';
import { useAudioMonitor } from '../hooks/useAudioMonitor';
import VolumeHeatBar from '../components/VolumeHeatBar';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function MicSetup({ onNext }) {
  const { level, isActive, isCalibrating, hasSpiked, error, startMonitor } = useAudioMonitor();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      
      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '48px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--border)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--border)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border)' }} />
      </div>

      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: '48px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
      }} className="animate-slide-up">
        
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Microphone Check</h2>
          <p style={{ fontWeight: 300, color: 'var(--text-secondary)' }}>
            We'll verify your microphone is active and monitor for background audio during the exam.
          </p>
        </div>

        {error ? (
          <div style={{ padding: '16px', background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertCircle />
            <span style={{ fontSize: '14px' }}>{error} Please check system permissions.</span>
          </div>
        ) : !isActive ? (
          <button 
            onClick={startMonitor}
            style={{
              padding: '16px',
              border: '1.5px solid var(--primary)',
              borderRadius: 'var(--radius-btn)',
              color: 'var(--primary)',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            Allow Microphone
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 600, padding: '12px 16px', background: 'var(--success-soft)', borderRadius: '8px' }}>
              <CheckCircle2 size={20} /> Microphone active
            </div>
            
            <VolumeHeatBar level={level} />

            {isCalibrating ? (
              <div style={{ padding: '16px', background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }} className="animate-pulse-once">
                Calibrating ambient noise... Please remain quiet for 5 seconds.
              </div>
            ) : (
              <div style={{ padding: '16px', background: 'var(--warn-soft)', color: '#D97706', borderRadius: '8px', fontSize: '14px', fontWeight: 500 }}>
                Say something out loud to confirm your microphone is working.
              </div>
            )}
          </div>
        )}

        <button 
          onClick={onNext}
          disabled={!hasSpiked}
          style={{
            width: '100%',
            background: hasSpiked ? 'var(--primary)' : 'var(--border)',
            color: hasSpiked ? 'white' : 'var(--text-disabled)',
            fontWeight: 700,
            fontSize: '14px',
            height: '52px',
            borderRadius: 'var(--radius-btn)',
            cursor: hasSpiked ? 'pointer' : 'not-allowed',
            transition: 'all 300ms ease'
          }}
          className={hasSpiked ? 'animate-pulse-once' : ''}
        >
          Continue
        </button>

      </div>
    </div>
  );
}
