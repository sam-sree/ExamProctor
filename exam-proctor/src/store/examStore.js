import { create } from 'zustand';

export const useExamStore = create((set, get) => ({
  sessionId: crypto.randomUUID(),
  candidateId: 'test-user-123',
  candidateName: 'ABC XYZ',
  testId: 'exam-101',
  startTime: null,
  endTime: null,
  status: 'setup', // setup, active, submitted, disqualified
  answers: [],
  webcamSnapshotLog: [],
  
  startExam: () => set({ 
    status: 'active', 
    startTime: new Date().toISOString() 
  }),
  
  submitExam: () => set({ 
    status: 'submitted', 
    endTime: new Date().toISOString() 
  }),
  
  disqualifyExam: () => set({ 
    status: 'disqualified', 
    endTime: new Date().toISOString() 
  }),
  
  setAnswer: (questionId, type, answer, timeSpent) => set((state) => {
    const newAnswers = [...state.answers];
    const existingIndex = newAnswers.findIndex(a => a.questionId === questionId);
    
    const ansObj = {
      questionId,
      type,
      answer,
      timeSpent,
      isCorrect: null, // Scored later for MCQ
      skipped: answer === null || answer === ''
    };

    if (existingIndex >= 0) {
      newAnswers[existingIndex] = { ...newAnswers[existingIndex], ...ansObj, timeSpent: newAnswers[existingIndex].timeSpent + timeSpent };
    } else {
      newAnswers.push(ansObj);
    }
    
    return { answers: newAnswers };
  }),

  addWebcamSnapshot: (snapshot) => set((state) => ({
    webcamSnapshotLog: [...state.webcamSnapshotLog, snapshot]
  }))
}));
