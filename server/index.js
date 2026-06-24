import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import {
  ARIA_SYSTEM_PROMPT,
  buildPlannerPrompt,
  buildCodexPrompt,
  buildFrontMatterPrompt,
  buildCoverPrompt,
  buildChapterPrompt
} from './prompts.js'

dotenv.config()

const PORT = process.env.PORT || 5000
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('Warning: Supabase environment variables are not fully configured.')
}
if (!ANTHROPIC_API_KEY) {
  console.warn('Warning: Anthropic environment variable is not set.')
}

let supabase = null
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
} else {
  // Lightweight in-memory fallback for local testing when Supabase isn't configured.
  console.warn('Using in-memory fallback for Supabase (local test mode)')
  const db = { books: new Map(), chapters: new Map(), generation_jobs: new Map() }
  const tableFor = (name) => db[name] || (db[name] = new Map())

  const makeResponse = (data) => ({ data, error: null })

  supabase = {
    from: (table) => {
      const map = tableFor(table)
      return {
        insert: (payload) => {
          const obj = Array.isArray(payload) ? payload[0] : payload
          const id = obj.id || uuidv4()
          const row = { ...obj, id }
          map.set(id, row)
          return {
            select: () => ({ single: async () => makeResponse(row) })
          }
        },
        select: (cols) => ({
          eq: (key, value) => ({
            order: async (opts) => {
              const items = Array.from(map.values()).filter((r) => r[key] === value)
              return makeResponse(items)
            },
            maybeSingle: async () => makeResponse(Array.from(map.values()).find((r) => r[key] === value) || null),
            single: async () => makeResponse(Array.from(map.values()).find((r) => r[key] === value) || null)
          }),
          order: async () => makeResponse(Array.from(map.values()))
        }),
        update: (updates) => ({
          eq: async (key, value) => {
            const items = Array.from(map.values()).filter((r) => r[key] === value)
            items.forEach((it) => map.set(it.id, { ...it, ...updates }))
            return makeResponse(items.length ? items[0] : null)
          }
        }),
        delete: () => ({ eq: async (key, value) => {
          const items = Array.from(map.values()).filter((r) => r[key] === value)
          items.forEach((it) => map.delete(it.id))
          return makeResponse(null)
        }}),
        upsert: (obj, _opts) => {
          const id = obj.id || uuidv4()
          const row = { ...obj, id }
          map.set(id, row)
          return makeResponse(row)
        }
      }
    }
  }
}
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY || '' })
const activeJobs = new Map()

