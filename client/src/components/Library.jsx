import { useMemo, useState } from 'react'
import { BookOpen, Plus, Download, Trash2, Play } from 'lucide-react'

const statusBadges = {
  draft: { label: 'Draft', color: 'bg-slate-500' },
  generating: { label: 'Writing', color: 'bg-indigo-500' },
  complete: { label: 'Complete', color: 'bg-emerald-500' },
  error: { label: 'Error', color: 'bg-rose-500' }
}

export default function Library({ books = [], loading = false, onSelectBook, onCreateBook, onDeleteBook, onExportBook }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('recent')

  const filteredBooks = useMemo(() => {
    return books
      .filter((book) => {
        const matchesQuery = query.trim().length === 0 || [book.title, book.author_name, book.subtitle].some((value) => value?.toLowerCase().includes(query.toLowerCase()))
        const matchesStatus = statusFilter === 'all' || book.status === statusFilter
        return matchesQuery && matchesStatus
      })
      .sort((a, b) => {
        if (sortKey === 'recent') return new Date(b.created_at) - new Date(a.created_at)
        if (sortKey === 'az') return (a.title || '').localeCompare(b.title || '')
        if (sortKey === 'words') return (b.total_words || 0) - (a.total_words || 0)
        return 0
      })
  }, [books, query, statusFilter, sortKey])

  return (
    <section className="library-shell">
      <header className="library-header">
        <div>
          <p className="eyebrow">My Library</p>
          <h1>Your collection of works</h1>
        </div>
        <button className="primary-button" type="button" onClick={onCreateBook}>
          <Plus className="icon" /> New Book
        </button>
      </header>

      <div className="stats-row">
        <div className="stat-card"><strong>{books.length}</strong><span>Total Books</span></div>
        <div className="stat-card"><strong>{books.reduce((sum, book) => sum + (book.total_words || 0), 0)}</strong><span>Total Words</span></div>
        <div className="stat-card"><strong>{books.filter((book) => book.status === 'generating').length}</strong><span>In Progress</span></div>
        <div className="stat-card"><strong>{books.filter((book) => book.status === 'complete').length}</strong><span>Completed</span></div>
      </div>

      <div className="library-controls">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search books…" />
        <div className="filters">
          {['all', 'draft', 'generating', 'complete', 'error'].map((filter) => (
            <button
              key={filter}
              type="button"
              className={`filter-button ${statusFilter === filter ? 'active' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="recent">Recent</option>
            <option value="az">A-Z</option>
            <option value="words">Most Words</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading your books…</div>
      ) : filteredBooks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><BookOpen size={48} /></div>
          <h2>No books yet</h2>
          <p>Start your first book with ARIA.</p>
          <button className="primary-button" type="button" onClick={onCreateBook}>Create New Book</button>
        </div>
      ) : (
        <div className="book-grid">
          {filteredBooks.map((book) => {
            const isComplete = book.status === 'complete'
            const pct = book.total_chapters ? Math.round((book.completed_chapters / book.total_chapters) * 100) : 0
            return (
              <article key={book.id} className={`book-card ${book.status === 'generating' ? 'is-generating' : ''}`}>
                <div className="card-top">
                  <div className="cover-thumb">{book.title?.slice(0, 2).toUpperCase()}</div>
                  <div className="status-badge" style={{ background: statusBadges[book.status]?.color || '#64748b' }}>
                    {statusBadges[book.status]?.label || 'Unknown'}
                  </div>
                </div>
                <div className="card-body">
                  <h2>{book.title}</h2>
                  <p className="byline">{book.author_name || 'Unknown Author'}</p>
                  <p className="meta">{[...(book.genres || []), ...(book.tones || [])].slice(0, 3).join(' • ')}</p>
                  <div className="progress-row">
                    <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
                    <span>{book.total_chapters ? `${book.completed_chapters}/${book.total_chapters}` : '0/0'} chapters</span>
                  </div>
                  <p className="meta">{(book.total_words || 0).toLocaleString()} words</p>
                </div>
                <div className="card-footer">
                  <button type="button" className="secondary-button" onClick={() => onSelectBook(book.id)}>
                    <Play size={16} /> {isComplete ? 'Open' : 'Continue'}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => onExportBook?.(book)}>
                    <Download size={16} /> Export
                  </button>
                  <button type="button" className="danger-button" onClick={() => onDeleteBook?.(book.id)}>
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
