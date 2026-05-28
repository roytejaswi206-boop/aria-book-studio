import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function downloadPdf(element, fileName) {
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/jpeg', 1.0)
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgProps = pdf.getImageProperties(imgData)
  const imgHeight = (imgProps.height * pageWidth) / imgProps.width
  let cursor = 0

  pdf.addImage(imgData, 'JPEG', 0, cursor, pageWidth, imgHeight)

  while (cursor + imgHeight > pageHeight) {
    cursor -= pageHeight
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, cursor, pageWidth, imgHeight)
  }

  pdf.save(`${fileName}.pdf`)
}

export function downloadText(book, fileName) {
  const content = [book.front_matter || '', ...book.chapters?.map((ch) => `${ch.title}\n\n${ch.content}`) || [], book.back_matter || ''].join('\n\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadMarkdown(book, fileName) {
  const markdown = [
    `# ${book.title}`,
    book.subtitle ? `## ${book.subtitle}` : '',
    book.front_matter || '',
    ...book.chapters?.map((chapter) => `## ${chapter.title}\n\n${chapter.content}`) || [],
    book.back_matter || ''
  ].join('\n\n')
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.md`
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadHtml(book, fileName) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${book.title}</title><style>body{font-family:Georgia,serif;background:#f8f6f1;color:#111;margin:0;padding:24px;}h1,h2{font-family:Playfair Display,serif;}article{max-width:900px;margin:auto;}p{line-height:1.75;white-space:pre-wrap;} .chapter-title{margin-top:48px;}</style></head><body><article><h1>${book.title}</h1>${book.subtitle ? `<h2>${book.subtitle}</h2>` : ''}${book.front_matter ? `<section><pre style="white-space:pre-wrap;font-family:Georgia,serif;">${escapeHtml(book.front_matter)}</pre></section>` : ''}${book.chapters?.map((ch) => `<section class="chapter"><h2 class="chapter-title">${escapeHtml(ch.title)}</h2><pre style="white-space:pre-wrap;font-family:Georgia,serif;">${escapeHtml(ch.content)}</pre></section>`).join('')}<section><pre style="white-space:pre-wrap;font-family:Georgia,serif;">${escapeHtml(book.back_matter || '')}</pre></section></article></body></html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.html`
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadCoverJpg(element, fileName) {
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const url = canvas.toDataURL('image/jpeg', 1.0)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.jpg`
  link.click()
}

function escapeHtml(text = '') {
  return text.replace(/[&<>"]+/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[match] || match))
}
