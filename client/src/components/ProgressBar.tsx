interface ProgressBarProps {
  completed: number
  total: number
}

export default function ProgressBar({ completed, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  return (
    <div style={{ margin: '12px 0' }}>
      <div
        style={{
          width: '100%',
          height: 18,
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 9,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#10b981',
            transition: 'width 0.3s ease'
          }}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
        {completed} / {total} tasks ({pct}%)
      </div>
    </div>
  )
}
