import { useState, useEffect, useRef } from 'react';

export function useExamTimer(initialSeconds) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const timerRef = useRef(null);

  useEffect(() => {
    setTimeLeft(initialSeconds);
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [initialSeconds]);

  const formatted = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;
  const isWarning = timeLeft <= 15 && timeLeft > 5;
  const isDanger = timeLeft <= 5;
  const progressPercent = (timeLeft / initialSeconds) * 100;

  return { timeLeft, formatted, isWarning, isDanger, progressPercent };
}