const app = express()
const configuredOrigins = CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://aria-book-studio-v2.vercel.app'
]
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins])
const isVercelOrigin = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin)
    return protocol === 'https:' && (hostname === 'vercel.app' || hostname.endsWith('.vercel.app'))
  } catch {
    return false
  }
}
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || isVercelOrigin(origin)) {
      return callback(null, true)
    }
    return callback(null, false)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
  maxAge: 86400
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '2mb' }))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.post('/api/books', async (req, res) => {
  try {
    const payload = req.body
    const { userId, title, subtitle, authorName, language, genres, tones, writing_styles, audience, targetPages, cover_skipped } = payload
    if (!userId || !title) {
      return res.status(400).json({ error: 'Missing required book fields.' })
    }
    const book = {
      user_id: userId,
      title,
      subtitle: subtitle || '',
      tagline: payload.tagline || '',
      author_name: authorName || '',
      book_types: payload.book_types || [],
      genres: genres || [],
      tones: tones || [],
      writing_styles: writing_styles || [],
      audience: audience || [],
      language: language || 'English',
      description: payload.description || '',
      user_custom_prompt: payload.user_custom_prompt || '',
      status: 'draft',
      cover_skipped: !!cover_skipped,
      book_dna: {},
      book_plan: {},
      codex: {},
      total_chapters: 0,
      completed_chapters: 0,
      total_words: 0,
      min_pages: targetPages || 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    const { data, error } = await supabase.from('books').insert(book).select().single()
    if (error) {
      console.error('Create book error', error)
      return res.status(500).json({ error: error.message })
    }
    res.json({ book: data })
  } catch (err) {
    console.error('Create book exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/books', async (req, res) => {
  try {
    const userId = req.query.userId
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }
    const { data, error } = await supabase.from('books').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) {
      console.error('Fetch books error', error)
      return res.status(500).json({ error: error.message })
    }
    res.json({ books: data || [] })
  } catch (err) {
    console.error('Fetch books exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/books/:bookId', async (req, res) => {
  try {
    const bookId = req.params.bookId
    const { data, error } = await supabase.from('books').select('*').eq('id', bookId).single()
    if (error) {
      console.error('Fetch book error', error)
      return res.status(500).json({ error: error.message })
    }
    if (!data) return res.status(404).json({ error: 'Book not found' })
    res.json({ book: data })
  } catch (err) {
    console.error('Fetch book exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/jobs/start', async (req, res) => {
  try {
    const { bookId, userId, bookData } = req.body
    if (!bookId || !userId || !bookData) {
      return res.status(400).json({ error: 'Missing job payload.' })
    }

    const jobId = uuidv4()
    const jobRow = {
      id: jobId,
      book_id: bookId,
      user_id: userId,
      status: 'running',
      total_chapters: 0,
      completed_chapters: 0,
      current_chapter_title: '',
      phase: 'planning',
      error_log: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('generation_jobs').insert(jobRow)
    if (error) {
      console.error('Job insert error', error)
      return res.status(500).json({ error: error.message })
    }

    activeJobs.set(jobId, { ...jobRow, status: 'running' })
    res.json({ jobId, status: 'started' })

    runFullBookGeneration(jobId, bookId, bookData, userId).catch(async (err) => {
      console.error('Generation failed:', err)
      activeJobs.set(jobId, {
        ...(activeJobs.get(jobId) || {}),
        status: 'error',
        phase: 'error',
        error_log: err.message
      })
      await supabase.from('generation_jobs').update({ status: 'error', phase: 'error', error_log: err.message, updated_at: new Date().toISOString() }).eq('id', jobId)
      await supabase.from('books').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', bookId)
    })
  } catch (err) {
    console.error('Start job exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/jobs/:jobId/status', async (req, res) => {
  try {
    const jobId = req.params.jobId
    if (!jobId) {
      return res.status(400).json({ error: 'jobId required' })
    }
    const cached = activeJobs.get(jobId)
    if (cached) {
      return res.json({ job: cached })
    }
    const { data, error } = await supabase.from('generation_jobs').select('*').eq('id', jobId).single()
    if (error) {
      console.error('Job status fetch error', error)
      return res.status(500).json({ error: error.message })
    }
    res.json({ job: data })
  } catch (err) {
    console.error('Job status exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/jobs/:jobId/cancel', async (req, res) => {
  try {
    const jobId = req.params.jobId
    if (!jobId) {
      return res.status(400).json({ error: 'jobId required' })
    }
    const job = activeJobs.get(jobId)
    if (job) {
      // The generation loop checks this flag at each boundary and stops cleanly.
      activeJobs.set(jobId, { ...job, cancelled: true })
    }
    // Persist intent even if the loop isn't in memory (e.g. after a restart).
    await supabase.from('generation_jobs').update({ status: 'cancelled', phase: 'cancelled', updated_at: new Date().toISOString() }).eq('id', jobId)
    res.json({ ok: true, status: 'cancelling' })
  } catch (err) {
    console.error('Cancel job exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/books/:bookId/chapters/status', async (req, res) => {
  try {
    const bookId = req.params.bookId
    if (!bookId) {
      return res.status(400).json({ error: 'bookId required' })
    }
    const { data, error } = await supabase.from('chapters').select('chapter_number, title, status, word_count').eq('book_id', bookId).order('chapter_number', { ascending: true })
    if (error) {
      console.error('Chapters status fetch error', error)
      return res.status(500).json({ error: error.message })
    }
    res.json({ chapters: data || [] })
  } catch (err) {
    console.error('Chapters status exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/books/:bookId/chapters', async (req, res) => {
  try {
    const bookId = req.params.bookId
    if (!bookId) {
      return res.status(400).json({ error: 'bookId required' })
    }
    const { data, error } = await supabase.from('chapters').select('*').eq('book_id', bookId).order('chapter_number', { ascending: true })
    if (error) {
      console.error('Chapters fetch error', error)
      return res.status(500).json({ error: error.message })
    }
    res.json({ chapters: data || [] })
  } catch (err) {
    console.error('Chapters fetch exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/books/:bookId/chapters/:chapterNumber/retry', async (req, res) => {
  try {
    const bookId = req.params.bookId
    const chapterNumber = Number.parseInt(req.params.chapterNumber, 10)
    if (!bookId || !Number.isFinite(chapterNumber)) {
      return res.status(400).json({ error: 'bookId and numeric chapterNumber required' })
    }

    const { data: bookRow, error: bookErr } = await supabase.from('books').select('*').eq('id', bookId).single()
    if (bookErr || !bookRow) {
      return res.status(404).json({ error: 'Book not found' })
    }

    const bookPlan = bookRow.book_plan || {}
    const codex = bookRow.codex || {}
    const allChapters = bookPlan.structure?.acts?.flatMap((a) => a.chapters) || []
    const chapterInfo = allChapters.find((c, idx) => (c.chapterNumber || idx + 1) === chapterNumber)
    if (!chapterInfo) {
      return res.status(404).json({ error: 'Chapter not found in book plan' })
    }

    // Task 4: never regenerate an already-complete chapter on retry.
    const { data: existing } = await supabase.from('chapters').select('status').eq('book_id', bookId).eq('chapter_number', chapterNumber).maybeSingle()
    if (existing?.status === 'complete') {
      return res.status(409).json({ error: 'Chapter already complete; refusing to regenerate.' })
    }

    let previousLastLine = null
    if (chapterNumber > 1) {
      const { data: prevChap } = await supabase.from('chapters').select('content').eq('book_id', bookId).eq('chapter_number', chapterNumber - 1).maybeSingle()
      if (prevChap?.content) {
        const lines = prevChap.content.split('\n').filter((line) => line.trim())
        previousLastLine = lines[lines.length - 1] || null
      }
    }

    const { cachedPrefix, prompt } = buildChapterPrompt(bookPlan, chapterInfo, codex, previousLastLine, bookRow)
    const raw = await retryCall(() => callClaude(prompt, 2600, cachedPrefix))
    const content = raw.trim()
    const wordCount = content.split(/\s+/).filter(Boolean).length

    await supabase.from('chapters').upsert({
      book_id: bookId,
      chapter_number: chapterNumber,
      title: chapterInfo.title || `Chapter ${chapterNumber}`,
      content,
      word_count: wordCount,
      status: 'complete',
      hook: chapterInfo.hook || '',
      core_concept: chapterInfo.coreConcept || '',
      emotional_beat: chapterInfo.emotionalBeat || '',
      chapter_end_hook: chapterInfo.chapterEndHook || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'book_id,chapter_number' })

    // Recompute book aggregates and clear the error status if no failures remain.
    const { data: allRows } = await supabase.from('chapters').select('status, word_count').eq('book_id', bookId)
    const completed = (allRows || []).filter((c) => c.status === 'complete')
    const stillFailed = (allRows || []).some((c) => c.status === 'failed')
    const totalWords = completed.reduce((sum, c) => sum + (c.word_count || 0), 0)
    const bookStatus = stillFailed ? 'error' : (bookRow.back_matter ? 'complete' : bookRow.status)
    await supabase.from('books').update({
      completed_chapters: completed.length,
      total_words: totalWords,
      status: bookStatus,
      updated_at: new Date().toISOString()
    }).eq('id', bookId)

    res.json({ ok: true, chapterNumber, wordCount })
  } catch (err) {
    console.error('Retry chapter exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/books/:bookId', async (req, res) => {
  try {
    const bookId = req.params.bookId
    if (!bookId) {
      return res.status(400).json({ error: 'bookId required' })
    }
    // chapters/jobs cascade via ON DELETE CASCADE, but delete explicitly in case
    // the schema was created without it.
    await supabase.from('chapters').delete().eq('book_id', bookId)
    await supabase.from('generation_jobs').delete().eq('book_id', bookId)
    const { error } = await supabase.from('books').delete().eq('id', bookId)
    if (error) {
      console.error('Delete book error', error)
      return res.status(500).json({ error: error.message })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Delete book exception', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/jobs/active/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }
    const running = Array.from(activeJobs.values()).filter((job) => job.user_id === userId && job.status === 'running')
    if (running.length > 0) {
      return res.json({ jobs: running })
    }
    const { data, error } = await supabase.from('generation_jobs').select('*').eq('user_id', userId).eq('status', 'running').order('created_at', { ascending: false })
    if (error) {
      console.error('Active jobs fetch error', error)
      return res.status(500).json({ error: error.message })
    }
    res.json({ jobs: data || [] })
  } catch (err) {
    console.error('Active jobs exception', err)
    res.status(500).json({ error: err.message })
  }
})

async function runFullBookGeneration(jobId, bookId, bookData, userId) {
  const metrics = { startedAt: Date.now(), inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, chaptersWritten: 0 }

  const updateJob = async (updates) => {
    const current = activeJobs.get(jobId) || {}
    const stamped = { ...updates, updated_at: new Date().toISOString() }
    activeJobs.set(jobId, { ...current, ...stamped })
    // Only write the changed fields to Supabase — never re-send the primary key.
    // `metrics` lives in-memory only (not a column), so strip it before writing.
    const { metrics: _m, ...dbFields } = stamped
    const { error } = await supabase.from('generation_jobs').update(dbFields).eq('id', jobId)
    if (error) {
      console.error('[job]', jobId, 'updateJob failed:', error.message)
    }
  }

  // Cancellation: the cancel endpoint sets cancelled=true on the in-memory job.
  // We check at every phase/chapter boundary and stop cleanly.
  const isCancelled = () => activeJobs.get(jobId)?.cancelled === true
  const publishMetrics = () => {
    const elapsedMs = Date.now() - metrics.startedAt
    activeJobs.set(jobId, {
      ...(activeJobs.get(jobId) || {}),
      metrics: {
        elapsedMs,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        cacheReadTokens: metrics.cacheReadTokens,
        chaptersWritten: metrics.chaptersWritten,
        msPerChapter: metrics.chaptersWritten > 0 ? Math.round(elapsedMs / metrics.chaptersWritten) : null,
        wordsPerMin: null
      }
    })
  }

  await updateJob({ phase: 'planning', status: 'running' })
  console.log('[job]', jobId, 'starting planner')
  const bookPlan = await retryCall(async () => {
    const result = await callClaude(buildPlannerPrompt(bookData), 3000, null, metrics)
    return safeParseJson(result, {
      refinedTitle: bookData.title,
      subtitle: bookData.subtitle || '',
      tagline: bookData.tagline || '',
      bookDNA: {
        primaryEmotion: '',
        narrativeArc: '',
        writingPersona: 'Confident storyteller',
        targetVoice: 'Warm, cinematic, clear'
      },
      publishingAnalysis: {
        marketAngle: '',
        readerPromise: '',
        uniqueHook: ''
      },
      structure: { acts: [] },
      frontMatterSections: ['Title Page','Copyright','Dedication','Preface','Table of Contents'],
      backMatterSections: ['Epilogue','Acknowledgements','About Author'],
      coverMood: '',
      estimatedStats: { totalWords: 0, totalPages: 0, chaptersCount: 0 }
    })
  })
  console.log('[job]', jobId, 'planner finished', bookPlan.structure?.acts?.length)

  if (isCancelled()) return finalizeCancelled(jobId, bookId)

  await supabase.from('books').update({ book_plan: bookPlan, status: 'generating', updated_at: new Date().toISOString() }).eq('id', bookId)

  await updateJob({ phase: 'building_codex' })
  console.log('[job]', jobId, 'starting codex')
  const codex = await retryCall(async () => {
    const result = await callClaude(buildCodexPrompt(bookPlan), 2000, null, metrics)
    return safeParseJson(result, { characters: [], locations: [], lore: [], items: [] })
  })
  console.log('[job]', jobId, 'codex finished')
  await supabase.from('books').update({ codex, updated_at: new Date().toISOString() }).eq('id', bookId)

  if (isCancelled()) return finalizeCancelled(jobId, bookId)

  await updateJob({ phase: 'front_matter' })
  const frontMatter = await retryCall(async () => {
    return await callClaude(buildFrontMatterPrompt(bookPlan), 2500, null, metrics)
  })
  await supabase.from('books').update({ front_matter: frontMatter, updated_at: new Date().toISOString() }).eq('id', bookId)

  if (isCancelled()) return finalizeCancelled(jobId, bookId)

  if (!bookData.cover_skipped) {
    await updateJob({ phase: 'cover_design' })
    const coverConcepts = await retryCall(async () => {
      const result = await callClaude(buildCoverPrompt(bookPlan), 1200, null, metrics)
      return safeParseJson(result, [])
    })
    await supabase.from('books').update({ cover_concepts: coverConcepts, updated_at: new Date().toISOString() }).eq('id', bookId)
  }

  if (isCancelled()) return finalizeCancelled(jobId, bookId)

  const allChapters = bookPlan.structure?.acts?.flatMap((a) => a.chapters) || []
  await updateJob({ total_chapters: allChapters.length, completed_chapters: 0, phase: 'writing_chapters' })

  if (allChapters.length === 0) {
    await updateJob({ status: 'error', phase: 'error', error_log: 'Planner returned no chapters' })
    await supabase.from('books').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', bookId)
    console.error('[job]', jobId, 'planner produced zero chapters, aborting')
    return
  }

  let totalWords = 0

  for (let index = 0; index < allChapters.length; index += 1) {
    if (isCancelled()) {
      publishMetrics()
      return finalizeCancelled(jobId, bookId)
    }

    const chapterInfo = allChapters[index]
    const chapterNumber = chapterInfo.chapterNumber || index + 1
    await updateJob({ current_chapter_title: chapterInfo.title, completed_chapters: index, phase: 'writing_chapters', metrics: snapshotMetrics(metrics) })

    const { data: existing } = await supabase.from('chapters').select('id, status, word_count').eq('book_id', bookId).eq('chapter_number', chapterNumber).maybeSingle()
    if (existing?.status === 'complete') {
      console.log('[job]', jobId, 'chapter', chapterNumber, 'already complete, skipping')
      totalWords += existing.word_count || 0
      continue
    }

    let previousLastLine = null
    if (index > 0) {
      const { data: prevChap } = await supabase.from('chapters').select('content').eq('book_id', bookId).eq('chapter_number', chapterNumber - 1).maybeSingle()
      if (prevChap?.content) {
        const lines = prevChap.content.split('\n').filter((line) => line.trim())
        previousLastLine = lines[lines.length - 1] || null
      }
    }

    let success = false
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        console.log('[job]', jobId, 'chapter', chapterNumber, 'attempt', attempt)
        const { cachedPrefix, prompt } = buildChapterPrompt(bookPlan, chapterInfo, codex, previousLastLine, bookData)
        const raw = await callClaude(prompt, 2600, cachedPrefix, metrics)
        const content = raw.trim()
        const wordCount = content.split(/\s+/).filter(Boolean).length

        await supabase.from('chapters').upsert({
          book_id: bookId,
          chapter_number: chapterNumber,
          title: chapterInfo.title || `Chapter ${chapterNumber}`,
          content,
          word_count: wordCount,
          status: 'complete',
          hook: chapterInfo.hook || '',
          core_concept: chapterInfo.coreConcept || '',
          emotional_beat: chapterInfo.emotionalBeat || '',
          chapter_end_hook: chapterInfo.chapterEndHook || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'book_id,chapter_number' })

        totalWords += wordCount
        metrics.chaptersWritten += 1
        await supabase.from('books').update({ completed_chapters: index + 1, total_words: totalWords, updated_at: new Date().toISOString() }).eq('id', bookId)
        success = true
        console.log('[job]', jobId, 'chapter', chapterNumber, 'completed', wordCount, 'words')
        break
      } catch (err) {
        console.error('[job]', jobId, 'chapter', chapterNumber, 'failed attempt', attempt, err)
        if (attempt < 3) {
          await sleep(backoffForError(err, attempt, 4000))
        }
      }
    }

    if (!success) {
      await supabase.from('chapters').upsert({
        book_id: bookId,
        chapter_number: chapterNumber,
        title: chapterInfo.title || `Chapter ${chapterNumber}`,
        content: '[ Generation failed — click Retry ]',
        word_count: 0,
        status: 'failed',
        updated_at: new Date().toISOString()
      }, { onConflict: 'book_id,chapter_number' })
      // Don't abort the whole book — mark this chapter failed and keep going so
      // the rest of the book still generates. The user can retry it individually.
      await updateJob({ error_log: `Chapter ${chapterNumber} failed after 3 tries`, metrics: snapshotMetrics(metrics) })
    }
    await sleep(1500)
  }

  if (isCancelled()) {
    publishMetrics()
    return finalizeCancelled(jobId, bookId)
  }

  await updateJob({ phase: 'back_matter' })
  const backMatter = await retryCall(async () => {
    return await callClaude(`Create back matter sections for this book. Include acknowledgements and about the author. Return plain text only.\n\n${JSON.stringify(bookPlan, null, 2)}`, 2000, null, metrics)
  })

  // If any chapter ended up failed, mark the book as error so the UI surfaces it.
  const { count: failedCount } = await supabase.from('chapters').select('id', { count: 'exact', head: true }).eq('book_id', bookId).eq('status', 'failed')
  const finalStatus = failedCount && failedCount > 0 ? 'error' : 'complete'

  await supabase.from('books').update({ back_matter: backMatter, status: finalStatus, completed_chapters: allChapters.length, total_words: totalWords, updated_at: new Date().toISOString() }).eq('id', bookId)
  publishMetrics()
  await updateJob({ status: finalStatus === 'error' ? 'error' : 'complete', phase: 'complete', completed_chapters: allChapters.length, metrics: snapshotMetrics(metrics) })
  console.log('[job]', jobId, 'finished with status', finalStatus)
}

function snapshotMetrics(metrics) {
  const elapsedMs = Date.now() - metrics.startedAt
  return {
    elapsedMs,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    cacheReadTokens: metrics.cacheReadTokens,
    chaptersWritten: metrics.chaptersWritten,
    msPerChapter: metrics.chaptersWritten > 0 ? Math.round(elapsedMs / metrics.chaptersWritten) : null
  }
}

async function finalizeCancelled(jobId, bookId) {
  console.log('[job]', jobId, 'cancelled')
  activeJobs.set(jobId, { ...(activeJobs.get(jobId) || {}), status: 'cancelled', phase: 'cancelled' })
  await supabase.from('generation_jobs').update({ status: 'cancelled', phase: 'cancelled', updated_at: new Date().toISOString() }).eq('id', jobId)
  // Leave any completed chapters intact; just take the book out of "generating".
  await supabase.from('books').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', bookId)
}

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

// Concatenate every text block in the response. Real responses are not
// guaranteed to put the text in content[0] — there can be multiple text blocks,
// and (depending on settings) non-text blocks ordered before the text.
function extractText(response) {
  const blocks = Array.isArray(response?.content) ? response.content : []
  return blocks
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim()
}

// Parse error status from Anthropic SDK errors
function getErrorStatus(err) {
  // Check for status property directly
  if (typeof err?.status === 'number') return err.status
  // Check for response.status (axios/fetch style)
  if (typeof err?.response?.status === 'number') return err.response.status
  // Check for error property containing status
  if (typeof err?.error?.status === 'number') return err.error.status
  return null
}

// cachedPrefix: large content shared across many calls (e.g. bookPlan + codex
// reused for every chapter). Placed in its own cached block so the API serves it
// from cache on repeat calls instead of reprocessing it ~20+ times per book.
// metrics (optional): per-job accumulator; token usage is added to it when given.
async function callClaude(prompt, maxTokens = 3000, cachedPrefix = null, metrics = null) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key missing')
  }

  const content = []
  if (cachedPrefix) {
    content.push({ type: 'text', text: cachedPrefix, cache_control: { type: 'ephemeral' } })
  }
  content.push({ type: 'text', text: prompt })

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Anthropic timeout after 120s')), 120000)
  )

  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: [{ type: 'text', text: ARIA_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }]
      }),
      timeoutPromise
    ])

    if (response?.usage) {
      if (metrics) {
        metrics.inputTokens = (metrics.inputTokens || 0) + (response.usage.input_tokens || 0)
        metrics.outputTokens = (metrics.outputTokens || 0) + (response.usage.output_tokens || 0)
        metrics.cacheReadTokens = (metrics.cacheReadTokens || 0) + (response.usage.cache_read_input_tokens || 0)
      }
      console.log('[claude] usage', JSON.stringify(response.usage))
    }

    const text = extractText(response)
    if (!text) {
      // stop_reason "max_tokens" with no text, or an unexpected block layout.
      console.error('[claude] no text in response', JSON.stringify({ stop_reason: response?.stop_reason, types: response?.content?.map((b) => b?.type) }))
      throw new Error(`Empty Claude response (stop_reason: ${response?.stop_reason || 'unknown'})`)
    }
    return text
  } catch (err) {
    // Re-throw with enhanced error details for rate limiting
    const status = getErrorStatus(err)
    if (status === 429 || status === 529) {
      const error = new Error(`Anthropic ${status}: ${err.message}`)
      error.status = status
      error.headers = err?.headers || err?.response?.headers || {}
      throw error
    }
    throw err
  }
}

// Returns how long to wait before the next retry. For Anthropic 429 (rate
// limit) and 529 (overloaded), honor the `retry-after` header; otherwise use a
// linear/exponential backoff.
function backoffForError(err, attempt, baseMs) {
  const status = getErrorStatus(err)
  if (status === 429 || status === 529) {
    // Try to get retry-after from multiple possible locations
    let headers = err?.headers || err?.response?.headers || {}
    let retryAfter = null

    if (typeof headers.get === 'function') {
      // Headers is a fetch-style object
      retryAfter = headers.get('retry-after')
    } else if (typeof headers === 'object') {
      // Headers is a plain object
      retryAfter = headers['retry-after'] || headers['Retry-After']
    }

    const parsed = Number.parseInt(retryAfter, 10)
    const waitMs = Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : Math.min(baseMs * Math.pow(2, attempt), 60000)
    console.warn(`[anthropic] Rate limited (status: ${status}). Backing off ${waitMs}ms. Retry-After: ${retryAfter}`)
    return waitMs
  }
  return baseMs * attempt
}

async function retryCall(fn, retries = 3, backoffMs = 3000) {
  let lastError = null
  for (let i = 1; i <= retries; i += 1) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      console.warn('Retry', i, 'failed:', err.message)
      if (i < retries) {
        await sleep(backoffForError(err, i, backoffMs))
      }
    }
  }
  throw lastError
}

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value)
  } catch (err) {
    // Claude sometimes wraps JSON in markdown fences or adds stray prose.
    // Strip fences, grab the outermost JSON object/array, and remove trailing
    // commas before a closing brace/bracket (a common LLM JSON defect).
    try {
      let cleaned = String(value).trim()
      // Remove markdown code fences
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      // Find the first opening brace or bracket
      const firstBrace = cleaned.search(/[[{]/)
      // Find the last closing brace or bracket
      const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
      
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1)
      }
      
      // Remove trailing commas before closing braces/brackets
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
      // Remove commas between closing and opening braces (missing comma between objects)
      cleaned = cleaned.replace(/\}(\s*)\{/g, '},{')
      cleaned = cleaned.replace(/\](\s*)\{/g, '],{')
      cleaned = cleaned.replace(/\}(\s*)\[/g, '},{')
      // Fix single quotes to double quotes (naive approach - only for simple cases)
      // This is risky with nested content, so we only do it after trying the original clean
      
      return JSON.parse(cleaned)
    } catch (innerErr) {
      // Try one more aggressive approach: convert single quotes to double quotes
      // This is a last resort and may fail on complex strings
      try {
        let aggressive = String(value).trim()
        aggressive = aggressive.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
        const firstBrace = aggressive.search(/[[{]/)
        const lastBrace = Math.max(aggressive.lastIndexOf('}'), aggressive.lastIndexOf(']'))
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          aggressive = aggressive.slice(firstBrace, lastBrace + 1)
        }
        aggressive = aggressive.replace(/,(\s*[}\]])/g, '$1')
        aggressive = aggressive.replace(/,(\s*\}|\s*\])/g, '$1')
        // Replace 'key': with "key":
        aggressive = aggressive.replace(/'([^']*)'(\s*:)/g, '"$1"$2')
        // Replace : 'value' with : "value" (only before comma or closing brace)
        aggressive = aggressive.replace(/:\s*'([^']*?)'(\s*[,}\]])/g, ': "$1"$2')
        return JSON.parse(aggressive)
      } catch (aggressiveErr) {
        console.warn('JSON parse failed after aggressive cleanup, using fallback:', aggressiveErr.message)
        return fallback
      }
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ARIA server running on http://0.0.0.0:${PORT}`)
})
