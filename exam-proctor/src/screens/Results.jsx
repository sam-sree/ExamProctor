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
            Alex Chen · Software Engineering Principles · {new Date().toLocaleDateString()}
          </div>
        </div>

        {warningCount > 0 && (
          <div style={{ background: status === 'disqualified' ? 'var(--danger-soft)' : 'var(--warn-soft)', color: status === 'disqualified' ? 'var(--danger)' : '#D97706', padding: '16px 24px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', fontWeight: 500 }}>
            <AlertTriangle size={20} />
            This session included {warningCount} flagged events. Results are subject to administrator review.
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
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
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px' }}>Warnings</div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: warningCount === 0 ? 'var(--success)' : warningCount >= 3 ? 'var(--danger)' : 'var(--warn)' }}>
              {warningCount} <span style={{ fontSize: '20px', color: 'var(--text-disabled)' }}>/ 3</span>
            </div>
          </div>
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
