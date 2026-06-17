import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

interface LeaderboardEntry {
  agentName: string
  modelProvider: string
  resolveRate: number
  rank: number
  percentile: number
  totalTasks: number
  submittedAt: string
  benchmarkName: string
}

interface LeaderboardResponse {
  success: boolean
  data: {
    entries: LeaderboardEntry[]
    total: number
  }
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#f97316',
  openai: '#10b981',
  meta: '#6366f1',
  google: '#3b82f6'
}

function providerColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] ?? '#94a3b8'
}

type SortColumn =
  | 'rank'
  | 'agentName'
  | 'modelProvider'
  | 'resolveRate'
  | 'totalTasks'
  | 'submittedAt'

interface SortState {
  column: SortColumn
  asc: boolean
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortState>({ column: 'rank', asc: true })
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const res = await fetch('/api/leaderboard')
        const json: LeaderboardResponse = await res.json()
        if (!active) return
        if (json.success) {
          setEntries(json.data.entries)
          setError(null)
        } else {
          setError('Failed to load leaderboard')
        }
      } catch {
        if (active) setError('Failed to load leaderboard')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  // D3 horizontal bar chart of top 10 by resolveRate
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const top = [...entries]
      .sort((a, b) => b.resolveRate - a.resolveRate)
      .slice(0, 10)

    if (top.length === 0) return

    const width = 700
    const height = 350
    const margin = { top: 20, right: 80, bottom: 30, left: 200 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerWidth])
    const y = d3
      .scaleBand<string>()
      .domain(top.map((d) => d.agentName))
      .range([0, innerHeight])
      .padding(0.2)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((v) => `${v}%`))
      .selectAll('text')
      .attr('fill', '#94a3b8')

    g.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .attr('fill', '#e2e8f0')

    g.selectAll('.bar')
      .data(top)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', (d) => y(d.agentName) ?? 0)
      .attr('height', y.bandwidth())
      .attr('width', (d) => x(d.resolveRate * 100))
      .attr('fill', (d) => providerColor(d.modelProvider))

    g.selectAll('.label')
      .data(top)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', (d) => x(d.resolveRate * 100) + 6)
      .attr('y', (d) => (y(d.agentName) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('fill', '#e2e8f0')
      .attr('font-size', 12)
      .text((d) => `${(d.resolveRate * 100).toFixed(1)}%`)
  }, [entries])

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const col = sort.column
      let cmp = 0
      if (col === 'agentName' || col === 'modelProvider' || col === 'submittedAt') {
        cmp = String(a[col]).localeCompare(String(b[col]))
      } else {
        cmp = (a[col] as number) - (b[col] as number)
      }
      return sort.asc ? cmp : -cmp
    })
    return sorted
  }, [entries, sort])

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, asc: !prev.asc }
        : { column, asc: true }
    )
  }

  const sortArrow = (column: SortColumn) =>
    sort.column === column ? (sort.asc ? ' ▲' : ' ▼') : ''

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    cursor: 'pointer',
    color: '#94a3b8',
    borderBottom: '1px solid #334155',
    userSelect: 'none'
  }

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #1e293b'
  }

  return (
    <div>
      <h1 style={{ color: '#e2e8f0' }}>Leaderboard</h1>

      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {loading && !error && <p style={{ color: '#94a3b8' }}>Loading…</p>}

      <div
        style={{
          background: '#1e293b',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          overflowX: 'auto'
        }}
      >
        <h2 style={{ marginTop: 0, color: '#e2e8f0', fontSize: 18 }}>
          Top 10 by Resolve Rate
        </h2>
        <svg ref={svgRef} width={700} height={350} />
      </div>

      <div
        style={{
          background: '#1e293b',
          borderRadius: 8,
          padding: 16,
          overflowX: 'auto'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e2e8f0' }}>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => toggleSort('rank')}>
                Rank{sortArrow('rank')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('agentName')}>
                Agent{sortArrow('agentName')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('modelProvider')}>
                Provider{sortArrow('modelProvider')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('resolveRate')}>
                Resolve Rate{sortArrow('resolveRate')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('totalTasks')}>
                Tasks{sortArrow('totalTasks')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('submittedAt')}>
                Date{sortArrow('submittedAt')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry, i) => (
              <tr key={`${entry.agentName}-${i}`}>
                <td style={tdStyle}>{entry.rank}</td>
                <td style={tdStyle}>{entry.agentName}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: providerColor(entry.modelProvider),
                      marginRight: 8
                    }}
                  />
                  {entry.modelProvider}
                </td>
                <td style={tdStyle}>{(entry.resolveRate * 100).toFixed(1)}%</td>
                <td style={tdStyle}>{entry.totalTasks}</td>
                <td style={tdStyle}>
                  {new Date(entry.submittedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {sortedEntries.length === 0 && !loading && (
              <tr>
                <td style={tdStyle} colSpan={6}>
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
