import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useProctoringStore } from '../store/proctoringStore';
import WarningDots from './WarningDots';

export default function WarningToast() {
  const [toast, setToast] = useState(null);
  const disqualified = useProctoringStore(state => state.disqualified);

  useEffect(() => {
    const handleWarning = (e) => {
      const entry = e.detail;
      // Filter out purely informational events from showing toast
      if (['SHORTCUT_ATTEMPT', 'CLOSE_ATTEMPT'].includes(entry.type)) return;
      
      setToast(entry);
      
      if (entry.count < 3) {
        setTimeout(() => setToast(null), 4000);
      }
    };

    window.addEventListener('proctor-warning', handleWarning);
    return () => window.removeEventListener('proctor-warning', handleWarning);
  }, []);

  if (!toast || disqualified) return null;

  const descriptions = {
    'GAZE_DEVIATION': 'Please keep your eyes on the screen.',
    'FACE_ABSENT': 'Face not detected in the camera frame.',
    'MULTIPLE_FACES': 'Multiple people detected in frame.',
    'HEAD_POSE_VIOLATION': 'Please keep your head facing forward.',
    'BACKGROUND_AUDIO': 'Background speech or noise detected.',
    'WINDOW_BLUR': 'You must remain focused on the exam window.',
    'PASTE_DETECTED': 'Pasting content is prohibited.',
    'FULLSCREEN_EXIT': 'Fullscreen mode was exited.',
    'FULLSCREEN_EXIT_TIMEOUT': 'Stayed out of fullscreen mode for more than 5 seconds.'
  };

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'var(--warn-soft)',
      border: '1.5px solid var(--warn)',
      borderRadius: '10px',
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: 'var(--shadow-card)'
    }} className="animate-slide-up">
      <AlertTriangle color="var(--warn)" size={24} />
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--warn)' }}>
          Warning {toast.count} of 3
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
          {descriptions[toast.type] || 'Proctoring violation detected.'}
        </div>
      </div>
      <WarningDots count={toast.count} />
    </div>
  );
}
