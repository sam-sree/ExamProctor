import React, { useState, useEffect } from 'react';
import { useProctoringStore } from '../store/proctoringStore';
import { Cloud } from 'lucide-react';

export default function QuestionText({ question, answer, onChange, onNext }) {
  const [localText, setLocalText] = useState(answer || '');
  const fireWarning = useProctoringStore(state => state.fireWarning);
  
  useEffect(() => {
    setLocalText(answer || '');
  }, [question.id]);

  const handleChange = (e) => {
    const val = e.target.value;
    if (val.length <= question.maxChars) {
      setLocalText(val);
      onChange(val); // Auto-save behavior
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    fireWarning('PASTE_DETECTED');
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  const isNearLimit = localText.length >= question.maxChars * 0.9;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ position: 'relative' }}>
        <textarea
          value={localText}
          onChange={handleChange}
          onPaste={handlePaste}
          onContextMenu={handleContextMenu}
          placeholder="Type your answer here..."
          style={{
            width: '100%',
            minHeight: '160px',
            border: '1.5px solid var(--border)',
            borderRadius: '10px',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '15px',
            fontWeight: 300,
            padding: '16px',
            resize: 'vertical',
            outline: 'none',
            color: 'var(--text-primary)'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--primary)';
            e.target.style.boxShadow = '0 0 0 3px rgba(108,127,216,0.12)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border)';
            e.target.style.boxShadow = 'none';
          }}
        />
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <Cloud size={14} /> Auto-saved
          </div>
          <div style={{ 
            fontSize: '13px', 
            color: isNearLimit ? 'var(--danger)' : 'var(--text-secondary)'
          }}>
            {localText.length} / {question.maxChars}
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
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
