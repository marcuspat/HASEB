import { Link, Route, Routes } from 'react-router-dom'
import LeaderboardPage from './pages/LeaderboardPage'
import SubmitPage from './pages/SubmitPage'
import EvaluationPage from './pages/EvaluationPage'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b'
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#e2e8f0',
            textDecoration: 'none',
            letterSpacing: 1
          }}
        >
          HASEB
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link to="/" style={{ color: '#e2e8f0', textDecoration: 'none' }}>
            Leaderboard
          </Link>
          <Link to="/submit" style={{ color: '#e2e8f0', textDecoration: 'none' }}>
            Submit Agent
          </Link>
          <a
            href="https://github.com/marcuspat/HASEB"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#94a3b8', textDecoration: 'none' }}
          >
            GitHub
          </a>
        </div>
      </nav>
      <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<LeaderboardPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/eval/:id" element={<EvaluationPage />} />
        </Routes>
      </main>
    </div>
  )
}
