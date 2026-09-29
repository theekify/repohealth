import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8000'

/* ---------- Inline icons (stroke-based, minimal) ---------- */

const Icon = ({ path, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {path.map((d, i) => (
      <path key={i} d={d} />
    ))}
  </svg>
)

const icons = {
  logo: ['M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z', 'M9.5 12l1.8 1.8 3.4-3.6'],
  dashboard: ['M3 13h8V3H3l0 10z', 'M13 21h8V11h-8l0 10z', 'M13 3v4h8V3h-8z', 'M3 21h8v-4H3v4z'],
  files: ['M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8l-5-5z', 'M14 3v5h5'],
  users: [
    'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2',
    'M9 11a4 4 0 100-8 4 4 0 000 8z',
    'M22 21v-2a4 4 0 00-3-3.87',
    'M16 3.13a4 4 0 010 7.75',
  ],
  search: ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.35-4.35'],
  refresh: ['M21 12a9 9 0 11-2.64-6.36', 'M21 3v6h-6'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  folder: ['M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2l0 11z'],
  database: ['M12 8c4.42 0 8-1.12 8-2.5S16.42 3 12 3 4 4.12 4 5.5 7.58 8 12 8z', 'M20 5.5v13c0 1.38-3.58 2.5-8 2.5s-8-1.12-8-2.5v-13', 'M20 12c0 1.38-3.58 2.5-8 2.5s-8-1.12-8-2.5'],
}

/* ---------- Helpers ---------- */

const AVATAR_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#2563eb']

const avatarColor = (name) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

const initials = (name) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?'

const riskLevel = (share) => (share >= 0.8 ? 'high' : share >= 0.5 ? 'medium' : 'low')

const riskColor = (share) =>
  share >= 0.8 ? 'var(--danger)' : share >= 0.5 ? 'var(--warning)' : 'var(--success)'

async function api(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options)
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body.detail) detail = body.detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  return res.json()
}

/* ---------- Small components ---------- */

