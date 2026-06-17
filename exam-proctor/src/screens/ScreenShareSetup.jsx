import React, { useRef, useState, useEffect } from 'react';
import { Monitor, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ScreenShareSetup({ onNext }) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const requireScreenShare = import.meta.env.VITE_REQUIRE_SCREEN_SHARE !== 'false';
  const canContinue = stream || !requireScreenShare;

  const startScreenShare = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false
      });
      
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack ? videoTrack.getSettings() : {};
      
      if (settings.displaySurface && settings.displaySurface !== 'monitor') {
        mediaStream.getTracks().forEach(t => t.stop());
        setError("You must share your entire screen. Sharing a single window or tab is not allowed.");
        return;
      }
      
      setStream(mediaStream);
      window.screenShareStream = mediaStream;
    } catch (err) {
      console.error(err);
      setError("Screen sharing permission denied or cancelled.");
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      
      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '48px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--success)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--primary)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
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
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Screen Share Check</h2>
          <p style={{ fontWeight: 300, color: 'var(--text-secondary)', marginBottom: !requireScreenShare ? '12px' : '0px' }}>
            We require sharing your entire screen to monitor desktop activity during the exam.
          </p>
          {!requireScreenShare && (
            <div style={{ fontSize: '12px', color: 'var(--primary)', background: 'var(--primary-soft)', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: '8px', fontWeight: 600, display: 'inline-block', width: '100%', boxSizing: 'border-box', marginTop: '8px', textAlign: 'left' }}>
              ⚠️ Testing Mode Active: Screen sharing requirement bypassed via environment variable. You can proceed without sharing.
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: '16px', background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertCircle />
            <span style={{ fontSize: '14px' }}>{error}</span>
          </div>
        )}

        {!stream ? (
          <button 
            onClick={startScreenShare}
            style={{
              padding: '16px',
              border: '1.5px solid var(--primary)',
              borderRadius: 'var(--radius-btn)',
              color: 'var(--primary)',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Monitor size={20} /> Share Screen
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'var(--success-soft)', 
              color: 'var(--success)', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              fontWeight: 600, 
              fontSize: '14px', 
              alignSelf: 'flex-start' 
            }}>
              Screen sharing active <CheckCircle2 size={16} />
            </div>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                aspectRatio: '16/9',
                objectFit: 'cover',
                borderRadius: '12px',
                border: '2px solid var(--success)'
              }}
            />
          </div>
        )}

        <button 
          onClick={onNext}
          disabled={!canContinue}
          style={{
            width: '100%',
            background: canContinue ? 'var(--primary)' : 'var(--border)',
            color: canContinue ? 'white' : 'var(--text-disabled)',
            fontWeight: 700,
            fontSize: '14px',
            height: '52px',
            borderRadius: 'var(--radius-btn)',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            transition: 'all 300ms ease'
          }}
        >
          Continue
        </button>

      </div>
    </div>
  );
}
