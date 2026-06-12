import React from 'react';

export default function QuestionMCQ({ question, selectedAnswer, onSelect, onNext }) {
  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px' 
      }}>
        {question.options.map((option, idx) => {
          const isSelected = selectedAnswer === idx;
          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 20px',
                border: isSelected ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                borderRadius: '10px',
                background: isSelected ? 'var(--primary)' : 'transparent',
                color: isSelected ? 'white' : 'var(--text-primary)',
                textAlign: 'left',
                fontSize: '15px',
                fontWeight: 400
              }}
              onMouseOver={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'var(--primary-soft)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }
              }}
              onMouseOut={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }
              }}
            >
              <div style={{
                background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--primary-soft)',
                color: isSelected ? 'white' : 'var(--primary)',
                padding: '4px 8px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px'
              }}>
                {letters[idx]}
              </div>
              {option}
            </button>
          );
        })}
      </div>
      
      <button
        onClick={onNext}
        disabled={selectedAnswer === null}
        style={{
          width: '100%',
          padding: '16px',
          background: 'var(--primary)',
          color: 'white',
          fontWeight: 600,
          borderRadius: '10px',
          fontSize: '15px'
        }}
      >
        Next Question
      </button>
    </div>
  );
}
