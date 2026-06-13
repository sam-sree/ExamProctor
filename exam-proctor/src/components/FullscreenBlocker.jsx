import React, { useEffect, useState, useRef } from 'react';
import { useExamStore } from '../store/examStore';
import { useProctoringStore } from '../store/proctoringStore';
import { ShieldAlert } from 'lucide-react';

export default function FullscreenBlocker() {
  const examStatus = useExamStore(state => state.status);
  const examActive = examStatus === 'active';
  const fireWarning = useProctoringStore(state => state.fireWarning);
  const warningCount = useProctoringStore(state => state.warningCount);

  const [isFullscreen, setIsFullscreen] = useState(true); // ✅ optimistic init
  const [countdown, setCountdown] = useState(null); // null = no countdown running
  const countdownIntervalRef = useRef(null);
  const secondWarningFiredRef = useRef(false); // ✅ ensure it only fires once per exit

  const clearCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    secondWarningFiredRef.current = false;
  };

  const startCountdown = () => {
    // Don't double-start if already running
    if (countdownIntervalRef.current) return;

    setCountdown(5);
    let remaining = 5;

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCountdown(0);

        // ✅ Fire second warning only once
        if (!secondWarningFiredRef.current) {
          secondWarningFiredRef.current = true;
          fireWarning('FULLSCREEN_EXIT_TIMEOUT', {}, true);
        }
      }
    }, 1000);
  };

  useEffect(() => {
    if (!examActive) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen) {
        // First warning on exit
        fireWarning('FULLSCREEN_EXIT');
        useProctoringStore.setState({ isFullscreenExited: true });
        // Start 5-second countdown for second warning
        startCountdown();
      } else {
        // Returned to fullscreen — cancel countdown and reset
        clearCountdown();
        useProctoringStore.setState({ isFullscreenExited: false });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // ✅ Delayed initial check only — no immediate check
    const checkTimeout = setTimeout(() => {
      if (!document.fullscreenElement) {
        useProctoringStore.setState({ isFullscreenExited: true });
        setIsFullscreen(false);
      }
    }, 1200);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearTimeout(checkTimeout);
      clearCountdown();
      useProctoringStore.setState({ isFullscreenExited: false });
    };
  }, [examActive, fireWarning]);

  const requestFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) await elem.requestFullscreen();
      else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
      else if (elem.msRequestFullscreen) await elem.msRequestFullscreen();
    } catch (err) {
      console.error('Failed to enter fullscreen:', err);
    }
  };

  if (!examActive || isFullscreen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(240, 244, 255, 0.97)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        maxWidth: '500px',
        background: 'var(--surface)',
        padding: '48px',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px'
      }} className="animate-slide-up">

        <ShieldAlert size={64} color="var(--danger)" />

        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Fullscreen Mode Exited
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '15px' }}>
            You have exited fullscreen. Return to fullscreen to continue your exam.
            The exam timer is paused and this event has been logged.
          </p>
        </div>

        {/* ✅ Countdown warning shown only while timer is running and hasn't fired yet */}
        {countdown !== null && countdown > 0 && (
          <div style={{
            padding: '12px 20px',
            background: 'var(--warn-soft)',
            border: '1.5px solid var(--warn)',
            borderRadius: '8px',
            color: 'var(--warn)',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ⚠ Stay off fullscreen and an additional warning will be logged in{' '}
            <span style={{ fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>
              {countdown}s
            </span>
          </div>
        )}

        {/* ✅ Shown after the second warning fires */}
        {countdown === 0 && (
          <div style={{
            padding: '12px 20px',
            background: 'var(--danger-soft)',
            border: '1.5px solid var(--danger)',
            borderRadius: '8px',
            color: 'var(--danger)',
            fontWeight: 700,
            fontSize: '14px'
          }}>
            ⛔ Additional warning logged for staying off fullscreen.
          </div>
        )}

        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '8px' }}>
          Current Warnings: <strong style={{ color: warningCount >= 2 ? 'var(--danger)' : 'var(--text-primary)' }}>{warningCount} of 3</strong>
        </div>

        <button
          onClick={requestFullscreen}
          style={{
            padding: '14px 28px',
            background: 'var(--primary)',
            color: 'white',
            borderRadius: 'var(--radius-btn)',
            fontWeight: 700,
            fontSize: '15px',
            boxShadow: 'var(--shadow-btn-hover)',
            transition: 'var(--transition-default)'
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Return to Fullscreen
        </button>
      </div>
    </div>
  );
}
