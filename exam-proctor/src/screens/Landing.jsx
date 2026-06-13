import React from 'react';
import { useExamStore } from '../store/examStore';

export default function Landing({ onNext }) {
  const candidateName = useExamStore(state => state.candidateName);
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: '48px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }} className="animate-slide-up">
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            color: 'var(--primary)',
            fontWeight: 500,
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase'
          }}>
            Secure Examination Platform
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Software Engineering Principles
          </h1>
        </div>

        <div style={{ height: '1px', background: 'var(--border)', width: '100%' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Candidate</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{candidateName}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Questions</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>10 Total</div>
          </div>
          <div style={{ border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Duration</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>12 Mins</div>
          </div>
        </div>

        <p style={{ fontWeight: 300, fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          This is a proctored examination. Ensure you are in a quiet, well-lit environment with only you present in your room.
        </p>

        <button 
          onClick={onNext}
          style={{
            width: '100%',
            background: 'var(--primary)',
            color: 'white',
            fontWeight: 700,
            fontSize: '14px',
            height: '52px',
            borderRadius: 'var(--radius-btn)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-btn-hover)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Begin Setup
        </button>

      </div>
    </div>
  );
}
