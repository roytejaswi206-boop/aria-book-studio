export default function BookPreview({ book }) {
  if (!book) {
    return <div className="preview-empty">Select a book to preview.</div>
  }

  return (
    <section className="preview-shell" id="book-preview-export">
      <div className="preview-header">
        <h1>{book.title}</h1>
        {book.subtitle && <p className="subtitle">{book.subtitle}</p>}
      </div>
      <div className="preview-content">
        {book.front_matter ? <pre className="preview-text">{book.front_matter}</pre> : <p className="preview-text">No front matter yet.</p>}
        {(book.chapters || []).map((chapter) => (
          <article key={chapter.chapter_number} className="preview-chapter">
            <h2>{chapter.title}</h2>
            <pre className="preview-text">{chapter.content}</pre>
          </article>
        ))}
        {book.back_matter ? <pre className="preview-text">{book.back_matter}</pre> : null}
      </div>
    </section>
  )
}
