import { Download, FileText, FileImage, FileCode2 } from 'lucide-react'
import { downloadPdf, downloadText, downloadMarkdown, downloadHtml, downloadCoverJpg } from '../services/exportService'

export default function ExportPanel({ book, coverRef }) {
  const fileName = book?.title?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'aria-book'

  return (
    <section className="export-panel">
      <h2>Export Your Book</h2>
      <div className="export-grid">
        <button type="button" onClick={() => downloadPdf(document.getElementById('book-preview-export') || document.body, fileName)}>
          <Download size={18} /> PDF
        </button>
        <button type="button" onClick={() => downloadText(book, fileName)}>
          <FileText size={18} /> TXT
        </button>
        <button type="button" onClick={() => downloadMarkdown(book, fileName)}>
          <FileCode2 size={18} /> MD
        </button>
        <button type="button" onClick={() => downloadHtml(book, fileName)}>
          <FileImage size={18} /> HTML
        </button>
        <button
          type="button"
          onClick={() => {
            if (coverRef?.current) {
              downloadCoverJpg(coverRef.current, `${fileName}-cover`)
            } else {
              alert('No cover has been generated yet.')
            }
          }}
        >
          <FileImage size={18} /> Cover JPG
        </button>
      </div>
    </section>
  )
}