function Avatar({ name }) {
  return (
    <span className="avatar" style={{ background: avatarColor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

function OwnerBar({ share }) {
  return (
    <div className="owner-cell">
      <div className="meter">
        <div
          className="meter-fill"
          style={{ width: `${Math.round(share * 100)}%`, background: riskColor(share) }}
        />
      </div>
      <span className="pct">{Math.round(share * 100)}%</span>
    </div>
  )
}

function RiskBadge({ share }) {
  const level = riskLevel(share)
  return <span className={`badge badge-${level}`}>{level[0].toUpperCase() + level.slice(1)} risk</span>
}

function SkeletonRows({ count = 6 }) {
  const widths = useMemo(
    () => Array.from({ length: count }, (_, i) => 40 + ((i * 37) % 55)),
    [count],
  )
  return (
    <div aria-label="Loading results…" role="status">
      {widths.map((w, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton" style={{ width: `${w}%`, flexShrink: 0 }} />
          <div className="skeleton" style={{ width: 90 }} />
          <div className="skeleton" style={{ width: 120, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon path={icons.activity} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

/* ---------- Views ---------- */

function DashboardView({ data, repoPath }) {
  const highRisk = data.files.filter((f) => riskLevel(f.dominant_share) === 'high').length
  const mediumRisk = data.files.filter((f) => riskLevel(f.dominant_share) === 'medium').length
  const lowRisk = data.files.length - highRisk - mediumRisk

  return (
    <>
      <div className="stats-grid">
        <div className="card stat-card">
          <span className="stat-label">
            <Icon path={icons.database} /> Bus factor
          </span>
          <span className="stat-value">{data.bus_factor}</span>
          <div className="risk-meter" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="risk-segment"
                style={{
                  background:
                    n <= data.bus_factor
                      ? data.bus_factor <= 2
                        ? 'var(--danger)'
                        : data.bus_factor <= 4
                          ? 'var(--warning)'
                          : 'var(--success)'
                      : 'var(--border)',
                }}
              />
            ))}
          </div>
          <span className="stat-caption">
            {data.key_people.length} contributor{data.key_people.length === 1 ? '' : 's'} own over half the code
          </span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">
            <Icon path={icons.files} /> Files analyzed
          </span>
          <span className="stat-value">{data.total_files_analyzed}</span>
          <span className="stat-caption" title={repoPath}>
            in {repoPath}
          </span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">
            <Icon path={icons.alert} /> High-risk files
          </span>
          <span className="stat-value">{highRisk}</span>
          <span className="stat-caption">
            {mediumRisk} medium · {lowRisk} low concentration
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Highest ownership concentration</div>
            <div className="card-description">
              Files most dependent on a single author — review these first.
            </div>
          </div>
        </div>
        <FileTable files={data.files.slice(0, 8)} />
      </div>
    </>
  )
}

function FileTable({ files }) {
  if (!files.length) {
    return <EmptyState title="No files to show">Run an analysis to populate this view.</EmptyState>
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Dominant author</th>
            <th>Ownership</th>
            <th>Contributors</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.path}>
              <td>
                <span className="file-path" title={`${f.path} · ${f.total_lines} lines`}>
                  {f.path}
                </span>
              </td>
              <td>
                <span className="author-chip">
                  <Avatar name={f.dominant_author} />
                  {f.dominant_author}
                </span>
              </td>
              <td>
                <OwnerBar share={f.dominant_share} />
              </td>
              <td className="contrib-count">{f.contributor_count}</td>
              <td>
                <RiskBadge share={f.dominant_share} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FilesView({ data, query }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.files
    return data.files.filter(
      (f) => f.path.toLowerCase().includes(q) || f.dominant_author.toLowerCase().includes(q),
    )
  }, [data.files, query])

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">File ownership</div>
          <div className="card-description">
            {filtered.length} of {data.files.length} files · sorted by concentration
          </div>
        </div>
      </div>
      {filtered.length ? (
        <FileTable files={filtered} />
      ) : (
        <EmptyState title="No matches">Nothing matches “{query}”. Try a different file or author.</EmptyState>
      )}
    </div>
  )
}

function ContributorsView({ data }) {
  const byAuthor = useMemo(() => {
    const map = new Map()
    for (const f of data.files) {
      const entry = map.get(f.dominant_author) || { author: f.dominant_author, files: 0, maxShare: 0 }
      entry.files += 1
      entry.maxShare = Math.max(entry.maxShare, f.dominant_share)
      map.set(f.dominant_author, entry)
    }
    return [...map.values()].sort((a, b) => b.files - a.files)
  }, [data.files])

  const keySet = new Set(data.key_people)

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Contributors</div>
          <div className="card-description">
            Dominant authors across the repo. Key people are those needed to reach &gt;50% ownership.
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Author</th>
              <th>Files dominated</th>
              <th>Peak concentration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {byAuthor.map((a) => (
              <tr key={a.author}>
                <td>
                  <span className="author-chip">
                    <Avatar name={a.author} />
                    {a.author}
                  </span>
                </td>
                <td className="contrib-count">{a.files}</td>
                <td>
                  <OwnerBar share={a.maxShare} />
                </td>
                <td>
                  {keySet.has(a.author) ? (
                    <span className="badge badge-high">Key person</span>
                  ) : (
                    <span className="badge badge-low">Distributed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- App shell ---------- */

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
  { id: 'files', label: 'Files', icon: icons.files },
  { id: 'contributors', label: 'Contributors', icon: icons.users },
]

export default function App() {
  const [repoPath, setRepoPath] = useState('/workspace')
  const [active, setActive] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiOnline, setApiOnline] = useState(null)

  const analyze = useCallback(async () => {
    if (!repoPath.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await api('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: repoPath.trim() }),
      })
      setData(result)
      setApiOnline(true)
    } catch (e) {
      setError(e.message)
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [repoPath])

  useEffect(() => {
    api('/health')
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))
  }, [])

  const subtitle = data
    ? `${data.total_files_analyzed} files · bus factor ${data.bus_factor}`
    : 'Analyze a git repository to see code ownership health'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon path={icons.logo} />
          </span>
          <span className="brand-name">RepoHealth</span>
        </div>

        <nav aria-label="Primary">
          <div className="nav-section-label">Workspace</div>
          <div className="nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item${active === item.id ? ' active' : ''}`}
                onClick={() => setActive(item.id)}
                aria-current={active === item.id ? 'page' : undefined}
              >
                <Icon path={item.icon} />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <span>v0.1.0</span>
          <span className="api-status">
            <span
              className={`status-dot${apiOnline === null ? '' : apiOnline ? ' online' : ' offline'}`}
            />
            API {apiOnline === null ? 'checking…' : apiOnline ? 'online' : 'offline'}
          </span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">
              {NAV.find((n) => n.id === active)?.label}
            </div>
            <div className="topbar-subtitle">{subtitle}</div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={analyze}
            disabled={loading}
          >
            <Icon path={loading ? icons.refresh : icons.search} />
            {loading ? 'Analyzing…' : 'Run analysis'}
          </button>
        </header>

        <div className="content">
          <section className="card">
            <div className="card-body">
              <form
                className="analyze-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  analyze()
                }}
              >
                <input
                  className="input"
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="Path to a local git repository, e.g. /workspace"
                  aria-label="Repository path"
                  spellCheck="false"
                />
                <button type="submit" className="btn btn-secondary" disabled={loading}>
                  <Icon path={icons.folder} />
                  Analyze
                </button>
              </form>
              {error && (
                <div className="error-banner" role="alert" style={{ marginTop: 12 }}>
                  <Icon path={icons.alert} />
                  {error}
                </div>
              )}
            </div>
          </section>

          {loading && (
            <div className="card">
              <SkeletonRows />
            </div>
          )}

          {!loading && data && active === 'dashboard' && (
            <DashboardView data={data} repoPath={repoPath.trim()} />
          )}

          {!loading && data && active === 'files' && (
            <>
              <input
                className="input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by file path or dominant author…"
                aria-label="Filter files"
                style={{ maxWidth: 420 }}
              />
              <FilesView data={data} query={query} />
            </>
          )}

          {!loading && data && active === 'contributors' && <ContributorsView data={data} />}

          {!loading && !data && !error && (
            <div className="card">
              <EmptyState title="No analysis yet">
                Enter the path to a local git repository above and run your first analysis to
                surface ownership risks.
              </EmptyState>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
