import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AccuracyDonut({ correct, incorrect, skipped }) {
  const data = [
    { name: 'Correct', value: correct, color: 'var(--success)' },
    { name: 'Incorrect', value: incorrect, color: 'var(--danger)' },
    { name: 'Skipped', value: skipped, color: 'var(--text-disabled)' }
  ].filter(d => d.value > 0);

  const total = correct + incorrect + skipped;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'var(--surface)', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-card)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{data.name}</p>
          <p style={{ margin: 0 }}>{data.value} questions</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ position: 'relative', height: '200px', width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontFamily: 'Montserrat', fontSize: '13px' }} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute',
        top: '45%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        fontFamily: 'Montserrat'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
          {correct}/{total}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Score
        </div>
      </div>
    </div>
  );
}
