import React, { useState, useEffect } from 'react';
import { Eye, Mic, User, Lock, Monitor, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useProctoringStore } from '../store/proctoringStore';
import DisqualificationRiskBar from '../components/DisqualificationRiskBar';

export default function Briefing({ onEnterExam, onBackToScreenShare }) {
  const [agreed, setAgreed] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const resetProctoring = useProctoringStore(state => state.resetProctoring);

  useEffect(() => {
    resetProctoring();
  }, [resetProctoring]);

  const rules = [
    { icon: Eye, text: "Keep your eyes on the screen at all times. Looking away for more than 3 seconds triggers a warning." },
    { icon: Mic, text: "Stay in a quiet space. Background voices will be flagged." },
    { icon: User, text: "Only you should be present in your room." },
    { icon: Lock, text: "This window cannot be minimized or closed until you submit." },
    { icon: Monitor, text: "If you are using multiple monitors, disconnect all secondary displays before beginning. The system cannot fully verify single-monitor compliance; use of additional monitors will be flagged in the administrator report." },
    { icon: AlertTriangle, text: "A high suspicion score results in automatic disqualification. The exam administrator will be notified." }
  ];

  const handleStart = async () => {
    const requireScreenShare = import.meta.env.VITE_REQUIRE_SCREEN_SHARE !== 'false';
    const screenStream = window.screenShareStream;
    const isSharing = screenStream && screenStream.getVideoTracks().some(track => track.readyState === 'live');
    
    if (requireScreenShare && !isSharing) {
      setFullscreenError("Your screen share has disconnected. Please go back and set it up again.");
      return;
    }

    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      
      setFullscreenError('');
      onEnterExam();
    } catch (err) {
      console.error("Fullscreen request rejected", err);
      setFullscreenError("Fullscreen is required to begin this exam. Please allow fullscreen access and try again.");
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '48px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems:'center', justifyContent: 'center' }}><CheckCircle2 size={14}/></div>
        <div style={{ width: '32px', height: '2px', background: 'var(--success)' }} />
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems:'center', justifyContent: 'center' }}><CheckCircle2 size={14}/></div>
        <div style={{ width: '32px', height: '2px', background: 'var(--success)' }} />
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems:'center', justifyContent: 'center' }}><CheckCircle2 size={14}/></div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '680px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: '48px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
      }} className="animate-slide-up">
        
        <h2 style={{ fontSize: '28px', fontWeight: 700 }}>You're all set. Here's what to expect.</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rules.map((Rule, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <Rule.icon size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '15px', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.5, textAlign: 'left' }}>
                {Rule.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px', background: 'var(--bg)', borderRadius: '12px', width: '100%' }}>
          <DisqualificationRiskBar width="100%" />
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
            Suspicion Level tracks proctoring events. Minor actions raise it slightly, while severe violations (like switching windows) raise it significantly. If the suspicion bar reaches 100%, the session will automatically terminate.
          </div>
        </div>

        <label style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <input 
            type="checkbox" 
            checked={agreed} 
            onChange={e => setAgreed(e.target.checked)} 
            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
          />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>I understand the above and confirm I am ready to begin.</span>
        </label>

        {fullscreenError && (
          <div style={{ 
            padding: '16px', 
            background: 'var(--danger-soft)', 
            color: 'var(--danger)', 
            borderRadius: '8px', 
            display: 'flex', 
            flexDirection: 'column',
            gap: '12px', 
            alignItems: 'flex-start',
            textAlign: 'left',
            fontWeight: 600,
            fontSize: '14px',
            lineHeight: 1.4
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <span>{fullscreenError}</span>
            </div>
            {fullscreenError.includes("screen share") && (
              <button 
                onClick={onBackToScreenShare}
                style={{
                  marginTop: '4px',
                  padding: '8px 16px',
                  background: 'var(--danger)',
                  color: 'white',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Go back to Screen Share Setup
              </button>
            )}
          </div>
        )}

        <button 
          onClick={handleStart}
          disabled={!agreed}
          style={{
            width: '100%',
            background: agreed ? 'var(--primary)' : 'var(--border)',
            color: agreed ? 'white' : 'var(--text-disabled)',
            fontWeight: 700,
            fontSize: '16px',
            height: '56px',
            borderRadius: 'var(--radius-btn)',
            cursor: agreed ? 'pointer' : 'not-allowed',
            transition: 'all 300ms ease'
          }}
        >
          Enter Exam
        </button>

      </div>
    </div>
  );
}
