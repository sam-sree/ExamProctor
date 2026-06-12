import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Dot } from 'recharts';

export default function TimePerQuestion({ answers }) {
  const data = answers.map((a, i) => ({
    name: `Q${i + 1}`,
    time: a.timeSpent,
    limit: a.type === 'mcq' ? 60 : 90
  }));

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const isOverLimit = payload.time > payload.limit;
    return (
      <circle cx={cx} cy={cy} r={4} fill={isOverLimit ? 'var(--danger)' : 'var(--primary)'} stroke="white" strokeWidth={2} />
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'var(--surface)', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-card)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{data.name}</p>
          <p style={{ margin: 0 }}>Time: {data.time}s / {data.limit}s</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Montserrat' }} />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={60} stroke="var(--text-disabled)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'MCQ Limit', fill: 'var(--text-secondary)', fontSize: 10 }} />
        <ReferenceLine y={90} stroke="var(--text-disabled)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Text Limit', fill: 'var(--text-secondary)', fontSize: 10 }} />
        <Line type="monotone" dataKey="time" stroke="var(--primary)" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
