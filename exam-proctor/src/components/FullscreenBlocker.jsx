import React, { useEffect, useState } from 'react';
import { useExamStore } from '../store/examStore';
import { useProctoringStore } from '../store/proctoringStore';
import { ShieldAlert } from 'lucide-react';

export default function FullscreenBlocker() {
  const examStatus = useExamStore(state => state.status);
  const examActive = examStatus === 'active';
  const fireWarning = useProctoringStore(state => state.fireWarning);
  
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    if (!examActive) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      
      // If we exit fullscreen, fire warning and set state in store
      if (!isCurrentlyFullscreen) {
        fireWarning('FULLSCREEN_EXIT');
        useProctoringStore.setState({ isFullscreenExited: true });
      } else {
        useProctoringStore.setState({ isFullscreenExited: false });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Initial check in case we mounted out of fullscreen
    if (!document.fullscreenElement) {
      useProctoringStore.setState({ isFullscreenExited: true });
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      useProctoringStore.setState({ isFullscreenExited: false });
    };
  }, [examActive, fireWarning]);

  const requestFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch (err) {
      console.error("Failed to enter fullscreen:", err);
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
            You have exited fullscreen. Return to fullscreen to continue your exam. The exam timer is paused, and this event has been logged.
          </p>
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
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Return to Fullscreen
        </button>
      </div>
    </div>
  );
}
