import React, { useState, useEffect } from 'react';
import { useExamStore } from '../store/examStore';
import { useProctoringStore } from '../store/proctoringStore';
import { useCVEvents } from '../hooks/useCVEvents';
import TimerBar from '../components/TimerBar';
import WarningDots from '../components/WarningDots';
import QuestionMCQ from '../components/QuestionMCQ';
import QuestionText from '../components/QuestionText';
import { QUESTIONS } from '../App'; // We will put QUESTIONS in App.jsx or a separate file
import { AlertCircle } from 'lucide-react';

export default function Exam({ onDisqualified, onFinished }) {
  // Connect to CV events socket to run face/gaze/audio tracking during the exam
  useCVEvents('ws://localhost:8765');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  
  const question = QUESTIONS[currentIndex];
  
  const setAnswer = useExamStore(state => state.setAnswer);
  const answers = useExamStore(state => state.answers);
  const startExam = useExamStore(state => state.startExam);
  const submitExam = useExamStore(state => state.submitExam);
  const warningCount = useProctoringStore(state => state.warningCount);
  const disqualified = useProctoringStore(state => state.disqualified);

  useEffect(() => {
    startExam();
  }, [startExam]);

  useEffect(() => {
    // If we've answered this before (e.g. going back, though not supported here), load it
    const existing = answers.find(a => a.questionId === question.id);
    setCurrentAnswer(existing ? existing.answer : (question.type === 'text' ? '' : null));
    setTimeSpent(0);
  }, [currentIndex, question.id, answers]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [currentIndex]);

  useEffect(() => {
    if (disqualified) {
      onDisqualified();
    }
  }, [disqualified, onDisqualified]);

  const handleNext = () => {
    setAnswer(question.id, question.type, currentAnswer, timeSpent);
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowSubmitConfirm(true);
    }
  };

  const handleTimeUp = () => {
    // Auto-advance
    handleNext();
  };

  const handleSubmit = async () => {
    submitExam();
    if (window.electronAPI) {
      await window.electronAPI.endKiosk();
      await window.electronAPI.enableBluetooth();
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
           <TimerBar initialSeconds={question.timeLimit} onTimeUp={handleTimeUp} key={currentIndex} />
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
