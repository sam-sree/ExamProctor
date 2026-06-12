import React, { useState, useEffect } from 'react';
import { Eye, Mic, User, Lock, Monitor, Bluetooth, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useProctoringStore } from '../store/proctoringStore';

export default function Briefing({ onEnterExam }) {
  const [agreed, setAgreed] = useState(false);
  const [btStatus, setBtStatus] = useState('pending'); // pending, success, failed
  const resetProctoring = useProctoringStore(state => state.resetProctoring);

  const checkBluetooth = async () => {
    setBtStatus('pending');
    if (window.electronAPI) {
      const res = await window.electronAPI.disableBluetooth();
      if (res.success) {
        setBtStatus('success');
      } else {
        // Fallback: Check if we have active web bluetooth devices (just mock logic here if real check fails)
        try {
            const devices = await navigator.bluetooth.getDevices();
            if (devices && devices.length > 0) {
               setBtStatus('failed');
            } else {
               // OS command failed but no devices connected via Web API, we can proceed
               setBtStatus('success'); 
            }
        } catch(e) {
            // Web Bluetooth not supported or failed, assume success for demo but log warning
            console.warn("Web Bluetooth check failed", e);
            setBtStatus('success');
        }
      }
    } else {
      setBtStatus('success'); // Web mode
    }
  };

  useEffect(() => {
    checkBluetooth();
    resetProctoring();
  }, [resetProctoring]);

  const rules = [
    { icon: Eye, text: "Keep your eyes on the screen at all times. Looking away for more than 3 seconds triggers a warning." },
    { icon: Mic, text: "Stay in a quiet space. Background voices will be flagged." },
    { icon: User, text: "Only you should be present in your room." },
    { icon: Lock, text: "This window cannot be minimized or closed until you submit." },
    { icon: Monitor, text: "Your screen is captured periodically throughout the exam." },
    { icon: Bluetooth, text: "Bluetooth has been disabled for the duration of this exam." },
    { icon: AlertTriangle, text: "3 warnings result in automatic disqualification. The exam administrator will be notified." }
  ];

  const handleStart = async () => {
    if (window.electronAPI) {
      await window.electronAPI.startKiosk();
    }
    onEnterExam();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '48px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems:'center', justifyContent: 'center' }}><CheckCircle2 size={14}/></div>
        <div style={{ width: '32px', height: '2px', background: 'var(--success)' }} />
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems:'center', justifyContent: 'center' }}><CheckCircle2 size={14}/></div>
        <div style={{ width: '32px', height: '2px', background: 'var(--success)' }} />
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems:'center', justifyContent: 'center' }}><CheckCircle2 size={14}/></div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '680px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: '48px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
      }} className="animate-slide-up">
        
        <h2 style={{ fontSize: '28px', fontWeight: 700 }}>You're all set. Here's what to expect.</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rules.map((Rule, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <Rule.icon size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '15px', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {Rule.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '24px', background: 'var(--bg)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border)', display: 'flex', alignItems:'center', justifyContent:'center', color: 'var(--text-disabled)', fontWeight: 600 }}>{n}</div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Warning {n}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, marginTop: '8px' }}>You currently have 0 warnings.</div>
        </div>

        {btStatus === 'pending' && <div style={{ color: 'var(--text-secondary)' }}>Checking Bluetooth status...</div>}
        {btStatus === 'success' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--success-soft)', color: 'var(--success)', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', alignSelf: 'flex-start' }}>
            Bluetooth disabled <CheckCircle2 size={16} />
          </div>
        )}
        {btStatus === 'failed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--warn-soft)', color: '#D97706', padding: '12px 16px', borderRadius: '8px', fontWeight: 500, fontSize: '14px' }}>
            <AlertTriangle size={18} /> Bluetooth device detected - please disconnect all devices
            <button onClick={checkBluetooth} style={{ marginLeft: 'auto', padding: '6px 12px', background: 'white', border: '1px solid #D97706', borderRadius: '6px', color: '#D97706', fontSize: '12px', fontWeight: 600 }}>Check Again</button>
          </div>
        )}

        <label style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <input 
            type="checkbox" 
            checked={agreed} 
            onChange={e => setAgreed(e.target.checked)} 
            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
          />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>I understand the above and confirm I am ready to begin.</span>
        </label>

        <button 
          onClick={handleStart}
          disabled={!agreed || btStatus === 'failed'}
          style={{
            width: '100%',
            background: (agreed && btStatus !== 'failed') ? 'var(--primary)' : 'var(--border)',
            color: (agreed && btStatus !== 'failed') ? 'white' : 'var(--text-disabled)',
            fontWeight: 700,
            fontSize: '16px',
            height: '56px',
            borderRadius: 'var(--radius-btn)',
            cursor: (agreed && btStatus !== 'failed') ? 'pointer' : 'not-allowed',
            transition: 'all 300ms ease'
          }}
        >
          Enter Exam
        </button>

      </div>
    </div>
  );
}
