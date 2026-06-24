import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import ProgressBar from '../components/ProgressBar'

type EvalStatus = 'queued' | 'started' | 'running' | 'completed' | 'failed' | 'connecting'

interface ProgressState {
  completed: number
  total: number
}

interface TaskLogEntry {
  taskId: string
  status: 'running' | 'completed'
  passed?: boolean
  executionTimeMs?: number
}

interface FinalScore {
  resolveRate: number
  totalTasks: number
  resolvedTasks: number
}

interface QueuedEvent {
  evaluationId: string
  agentId: string
  timestamp: string
}

interface StartedEvent {
  evaluationId: string
  timestamp: string
}

interface TaskStartedEvent {
  evaluationId: string
  taskId: string
  timestamp: string
}

interface TaskCompletedEvent {
  evaluationId: string
  taskId: string
  passed: boolean
  executionTimeMs: number
  timestamp: string
}

interface EvaluationCompletedEvent {
  evaluationId: string
  score: FinalScore
  timestamp: string
}

interface EvaluationFailedEvent {
  evaluationId: string
  error: string
  timestamp: string
}

export default function EvaluationPage() {
  const { id } = useParams<{ id: string }>()
  const [status, setStatus] = useState<EvalStatus>('connecting')
  const [progress, setProgress] = useState<ProgressState>({ completed: 0, total: 0 })
  const [taskLog, setTaskLog] = useState<TaskLogEntry[]>([])
  const [finalScore, setFinalScore] = useState<FinalScore | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const socket: Socket = io({ autoConnect: true })

    socket.on('connect', () => {
      socket.emit('join', id)
    })

    socket.on('evaluation:queued', (_e: QueuedEvent) => {
      setStatus('queued')
    })

    socket.on('evaluation:started', (_e: StartedEvent) => {
      setStatus('started')
    })

    socket.on('task:started', (e: TaskStartedEvent) => {
      setStatus('running')
      setTaskLog((prev) => {
        if (prev.some((t) => t.taskId === e.taskId)) return prev
        return [...prev, { taskId: e.taskId, status: 'running' }]
      })
      setProgress((prev) => ({
        ...prev,
        total: Math.max(prev.total, prev.completed + 1, prev.total)
      }))
    })

    socket.on('task:completed', (e: TaskCompletedEvent) => {
      setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }))
      setTaskLog((prev) => {
        const exists = prev.some((t) => t.taskId === e.taskId)
        const updated: TaskLogEntry = {
          taskId: e.taskId,
          status: 'completed',
          passed: e.passed,
          executionTimeMs: e.executionTimeMs
        }
        if (exists) {
          return prev.map((t) => (t.taskId === e.taskId ? updated : t))
        }
        return [...prev, updated]
      })
    })

    socket.on('evaluation:completed', (e: EvaluationCompletedEvent) => {
      setFinalScore(e.score)
      setStatus('completed')
      setProgress((prev) => ({
        completed: e.score.totalTasks,
        total: e.score.totalTasks || prev.total
      }))
    })

    socket.on('evaluation:failed', (e: EvaluationFailedEvent) => {
      setError(e.error)
      setStatus('failed')
    })

    return () => {
      socket.disconnect()
    }
  }, [id])

  const statusColors: Record<EvalStatus, string> = {
    connecting: '#94a3b8',
    queued: '#3b82f6',
    started: '#3b82f6',
    running: '#f59e0b',
    completed: '#10b981',
    failed: '#ef4444'
  }

  const cardStyle: React.CSSProperties = {
    background: '#1e293b',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20
  }

  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid #1e293b'
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    color: '#94a3b8',
    borderBottom: '1px solid #334155'
  }

  return (
    <div>
      <h1 style={{ color: '#e2e8f0' }}>Evaluation</h1>
      <p style={{ color: '#94a3b8' }}>
        ID: <code>{id}</code>
      </p>

      <div style={cardStyle}>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 999,
            background: statusColors[status],
            color: '#0f172a',
            fontWeight: 600,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}
        >
          {status}
        </span>

        <ProgressBar completed={progress.completed} total={progress.total} />

        {error && (
          <p style={{ color: '#f87171', marginTop: 12 }}>Error: {error}</p>
        )}
      </div>

      {finalScore && (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, color: '#e2e8f0', fontSize: 18 }}>
            Final Score
          </h2>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#10b981',
              lineHeight: 1.1
            }}
          >
            {(finalScore.resolveRate * 100).toFixed(1)}%
          </div>
          <p style={{ color: '#94a3b8', margin: '8px 0 0' }}>
            Resolved {finalScore.resolvedTasks} of {finalScore.totalTasks} tasks
          </p>
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#e2e8f0', fontSize: 18 }}>Task Log</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e2e8f0' }}>
          <thead>
            <tr>
              <th style={thStyle}>Task ID</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Result</th>
              <th style={thStyle}>Time (ms)</th>
            </tr>
          </thead>
          <tbody>
            {taskLog.map((task) => (
              <tr key={task.taskId}>
                <td style={tdStyle}>{task.taskId}</td>
                <td style={tdStyle}>{task.status}</td>
                <td style={tdStyle}>
                  {task.status === 'completed' ? (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 999,
                        background: task.passed ? '#10b981' : '#ef4444',
                        color: '#0f172a',
                        fontWeight: 600,
                        fontSize: 12
                      }}
                    >
                      {task.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>—</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {task.executionTimeMs != null ? task.executionTimeMs : '—'}
                </td>
              </tr>
            ))}
            {taskLog.length === 0 && (
              <tr>
                <td style={tdStyle} colSpan={4}>
                  Waiting for tasks…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
