import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  }
})

export async function createBook(bookData) {
  const response = await api.post('/api/books', bookData)
  return response.data
}

export async function startJob({ bookId, userId, bookData }) {
  const response = await api.post('/api/jobs/start', { bookId, userId, bookData })
  return response.data
}

export async function getJobStatus(jobId) {
  const response = await api.get(`/api/jobs/${jobId}/status`)
  return response.data
}

export async function cancelJob(jobId) {
  const response = await api.post(`/api/jobs/${jobId}/cancel`)
  return response.data
}

export async function retryChapter(bookId, chapterNumber) {
  const response = await api.post(`/api/books/${bookId}/chapters/${chapterNumber}/retry`)
  return response.data
}

export async function getBookChaptersStatus(bookId) {
  const response = await api.get(`/api/books/${bookId}/chapters/status`)
  return response.data
}

export async function getBookChapters(bookId) {
  const response = await api.get(`/api/books/${bookId}/chapters`)
  return response.data
}

export async function deleteBook(bookId) {
  const response = await api.delete(`/api/books/${bookId}`)
  return response.data
}

export async function getBooks(userId) {
  const response = await api.get('/api/books', { params: { userId } })
  return response.data
}

export async function getBook(bookId) {
  const response = await api.get(`/api/books/${bookId}`)
  return response.data
}

export async function getActiveJobs(userId) {
  const response = await api.get(`/api/jobs/active/${userId}`)
  return response.data
}

export default api
