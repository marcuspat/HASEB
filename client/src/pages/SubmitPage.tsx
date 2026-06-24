import { useState } from 'react'
import { Link } from 'react-router-dom'

interface SubmitResponse {
  success: boolean
  data?: { evaluationId: string }
  error?: string
  message?: string
}

const PROVIDERS = ['anthropic', 'openai', 'google', 'meta', 'other'] as const
type Provider = (typeof PROVIDERS)[number]

export default function SubmitPage() {
  const [agentName, setAgentName] = useState('')
  const [modelProvider, setModelProvider] = useState<Provider>('anthropic')
  const [agentPatch, setAgentPatch] = useState('')
  const [maxTasks, setMaxTasks] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [evaluationId, setEvaluationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const benchmarkId = 'swe-bench-lite'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setEvaluationId(null)

    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          modelProvider,
          agentPatch,
          benchmarkId,
          maxTasks
        })
      })
      const json: SubmitResponse = await res.json()
      if (json.success && json.data) {
        setEvaluationId(json.data.evaluationId)
      } else {
        setError(json.error ?? json.message ?? 'Submission failed')
      }
    } catch {
      setError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    color: '#94a3b8',
    fontSize: 14
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'inherit'
  }

  const fieldStyle: React.CSSProperties = { marginBottom: 18 }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ color: '#e2e8f0' }}>Submit Agent</h1>

      <form
        onSubmit={handleSubmit}
        style={{ background: '#1e293b', borderRadius: 8, padding: 24 }}
      >
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="agentName">
            Agent Name
          </label>
          <input
            id="agentName"
            type="text"
            required
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="modelProvider">
            Model Provider
          </label>
          <select
            id="modelProvider"
            value={modelProvider}
            onChange={(e) => setModelProvider(e.target.value as Provider)}
            style={inputStyle}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="agentPatch">
            Agent Patch
          </label>
          <textarea
            id="agentPatch"
            rows={10}
            placeholder="Paste your git diff here..."
            value={agentPatch}
            onChange={(e) => setAgentPatch(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <input type="hidden" name="benchmarkId" value={benchmarkId} />

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="maxTasks">
            Max Tasks
          </label>
          <input
            id="maxTasks"
            type="number"
            min={1}
            max={300}
            value={maxTasks}
            onChange={(e) => setMaxTasks(Number(e.target.value))}
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 20px',
            background: submitting ? '#475569' : '#10b981',
            color: '#0f172a',
            border: 'none',
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Evaluation'}
        </button>
      </form>

      {error && (
        <p style={{ color: '#f87171', marginTop: 16 }}>{error}</p>
      )}

      {evaluationId && (
        <div
          style={{
            marginTop: 16,
            background: '#1e293b',
            borderRadius: 8,
            padding: 16
          }}
        >
          <p style={{ color: '#34d399', margin: '0 0 8px' }}>
            Evaluation queued successfully.
          </p>
          <p style={{ margin: '0 0 8px', color: '#94a3b8' }}>
            Evaluation ID: <code>{evaluationId}</code>
          </p>
          <Link to={'/eval/' + evaluationId}>View live progress →</Link>
        </div>
      )}
    </div>
  )
}
