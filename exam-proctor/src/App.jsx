import React, { useState } from 'react';
import Landing from './screens/Landing';
import MicSetup from './screens/MicSetup';
import CameraSetup from './screens/CameraSetup';
import Briefing from './screens/Briefing';
import Exam from './screens/Exam';
import Disqualified from './screens/Disqualified';
import Results from './screens/Results';
import WarningToast from './components/WarningToast';

export const QUESTIONS = [
  // MCQ - 60 seconds each
  { id: 1, type: 'mcq', timeLimit: 60, text: 'Which data structure operates on a Last In, First Out (LIFO) basis?', options: ['Queue', 'Stack', 'Linked List', 'Heap'], correct: 1 },
  { id: 2, type: 'mcq', timeLimit: 60, text: 'What does the HTTP status code 403 indicate?', options: ['Not Found', 'Server Error', 'Forbidden', 'Unauthorized'], correct: 2 },
  { id: 3, type: 'mcq', timeLimit: 60, text: 'Which sorting algorithm guarantees O(n log n) in the worst case?', options: ['Quick Sort', 'Bubble Sort', 'Merge Sort', 'Selection Sort'], correct: 2 },
  { id: 4, type: 'mcq', timeLimit: 60, text: 'In object-oriented programming, which principle restricts direct access to internal object state?', options: ['Inheritance', 'Polymorphism', 'Abstraction', 'Encapsulation'], correct: 3 },
  { id: 5, type: 'mcq', timeLimit: 60, text: 'Which OSI model layer is responsible for logical IP addressing and routing?', options: ['Transport', 'Network', 'Data Link', 'Session'], correct: 1 },
  // Short Answer - 90 seconds each
  { id: 6, type: 'text', timeLimit: 90, text: 'In 2-3 sentences, explain the difference between a process and a thread.', maxChars: 500 },
  { id: 7, type: 'text', timeLimit: 90, text: 'What is a REST API? Why is statelessness considered one of its core constraints?', maxChars: 500 },
  { id: 8, type: 'text', timeLimit: 90, text: 'Define a deadlock in the context of concurrent systems and briefly describe one prevention strategy.', maxChars: 500 },
  { id: 9, type: 'text', timeLimit: 90, text: 'What is the purpose of a foreign key in a relational database? Give an example.', maxChars: 500 },
  { id: 10, type: 'text', timeLimit: 90, text: 'What does Big O notation measure, and why is it more useful than measuring raw execution time?', maxChars: 500 }
];

function App() {
  const [screen, setScreen] = useState('landing');

  return (
    <>
      <WarningToast />
      
      {screen === 'landing' && <Landing onNext={() => setScreen('mic')} />}
      {screen === 'mic' && <MicSetup onNext={() => setScreen('camera')} />}
      {screen === 'camera' && <CameraSetup onNext={() => setScreen('briefing')} />}
      {screen === 'briefing' && <Briefing onEnterExam={() => setScreen('exam')} />}
      {screen === 'exam' && <Exam onDisqualified={() => setScreen('disqualified')} onFinished={() => setScreen('results')} />}
      {screen === 'disqualified' && <Disqualified onExit={() => setScreen('results')} />}
      {screen === 'results' && <Results />}
    </>
  );
}

export default App;
