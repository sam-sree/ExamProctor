import React, { useRef, useState, useEffect } from 'react';
import { useCVEvents } from '../hooks/useCVEvents';

export default function CameraSetup({ onNext }) {
  const [cameraError, setCameraError] = useState(null);
  const { isConnected, lastFaceEvent, systemError, lastFrame } = useCVEvents('ws://localhost:8765');

  const getStatusColor = () => {
    if (!isConnected) return 'var(--warn)';
    if (lastFaceEvent === 'FACE_DETECTED' || lastFaceEvent === 'FACE_NOMINAL') return 'var(--success)';
    if (lastFaceEvent === 'MULTIPLE_FACES' || lastFaceEvent === 'FACE_ABSENT') return 'var(--danger)';
    return 'var(--text-disabled)';
  };

  const getStatusText = () => {
    if (systemError) return `Sidecar Error: ${systemError}`;
    if (!isConnected) return "Connecting to sidecar...";
    if (lastFaceEvent === 'FACE_DETECTED' || lastFaceEvent === 'FACE_NOMINAL') return "Face detected - good position";
    if (lastFaceEvent === 'MULTIPLE_FACES') return "Multiple faces detected - ensure you are alone";
    if (lastFaceEvent === 'FACE_ABSENT') return "No face detected - position yourself in frame";
    return "Scanning for face...";
  };

  const isReady = isConnected && (lastFaceEvent === 'FACE_NOMINAL' || lastFaceEvent === 'FACE_DETECTED');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '48px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--primary)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--border)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border)' }} />
      </div>

      <div style={{
        width: '100%',
        maxWidth: '640px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: '48px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }} className="animate-slide-up">
        
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Camera Check</h2>
          <p style={{ fontWeight: 300, color: 'var(--text-secondary)' }}>
            Your camera is used for continuous identity and gaze verification.
          </p>
        </div>

        {!lastFrame ? (
          <div style={{ padding: '32px', textAlign: 'center', background: 'var(--bg)', borderRadius: '12px', border: '1.5px dashed var(--border)' }}>
            {systemError ? `Camera Error: ${systemError}` : 'Waiting for camera feed from sidecar...'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <img 
              src={lastFrame}
              alt="Live camera feed"
              style={{
                width: '100%',
                aspectRatio: '16/9',
                objectFit: 'cover',
                borderRadius: '12px',
                border: '2px solid var(--primary)',
                transform: 'scaleX(-1)' // Mirror
              }} 
            />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getStatusColor(), transition: 'background 300ms ease' }} className={!isConnected ? "animate-pulse-once" : ""} />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{getStatusText()}</span>
            </div>
          </div>
        )}

        <button 
          onClick={onNext}
          disabled={!isReady}
          style={{
            width: '100%',
            background: isReady ? 'var(--primary)' : 'var(--border)',
            color: isReady ? 'white' : 'var(--text-disabled)',
            fontWeight: 700,
            fontSize: '14px',
            height: '52px',
            borderRadius: 'var(--radius-btn)',
            cursor: isReady ? 'pointer' : 'not-allowed',
            transition: 'all 300ms ease',
            marginTop: '16px'
          }}
        >
          Continue
        </button>

      </div>
    </div>
  );
}
