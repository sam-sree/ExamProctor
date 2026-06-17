import React, { useEffect, useState } from 'react';
import { useExamStore } from '../store/examStore';
import { useProctoringStore } from '../store/proctoringStore';
import SectionBar from '../components/charts/SectionBar';
import TimePerQuestion from '../components/charts/TimePerQuestion';
import AccuracyDonut from '../components/charts/AccuracyDonut';
import { QUESTIONS } from '../App';
import { AlertTriangle, Download, LogOut, Check, X, Circle } from 'lucide-react';

export default function Results() {
  const localSessionId = useExamStore(state => state.sessionId);
  const localAnswers = useExamStore(state => state.answers);
  const localStatus = useExamStore(state => state.status);
  const candidateName = useExamStore(state => state.candidateName);
  const localWarningLog = useProctoringStore(state => state.warningLog);
  const localWarningCount = useProctoringStore(state => state.warningCount);

  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await fetch(`${apiBase}/api/session/${localSessionId}/result`);
        if (res.ok) {
          const data = await res.json();
          setServerData(data);
        }
      } catch (err) {
        console.error("Error fetching session result:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [localSessionId]);

  // Derive display values from server if available, otherwise fallback to local Zustand store
  const answers = serverData?.answers || localAnswers;
  const status = serverData?.status || localStatus;
  const warningLog = serverData?.warningLog || localWarningLog;
  const warningCount = serverData?.warningLog ? serverData.warningLog.length : localWarningCount;
  const proctorOverride = serverData?.proctorOverride || null;

  // Default fallback calculation in React if serverData is not yet fetched or offline
  const getFallbackTrustworthiness = () => {
    if (status === 'disqualified') return null;
    
    const priorCheat = 0.05;
    const priorHonest = 0.95;
    const params = {
      "GAZE_DEVIATION":        {cheat: 0.60, honest: 0.15},
      "FACE_ABSENT":           {cheat: 0.50, honest: 0.05},
      "MULTIPLE_FACES":        {cheat: 0.80, honest: 0.01},
      "HEAD_POSE_VIOLATION":   {cheat: 0.50, honest: 0.10},
      "BACKGROUND_AUDIO":      {cheat: 0.40, honest: 0.12},
      "WINDOW_BLUR":           {cheat: 0.70, honest: 0.08},
      "PASTE_DETECTED":        {cheat: 0.90, honest: 0.01},
      "SHORTCUT_ATTEMPT":      {cheat: 0.75, honest: 0.05},
      "FULLSCREEN_EXIT":       {cheat: 0.85, honest: 0.02},
      "BLUETOOTH_CONNECTED":   {cheat: 0.95, honest: 0.01}
    };
    
    const counts = {};
    Object.keys(params).forEach(k => counts[k] = 0);
    
    warningLog.forEach(w => {
      if (counts[w.type] !== undefined) counts[w.type]++;
    });
    
    // Shortcuts
    const localShortcuts = useProctoringStore.getState().shortcutAttemptLog;
    counts["SHORTCUT_ATTEMPT"] = localShortcuts.length;
    
    if (useProctoringStore.getState().bluetoothDeviceDetected) {
      counts["BLUETOOTH_CONNECTED"] = Math.max(counts["BLUETOOTH_CONNECTED"], 1);
    }
    
    let odds = priorCheat / priorHonest;
    Object.keys(counts).forEach(k => {
      const count = Math.min(counts[k], 3);
      if (count > 0) {
        odds *= (params[k].cheat / params[k].honest) ** count;
      }
    });
    
    const pCheating = odds / (1.0 + odds);
    return Math.round((1.0 - pCheating) * 1000) / 10;
  };

  const trustworthinessVal = serverData?.score?.trustworthiness !== undefined 
    ? serverData.score.trustworthiness 
    : getFallbackTrustworthiness();

  const getClassification = (score) => {
    if (status === 'disqualified') return 'disqualified';
    if (score === null || score === undefined) return 'unknown';
    const pCheating = 1.0 - (score / 100.0);
    if (pCheating <= 0.50) return 'approved';
    if (pCheating <= 0.85) return 'review_required';
    return 'flagged';
  };
  
  const classification = serverData?.status || getClassification(trustworthinessVal);

  // MCQ scoring
  const mcqQuestions = QUESTIONS.filter(q => q.type === 'mcq');
  let correct = 0, incorrect = 0, skipped = 0;
  
  if (serverData?.score?.mcq !== undefined) {
    correct = serverData.score.mcq;
    // Calculate others
    mcqQuestions.forEach(q => {
      const ans = answers.find(a => a.questionId === q.id);
      if (!ans || ans.skipped) {
        skipped++;
      } else if (ans.answer !== q.correct) {
        incorrect++;
      }
    });
  } else {
    // Local calculation fallback
    mcqQuestions.forEach(q => {
      const ans = answers.find(a => a.questionId === q.id);
      if (!ans || ans.skipped) {
        skipped++;
      } else if (ans.answer === q.correct) {
        correct++;
      } else {
        incorrect++;
      }
    });
  }

  const totalTimeSpent = answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0);

  const handleDownload = () => {
    const report = {
      session: serverData || {
        sessionId: localSessionId,
        candidateId: useExamStore.getState().candidateId,
        testId: useExamStore.getState().testId,
        startTime: useExamStore.getState().startTime,
        endTime: useExamStore.getState().endTime,
        status: localStatus,
        answers: localAnswers,
        webcamSnapshotLog: useExamStore.getState().webcamSnapshotLog
      },
      proctoring: {
        warningCount: localWarningCount,
        warningLog: localWarningLog,
        shortcutAttemptLog: useProctoringStore.getState().shortcutAttemptLog,
        logOnlyEvents: useProctoringStore.getState().logOnlyEvents,
        multiMonitorSuspected: useProctoringStore.getState().multiMonitorSuspected,
        bluetoothDeviceDetected: useProctoringStore.getState().bluetoothDeviceDetected,
        detectedBluetoothDevices: useProctoringStore.getState().detectedBluetoothDevices,
        disqualified: useProctoringStore.getState().disqualified
      }
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-report-${localSessionId}-${new Date().getTime()}.json`;
    a.click();
  };

  const handleExit = () => {
    // Navigate away or close window
    window.location.reload(); // Restarts the demo/assessment flow safely in browser
  };

  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }} className="animate-slide-up">
        
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: status === 'disqualified' ? 'var(--danger)' : 'var(--text-primary)', marginBottom: '8px' }}>
            {status === 'disqualified' ? 'Session Disqualified' : 'Exam Complete'}
          </h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            {candidateName} · Software Engineering Principles · {new Date().toLocaleDateString()}
          </div>
        </div>

        {status === 'disqualified' && (
          <div style={{ 
            background: 'var(--danger-soft)', 
            border: '2.5px solid var(--danger)', 
            color: 'var(--danger)', 
            padding: '24px', 
            borderRadius: '16px', 
            textAlign: 'center', 
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center'
          }} className="animate-slide-up">
            <AlertTriangle size={40} color="var(--danger)" />
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>Session Disqualified</h3>
              <p style={{ fontSize: '14px', opacity: 0.9, lineHeight: 1.5, maxWidth: '600px' }}>
                This exam session was automatically terminated due to critical proctoring policy violations (disqualification threshold of 85% cheat probability exceeded). The final score has been locked and flagged for review.
              </p>
              {proctorOverride && (
                <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  (Manually overridden by Administrator to: <strong>{proctorOverride.toUpperCase()}</strong>)
                </div>
              )}
            </div>
          </div>
        )}

        {status !== 'disqualified' && warningCount > 0 && (
          <div style={{ background: 'var(--warn-soft)', color: '#D97706', padding: '16px 24px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', fontWeight: 500 }}>
            <AlertTriangle size={20} />
            This session included {warningCount} flagged events. Results are subject to administrator review.
          </div>
        )}

        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: status === 'disqualified' ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', 
          gap: '24px' 
        }}>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px' }}>MCQ Score</div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--primary)' }}>{correct} <span style={{ fontSize: '20px', color: 'var(--text-disabled)' }}>/ 5</span></div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px' }}>Time Taken</div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {Math.floor(totalTimeSpent / 60)}<span style={{ fontSize: '16px' }}>m</span> {totalTimeSpent % 60}<span style={{ fontSize: '16px' }}>s</span>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px' }}>Warnings Logged</div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: warningCount === 0 ? 'var(--success)' : status === 'disqualified' ? 'var(--danger)' : 'var(--warn)' }}>
              {warningCount}
            </div>
          </div>
          
          {status !== 'disqualified' && (
            <div style={{ 
              background: 'var(--surface)', 
              padding: '24px', 
              borderRadius: 'var(--radius-card)', 
              boxShadow: 'var(--shadow-card)', 
              textAlign: 'center',
              border: `1.5px solid ${
                classification === 'approved' ? 'var(--success)' : 
                classification === 'review_required' ? 'var(--warn)' : 'var(--danger)'
              }`,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px' }}>Trustworthiness</div>
              <div style={{ 
                fontSize: '36px', 
                fontWeight: 800, 
                color: 
                  classification === 'approved' ? 'var(--success)' : 
                  classification === 'review_required' ? 'var(--warn)' : 'var(--danger)'
              }}>
                {trustworthinessVal !== null ? `${trustworthinessVal}%` : 'N/A'}
              </div>
              <div style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                marginTop: '4px',
                color: 
                  classification === 'approved' ? 'var(--success)' : 
                  classification === 'review_required' ? 'var(--warn)' : 'var(--danger)'
              }}>
                {classification === 'approved' ? 'Approved' : 
                 classification === 'review_required' ? 'Review Required' : 'Flagged'}
              </div>
              {proctorOverride && (
                <div style={{ fontSize: '10px', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  (Override: {proctorOverride.toUpperCase()})
                </div>
              )}
            </div>
          )}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
             <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', textAlign: 'center' }}>Section Performance</h3>
             <SectionBar mcqScore={correct} textPending={true} />
          </div>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
             <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', textAlign: 'center' }}>Time per Question</h3>
             <TimePerQuestion answers={answers.length ? answers : Array(10).fill({timeSpent:0})} />
          </div>
          <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
             <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px', textAlign: 'center' }}>Answer Accuracy</h3>
             <AccuracyDonut correct={correct} incorrect={incorrect} skipped={skipped} />
          </div>
        </div>

        {/* Review List */}
        <div style={{ background: 'var(--surface)', padding: '32px', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>Question Review</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             {mcqQuestions.map((q, i) => {
                const ans = answers.find(a => a.questionId === q.id);
                const isCorrect = ans && !ans.skipped && ans.answer === q.correct;
                const isSkipped = !ans || ans.skipped;
                return (
                  <details key={q.id} style={{ background: 'var(--bg)', borderRadius: '10px', overflow: 'hidden' }}>
                     <summary style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontWeight: 600, userSelect: 'none' }}>
                       {isCorrect ? <Check size={18} color="var(--success)" /> : isSkipped ? <Circle size={18} color="var(--text-disabled)" /> : <X size={18} color="var(--danger)" />}
                       <span>Q{i + 1} · {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}</span>
                     </summary>
                     <div style={{ padding: '0 16px 16px 46px', color: 'var(--text-secondary)' }}>
                       <p style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>{q.text}</p>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                         {q.options.map((opt, oIdx) => (
                           <div key={oIdx} style={{ 
                             padding: '8px 12px', 
                             borderRadius: '6px', 
                             background: oIdx === q.correct ? 'var(--success-soft)' : (ans && ans.answer === oIdx && !isCorrect) ? 'var(--danger-soft)' : 'transparent',
                             color: oIdx === q.correct ? 'var(--success)' : (ans && ans.answer === oIdx && !isCorrect) ? 'var(--danger)' : 'inherit',
                             fontWeight: oIdx === q.correct ? 600 : 400
                           }}>
                             {['A','B','C','D'][oIdx]}. {opt}
                           </div>
                         ))}
                       </div>
                     </div>
                  </details>
                );
             })}
          </div>
        </div>

        {/* Action Footer */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', paddingBottom: '48px' }}>
           <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 24px', border: '1.5px solid var(--primary)', color: 'var(--primary)', borderRadius: 'var(--radius-btn)', fontWeight: 600 }}>
             <Download size={18} /> Download Report
           </button>
           <button onClick={handleExit} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 24px', background: 'var(--text-primary)', color: 'white', borderRadius: 'var(--radius-btn)', fontWeight: 600 }}>
             Exit Application <LogOut size={18} />
           </button>
        </div>

      </div>
    </div>
  );
}
