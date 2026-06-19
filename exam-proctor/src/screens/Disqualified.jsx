import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useProctoringStore } from '../store/proctoringStore';
import { useExamStore } from '../store/examStore';

export default function Disqualified({ onExit }) {
  const warningLog = useProctoringStore(state => state.warningLog);
  const disqualifyExam = useExamStore(state => state.disqualifyExam);

  useEffect(() => {
    disqualifyExam();
    // In a real app, we'd trigger the webhook here
    const sessionId = useExamStore.getState().sessionId;
    const adminWebhook = import.meta.env.VITE_API_BASE_URL + '/webhooks/disqualification';
    console.log(`Sending disqualification report to ${adminWebhook} for session ${sessionId}`);
  }, [disqualifyExam]);

  const descriptions = {
    'GAZE_DEVIATION': 'Gaze left the screen for more than 3 seconds',
    'FACE_ABSENT': 'No face detected in camera frame for more than 3 seconds',
    'MULTIPLE_FACES': 'Multiple faces detected in camera frame',
    'HEAD_POSE_VIOLATION': 'Head position violated boundaries for more than 3 seconds',
    'BACKGROUND_AUDIO': 'Speech or noise detected above threshold',
    'WINDOW_BLUR': 'Window focus was lost',
    'PASTE_DETECTED': 'Pasting text into answer field',
    'FULLSCREEN_EXIT': 'Exited fullscreen mode',
    'FULLSCREEN_EXIT_TIMEOUT': 'Remained out of fullscreen mode for more than 5 seconds'
  };

  const handleExit = () => {
    onExit();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'rgba(224, 112, 112, 0.06)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: '48px',
        boxShadow: 'var(--shadow-card)',
        borderTop: '4px solid var(--danger)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '24px'
      }} className="animate-slide-up">
        
        <AlertTriangle size={48} color="var(--danger)" strokeWidth={1.5} />
        
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--danger)', marginBottom: '12px' }}>Exam Terminated</h1>
          <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, fontWeight: 400 }}>
            Your exam session has been automatically terminated due to high suspicion of proctoring policy violations. The administrator has been notified.
          </p>
        </div>

        <div style={{ width: '100%', textAlign: 'left', marginTop: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Violation Log</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {warningLog.filter(w => !['SHORTCUT_ATTEMPT', 'CLOSE_ATTEMPT'].includes(w.type)).map((w, idx) => (
              <div key={idx} style={{ padding: '12px 16px', border: '1px solid var(--danger-soft)', background: 'white', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{descriptions[w.type] || w.type}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(w.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={handleExit}
          style={{
            width: '100%',
            background: 'var(--text-primary)',
            color: 'white',
            fontWeight: 700,
            fontSize: '15px',
            height: '52px',
            borderRadius: 'var(--radius-btn)',
            marginTop: '24px'
          }}
        >
          Exit to Results
        </button>

      </div>
    </div>
  );
}
