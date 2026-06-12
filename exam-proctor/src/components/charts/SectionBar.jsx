import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function SectionBar({ mcqScore, textPending }) {
  const data = [
    { name: 'Multiple Choice', score: mcqScore, max: 5 },
    { name: 'Short Answer', score: textPending ? 0 : 5, max: 5, pending: textPending }
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'var(--surface)', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-card)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{data.name}</p>
          <p style={{ margin: 0 }}>{data.pending ? 'Pending Review' : `Score: ${data.score} / ${data.max}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Montserrat' }} />
        <YAxis domain={[0, 5]} hide />
        <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
        <Bar 
          dataKey="score" 
          radius={[4, 4, 0, 0]}
          shape={(props) => {
            const { x, y, width, height, payload } = props;
            if (payload.pending) {
              return (
                <g>
                  <rect x={x} y={y > 0 ? y : 150} width={width} height={height > 0 ? height : 50} fill="var(--text-disabled)" rx={4} ry={4} opacity={0.3} strokeDasharray="4 4" stroke="var(--text-secondary)" />
                  <text x={x + width/2} y={(y > 0 ? y : 150) + (height>0?height:50)/2} fill="var(--text-secondary)" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontFamily="Montserrat">Pending</text>
                </g>
              );
            }
            return <rect x={x} y={y} width={width} height={height} fill="var(--primary)" rx={4} ry={4} />;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
