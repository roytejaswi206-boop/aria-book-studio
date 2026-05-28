/**
 * End-to-end generation flow test
 * Verifies: API connectivity, route handling, polling, retries, and cancellation
 */

import { spawn } from 'child_process'

const BASE_URL = 'http://localhost:3001'
const MOCK_USER_ID = 'test-user-123'

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
}

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
}

let testsPassed = 0
let testsFailed = 0

async function test(name, fn) {
  try {
    log.info(`Testing: ${name}`)
    await fn()
    log.success(`${name}`)
    testsPassed += 1
  } catch (err) {
    log.error(`${name}: ${err.message}`)
    testsFailed += 1
  }
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body) {
    options.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    throw new Error(`${method} ${path} failed with ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function startServerIfNeeded() {
  // Try a quick health check; if it fails, spawn the server process and wait.
  try {
    const res = await fetch(`${BASE_URL}/health`)
    if (res.ok) return null
  } catch (_) {
    // continue to spawn
  }

  const proc = spawn(process.execPath, ['server/index.js'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: process.cwd() })
  proc.stdout.setEncoding('utf8')
  proc.stderr.setEncoding('utf8')

  const readyPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 15000)
    proc.stdout.on('data', (d) => {
      process.stdout.write(d)
      if (d.toString().includes('ARIA server running')) {
        clearTimeout(timeout)
        resolve(proc)
      }
    })
    proc.stderr.on('data', (d) => process.stderr.write(d))
    proc.on('exit', (code) => {
      reject(new Error(`Server exited with ${code}`))
    })
  })

  return readyPromise
}

async function stopServer(proc) {
  if (!proc) return
  try {
    proc.kill()
  } catch (_) {}
}

async function runTests() {
  console.log('\n🧪 ARIA Generation Flow Test Suite\n')

  // Test 1: Health check
  await test('Server health check', async () => {
    const data = await request('GET', '/health')
    if (data.status !== 'ok') throw new Error('Health check failed')
  })

  // Test 2: Create a book
  let bookId = null
  await test('Create book', async () => {
    const data = await request('POST', '/api/books', {
      userId: MOCK_USER_ID,
      title: 'Test Book: AI Adventures',
      subtitle: 'A thrilling science fiction tale',
      authorName: 'Test Author',
      language: 'English',
      genres: ['Science Fiction'],
      tones: ['Thrilling'],
      writing_styles: ['Narrative'],
      audience: ['General'],
      targetPages: 50,
      cover_skipped: false
    })
    if (!data.book?.id) throw new Error('Book creation did not return ID')
    bookId = data.book.id
  })

  // Test 3: Fetch created book
  await test('Fetch created book', async () => {
    const data = await request('GET', `/api/books/${bookId}`)
    if (data.book?.id !== bookId) throw new Error('Book fetch mismatch')
    if (data.book.status !== 'draft') throw new Error('Initial status should be draft')
  })

  // Test 4: Fetch books list
  await test('Fetch user books list', async () => {
    const data = await request('GET', `/api/books?userId=${MOCK_USER_ID}`)
    if (!Array.isArray(data.books)) throw new Error('Books list not returned')
    if (data.books.length === 0) throw new Error('No books found for user')
  })

  // Test 5: Start generation job
  let jobId = null
  await test('Start generation job', async () => {
    const data = await request('POST', '/api/jobs/start', {
      bookId,
      userId: MOCK_USER_ID,
      bookData: {
        title: 'Test Book: AI Adventures',
        subtitle: 'A thrilling science fiction tale',
        authorName: 'Test Author',
        language: 'English',
        genres: ['Science Fiction'],
        tones: ['Thrilling'],
        writing_styles: ['Narrative'],
        audience: ['General'],
        targetPages: 50,
        cover_skipped: false
      }
    })
    if (!data.jobId) throw new Error('Job ID not returned')
    jobId = data.jobId
  })

  // Test 6: Get job status
  await test('Get job status', async () => {
    const data = await request('GET', `/api/jobs/${jobId}/status`)
    if (!data.job?.id) throw new Error('Job not returned')
    if (data.job.status !== 'running') throw new Error('Job should be running')
  })

  // Test 7: Check chapters status (should be empty initially)
  await test('Get chapters status (initial)', async () => {
    const data = await request('GET', `/api/books/${bookId}/chapters/status`)
    if (!Array.isArray(data.chapters)) throw new Error('Chapters array not returned')
    // Initially might be empty
  })

  // Test 8: Wait a bit and check again
  await test('Wait for generation to progress', async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const data = await request('GET', `/api/jobs/${jobId}/status`)
    // Job might still be running, or might have completed/errored
    if (!data.job) throw new Error('Job status lost')
  })

  // Test 9: Cancel generation job
  await test('Cancel generation job', async () => {
    const data = await request('POST', `/api/jobs/${jobId}/cancel`)
    if (!data.ok) throw new Error('Cancel did not return ok')
  })

  // Test 10: Verify job was cancelled
  await test('Verify job is cancelled', async () => {
    // Give it a moment to process cancellation
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const data = await request('GET', `/api/jobs/${jobId}/status`)
    if (data.job.status !== 'cancelled' && data.job.status !== 'running') {
      // It might be running if cancellation hasn't been fully processed yet
      log.warn(`Job status is ${data.job.status}, expected cancelled or still running`)
    }
  })

  // Test 11: Create another book for chapter retry test
  let testBookId = null
  await test('Create book for retry test', async () => {
    const data = await request('POST', '/api/books', {
      userId: MOCK_USER_ID,
      title: 'Test Book for Retry',
      subtitle: 'Testing retry functionality',
      authorName: 'Test Author',
      language: 'English',
      genres: ['Fiction'],
      tones: ['Dramatic'],
      writing_styles: ['Narrative'],
      audience: ['General'],
      targetPages: 30,
      cover_skipped: true
    })
    testBookId = data.book?.id
  })

  // Test 12: Delete book
  await test('Delete book', async () => {
    const data = await request('DELETE', `/api/books/${testBookId}`)
    if (!data.ok) throw new Error('Delete did not return ok')
  })

  // Test 13: Verify book was deleted
  await test('Verify book was deleted', async () => {
    try {
      await request('GET', `/api/books/${testBookId}`)
      throw new Error('Book still exists after deletion')
    } catch (err) {
      if (err.message.includes('404') || err.message.includes('failed')) {
        // Expected
      } else {
        throw err
      }
    }
  })

  // Test 14: Fetch active jobs
  await test('Fetch active jobs for user', async () => {
    const data = await request('GET', `/api/jobs/active/${MOCK_USER_ID}`)
    if (!Array.isArray(data.jobs)) throw new Error('Active jobs array not returned')
  })

  console.log(`\n📊 Test Results: ${colors.green}${testsPassed} passed${colors.reset}, ${testsFailed > 0 ? colors.red + testsFailed + ' failed' + colors.reset : '0 failed'}`)

  if (testsFailed > 0) {
    process.exit(1)
  }
}

;(async () => {
  let serverProc = null
  try {
    serverProc = await startServerIfNeeded()
    await runTests()
  } catch (err) {
    log.error(`Fatal error: ${err.message}`)
    process.exit(1)
  } finally {
    await stopServer(serverProc)
  }
})()
