import React, { useState, useEffect, useRef } from 'react';
import { useExamStore } from '../store/examStore';
import { useProctoringStore } from '../store/proctoringStore';
import { useCVEvents } from '../hooks/useCVEvents';
import { useAudioMonitor } from '../hooks/useAudioMonitor';
import TimerBar from '../components/TimerBar';
import WarningDots from '../components/WarningDots';
import QuestionMCQ from '../components/QuestionMCQ';
import QuestionText from '../components/QuestionText';
import FullscreenBlocker from '../components/FullscreenBlocker';
import { QUESTIONS } from '../App';
import { AlertCircle } from 'lucide-react';

export default function Exam({ onDisqualified, onFinished }) {
  const sessionId = useExamStore(state => state.sessionId);
  
  // 1. Connect to CV WebSocket client (active = true during exam)
  useCVEvents(true);

  // 2. Start Web Audio monitor
  const { startMonitor: startAudioMonitor, stopMonitor: stopAudioMonitor } = useAudioMonitor();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isScreenShareEnded, setIsScreenShareEnded] = useState(false);

  const screenShareTimerRef = useRef(null);

  const question = QUESTIONS[currentIndex];
  
  const setAnswer = useExamStore(state => state.setAnswer);
  const answers = useExamStore(state => state.answers);
  const startExam = useExamStore(state => state.startExam);
  const submitExam = useExamStore(state => state.submitExam);
  const warningCount = useProctoringStore(state => state.warningCount);
  const disqualified = useProctoringStore(state => state.disqualified);
  
  // Read pause reasons
  const isConnectionLost = useProctoringStore(state => state.isConnectionLost);
  const isFullscreenExited = useProctoringStore(state => state.isFullscreenExited);
  const isPaused = isConnectionLost || isFullscreenExited || isScreenShareEnded;

  useEffect(() => {
    startExam();
    startAudioMonitor();
    return () => stopAudioMonitor();
  }, [startExam]);

  // Load existing answers on slide change
  useEffect(() => {
    const existing = answers.find(a => a.questionId === question.id);
    setCurrentAnswer(existing ? existing.answer : (question.type === 'text' ? '' : null));
    setTimeSpent(0);
  }, [currentIndex, question.id, answers]);

  // Handle Question Timer spent seconds (increment only when not paused)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPaused) {
        setTimeSpent(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentIndex, isPaused]);

  // Disqualification triggers
  useEffect(() => {
    if (disqualified) {
      const sendDisqualify = async () => {
        try {
          const payload = {
            warningLog: useProctoringStore.getState().warningLog,
            webcamSnapshotLog: useExamStore.getState().webcamSnapshotLog,
            shortcutAttemptLog: useProctoringStore.getState().shortcutAttemptLog,
            multiMonitorSuspected: useProctoringStore.getState().multiMonitorSuspected,
            bluetoothDeviceDetected: useProctoringStore.getState().bluetoothDeviceDetected
          };
          const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
          await fetch(`${apiBase}/api/session/${sessionId}/disqualify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (e) {
          console.error("Disqualify submit failed", e);
        }
      };
      sendDisqualify();
      onDisqualified();
    }
  }, [disqualified, onDisqualified, sessionId]);

  // 3. Monitor Screen Sharing stream and browser environment
  useEffect(() => {
    // A. Multi-Monitor Heuristic
    const screenLeft = window.screenLeft ?? window.screenX;
    const isMultiMonitorSuspected = (
      window.screen.width > 3000 ||
      screenLeft < 0 ||
      screenLeft > window.screen.width
    );
    useProctoringStore.setState({ multiMonitorSuspected: isMultiMonitorSuspected });

    // B. Screen Share Stream Track Health
    const screenStream = window.screenShareStream;
    let videoTrack = null;
    
    const handleScreenShareEnded = () => {
      useProctoringStore.getState().fireWarning('SCREENSHARE_ENDED');
      setIsScreenShareEnded(true);

      // Start 15s automatic submission countdown
      screenShareTimerRef.current = setTimeout(() => {
        handleSubmit();
      }, 15000);
    };

    if (screenStream) {
      videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', handleScreenShareEnded);
      }
    }

    // C. Browser Event Monitors
    // Tab switching / visibility
    const handleVisibilityChange = () => {
      if (document.hidden) {
        useProctoringStore.getState().fireWarning('TAB_SWITCH');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Window focus / blur
    let blurTimer = null;
    const handleBlur = () => {
      blurTimer = setTimeout(() => {
        if (document.hidden) return; // already counted by tab switch
        useProctoringStore.getState().fireWarning('WINDOW_BLUR');
      }, 2000);
    };
    const handleFocus = () => {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // Right-click / context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // Copy / Cut / Paste
    const handlePaste = (e) => {
      e.preventDefault();
      useProctoringStore.getState().fireWarning('PASTE_DETECTED');
    };
    const handleCopy = (e) => e.preventDefault();
    const handleCut = (e) => e.preventDefault();
    document.addEventListener('paste', handlePaste);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);

    // Keyboard Shortcuts Interceptor
    const handleKeyDown = (e) => {
      let isIntercepted = false;
      let shortcutName = '';

      if (e.key === 'F11') {
        isIntercepted = true;
        shortcutName = 'F11';
      } else if (e.key === 'F12') {
        isIntercepted = true;
        shortcutName = 'F12';
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.code === 'KeyI')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+Shift+I';
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.code === 'KeyJ')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+Shift+J';
      } else if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.code === 'KeyU')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+U';
      } else if (e.ctrlKey && (e.key === 'W' || e.key === 'w' || e.code === 'KeyW')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+W';
      } else if (e.ctrlKey && (e.key === 'T' || e.key === 't' || e.code === 'KeyT')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+T';
      } else if (e.ctrlKey && (e.key === 'N' || e.key === 'n' || e.code === 'KeyN')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+N';
      } else if (e.ctrlKey && (e.key === 'C' || e.key === 'c' || e.code === 'KeyC')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+C';
      } else if (e.ctrlKey && (e.key === 'V' || e.key === 'v' || e.code === 'KeyV')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+V';
      } else if (e.ctrlKey && (e.key === 'X' || e.key === 'x' || e.code === 'KeyX')) {
        isIntercepted = true;
        shortcutName = 'Ctrl+X';
      } else if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        isIntercepted = true;
        shortcutName = 'PrintScreen';
      }

      if (isIntercepted) {
        e.preventDefault();
        e.stopPropagation();
        useProctoringStore.getState().logEvent('SHORTCUT_ATTEMPT', { shortcut: shortcutName });
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // DevTools Dimension-based heuristic
    const devToolsThreshold = 160;
    const devToolsInterval = setInterval(() => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > devToolsThreshold || heightDiff > devToolsThreshold) {
        useProctoringStore.getState().logEvent('DEVTOOLS_SUSPECTED');
      }
    }, 1000);

    // Close prevention / Page Unload
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      useProctoringStore.getState().logEvent('CLOSE_ATTEMPT');
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup all event listeners on unmount
      if (videoTrack) {
        videoTrack.removeEventListener('ended', handleScreenShareEnded);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(devToolsInterval);
      if (blurTimer) clearTimeout(blurTimer);
      if (screenShareTimerRef.current) clearTimeout(screenShareTimerRef.current);
    };
  }, []);

  const resumeScreenShare = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      window.screenShareStream = mediaStream;
      setIsScreenShareEnded(false);
      
      if (screenShareTimerRef.current) {
        clearTimeout(screenShareTimerRef.current);
        screenShareTimerRef.current = null;
      }

      // Add listener to new track
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          useProctoringStore.getState().fireWarning('SCREENSHARE_ENDED');
          setIsScreenShareEnded(true);
          screenShareTimerRef.current = setTimeout(() => {
            handleSubmit();
          }, 15000);
        });
      }
    } catch (err) {
      console.error("Failed to resume screenshare", err);
    }
  };

  const handleNext = () => {
    setAnswer(question.id, question.type, currentAnswer, timeSpent);
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowSubmitConfirm(true);
    }
  };

  const handleTimeUp = () => {
    handleNext();
  };

  const handleSubmit = async () => {
    submitExam();
    
    // Package exam session payload
    const sessionData = {
      sessionId,
      candidateId: useExamStore.getState().candidateId,
      testId: useExamStore.getState().testId,
      startTime: useExamStore.getState().startTime,
      endTime: new Date().toISOString(),
      status: 'submitted',
      answers: useExamStore.getState().answers,
      webcamSnapshotLog: useExamStore.getState().webcamSnapshotLog,
      warningLog: useProctoringStore.getState().warningLog,
      logOnlyEvents: useProctoringStore.getState().logOnlyEvents,
      shortcutAttemptLog: useProctoringStore.getState().shortcutAttemptLog,
      multiMonitorSuspected: useProctoringStore.getState().multiMonitorSuspected,
      bluetoothDeviceDetected: useProctoringStore.getState().bluetoothDeviceDetected,
      detectedBluetoothDevices: useProctoringStore.getState().detectedBluetoothDevices,
      disqualified: useProctoringStore.getState().disqualified
    };

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      await fetch(`${apiBase}/api/session/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });
    } catch (e) {
      console.error("Submit session to server failed", e);
    }

    onFinished();
  };

  if (showSubmitConfirm) {
    const answeredCount = answers.filter(a => !a.skipped).length;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(240,244,255,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'var(--surface)', padding: '48px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', textAlign: 'center', maxWidth: '400px' }} className="animate-slide-up">
          <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>Submit your exam?</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Once submitted, you cannot return to your answers.</p>
          <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '8px', marginBottom: '32px', fontWeight: 600 }}>
            Answered: {answeredCount}/{QUESTIONS.length} questions
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => setShowSubmitConfirm(false)} style={{ flex: 1, padding: '14px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-btn)', color: 'var(--text-secondary)', fontWeight: 600 }}>Go Back</button>
            <button onClick={handleSubmit} style={{ flex: 1, padding: '14px', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-btn)', fontWeight: 600 }}>Submit</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Global blockers */}
      <FullscreenBlocker />
      
      {isConnectionLost && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(240, 244, 255, 0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--surface)', padding: '48px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', textAlign: 'center', maxWidth: '450px' }} className="animate-slide-up">
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Connection Lost</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>Connection to proctoring service lost. Attempting to reconnect...</p>
            <div className="animate-pulse-once" style={{ color: 'var(--primary)', fontWeight: 600 }}>Trying to reconnect...</div>
          </div>
        </div>
      )}

      {isScreenShareEnded && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(240, 244, 255, 0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--surface)', padding: '48px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', textAlign: 'center', maxWidth: '450px' }} className="animate-slide-up">
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', color: 'var(--danger)' }}>Screen Share Stopped</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>Screen share has stopped. Resume sharing to continue your exam. Unresolved screenshares will submit the test in 15 seconds.</p>
            <button onClick={resumeScreenShare} style={{ padding: '14px 28px', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-btn)', fontWeight: 700 }}>
              Resume Sharing
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div style={{
        height: '64px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 2px 12px rgba(108,127,216,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>Software Engineering Principles</span>
          <span style={{ color: 'var(--text-disabled)' }}>·</span>
          <span style={{ fontWeight: 300, fontSize: '12px', color: 'var(--text-secondary)' }}>Alex Chen</span>
        </div>

        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
           <TimerBar initialSeconds={question.timeLimit} onTimeUp={handleTimeUp} isPaused={isPaused} key={currentIndex} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500 }}>Q {currentIndex + 1} of {QUESTIONS.length}</span>
            <WarningDots count={warningCount} />
          </div>
          <button 
            onClick={() => setShowSubmitConfirm(true)}
            style={{ padding: '8px 16px', border: '1.5px solid var(--danger)', color: 'var(--danger)', borderRadius: 'var(--radius-btn)', fontWeight: 600, fontSize: '13px' }}
          >
            Submit Test
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '3px', background: 'var(--border)' }}>
        <div style={{ width: `${((currentIndex) / QUESTIONS.length) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 300ms ease' }} />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '40px 24px', overflowY: 'auto' }}>
        <div style={{
          maxWidth: '720px',
          margin: '0 auto',
          background: 'var(--surface)',
          padding: '48px',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)'
        }} className="animate-slide-up" key={`card-${currentIndex}`}>
          
          <div style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            marginBottom: '16px'
          }}>
            Question {currentIndex + 1} · {question.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1.5, marginBottom: '32px' }}>
            {question.text}
          </h2>

          {question.type === 'mcq' ? (
            <QuestionMCQ 
              question={question} 
              selectedAnswer={currentAnswer} 
              onSelect={setCurrentAnswer} 
              onNext={handleNext} 
            />
          ) : (
            <QuestionText 
              question={question} 
              answer={currentAnswer} 
              onChange={setCurrentAnswer} 
              onNext={handleNext} 
            />
          )}

        </div>
      </div>
    </div>
  );
}
