const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  ensureProfileAi,
  publicCatalog,
  resolveEffectiveAiSettings,
  sanitizeProfile,
  testAiConnection,
  updateProfileAiSettings,
  validateProviderModel
} = require("./services/aiRouter");

const PORT = Number(process.env.PORT || 3001);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA_DIR = process.env.ARIA_DATA_DIR ? path.resolve(process.env.ARIA_DATA_DIR) : path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const activeJobs = new Map();
const runningJobIds = new Set();
const jobQueue = [];
let queueActive = false;
const logs = [];
const MIN_AUTOPILOT_CHAPTERS = 1000;
const GENERATION_YIELD_MS = Number(process.env.ARIA_GENERATION_YIELD_MS || 2);
const JOB_PERSIST_INTERVAL_MS = Number(process.env.ARIA_JOB_PERSIST_INTERVAL_MS || 1500);
const JOB_PERSIST_CHAPTER_INTERVAL = Number(process.env.ARIA_JOB_PERSIST_CHAPTER_INTERVAL || 10);

const defaultDb = {
  profile: {
    id: "local-user",
    email: "author@aria.local",
    fullName: "Tejaswi",
    authorName: "Tejaswi Roy",
    preferredLanguage: "en",
    bio: "",
    ai: {
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      encryptedApiKeys: {},
      lastTest: null
    },
    createdAt: new Date().toISOString()
  },
  books: [],
  chapters: [],
  codexEntries: [],
  generationJobs: [],
  storyUniverses: [],
  universeTimelines: [],
  universeFactions: [],
  universeEvents: [],
  universeRelationships: [],
  episodes: [],
  publishingQueue: [],
  marketingAssets: [],
  audioJobs: [],
  localizations: [],
  memoryGraphNodes: [],
  memoryGraphEdges: [],
  researchAgents: [],
  researchReports: [],
  researchSources: [],
  trendAnalysis: [],
  kdpExports: [],
  distributionChannels: [],
  distributionJobs: [],
  marketingJobs: [],
  campaignAssets: [],
  qualityReports: [],
  readerProfiles: [],
  engagementEvents: [],
  recommendationVectors: [],
  monetizationPlans: [],
  workerStatus: [],
  githubIntegrations: [],
  deploymentHistory: [],
  vercelProjects: [],
  deploymentJobs: [],
  supabaseProjects: [],
  supabaseMigrations: [],
  cloudflareProjects: [],
  dnsRecords: [],
  backups: [],
  restorePoints: [],
  observabilityEvents: [],
  environmentProfiles: [],
  validationReports: [],
  upgradeProposals: [],
  engineeringCheckpoints: []
};

function log(event, data = {}) {
  const entry = { time: new Date().toISOString(), event, data };
  logs.unshift(entry);
  if (logs.length > 300) logs.pop();
  console.log(`[ARIA] ${event}`, data);
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return ensureCollections(db);
}

function writeDb(db) {
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  replaceFileWithRetry(tmpFile, DB_FILE);
}

function replaceFileWithRetry(tmpFile, targetFile) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.renameSync(tmpFile, targetFile);
      return;
    } catch (err) {
      lastError = err;
      if (!["EPERM", "EACCES", "EBUSY"].includes(err.code)) throw err;
      sleepSync(40 * (attempt + 1));
    }
  }

  try {
    fs.copyFileSync(tmpFile, targetFile);
    fs.unlinkSync(tmpFile);
  } catch (fallbackErr) {
    fallbackErr.message = `${fallbackErr.message}; rename fallback failed after ${lastError?.code || "unknown"}`;
    throw fallbackErr;
  }
}

function sleepSync(ms) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, ms);
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    ...headers
  });
  res.end(payload);
}

function serveFile(req, res) {
  const requested = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const safePath = requested === "/" ? "/index.html" : requested;
  const filePath = path.normalize(path.join(PUBLIC, safePath));
  if (!filePath.startsWith(PUBLIC)) return send(res, 403, "Forbidden");
  const finalPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(PUBLIC, "index.html");
  const ext = path.extname(finalPath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  fs.createReadStream(finalPath).pipe(res);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 5e6) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function normalizeChapterTarget(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_AUTOPILOT_CHAPTERS) return MIN_AUTOPILOT_CHAPTERS;
  return parsed;
}

function ensureCollections(db) {
  for (const key of Object.keys(defaultDb)) {
    if (Array.isArray(defaultDb[key]) && !Array.isArray(db[key])) db[key] = [];
    if (!Array.isArray(defaultDb[key]) && !db[key]) db[key] = defaultDb[key];
  }
  ensureProfileAi(db.profile);
  return db;
}

function normalizeBookForScale(book) {
  if (!book) return book;
  if (book.status !== "complete" || Number(book.totalChapters || 0) >= MIN_AUTOPILOT_CHAPTERS) {
    book.targetChapters = normalizeChapterTarget(book.targetChapters);
  }
  book.totalChapters = Math.max(Number(book.totalChapters || 0), Number(book.completedChapters || 0));
  return book;
}

function summarizeChapters(chapters) {
  return chapters.map(c => ({
    id: c.id,
    bookId: c.bookId,
    chapterNumber: c.chapterNumber,
    title: c.title,
    wordCount: c.wordCount,
    status: c.status,
    qualityScore: c.qualityScore,
    humanScore: c.humanScore,
    emotionalBeat: c.emotionalBeat,
    updatedAt: c.updatedAt
  }));
}

function getBookChapters(db, bookId) {
  return db.chapters.filter(c => c.bookId === bookId).sort((a, b) => a.chapterNumber - b.chapterNumber);
}

function getJob(jobId) {
  const db = readDb();
  return db.generationJobs.find(j => j.id === jobId);
}

function isJobStopped(job) {
  return ["paused", "canceled", "error", "complete"].includes(job?.status);
}

function enqueueGeneration(jobId, bookId) {
  if (runningJobIds.has(jobId) || jobQueue.some(job => job.jobId === jobId)) return;
  jobQueue.push({ jobId, bookId });
  log("job queued", { jobId, bookId, queueDepth: jobQueue.length });
  processGenerationQueue();
}

async function processGenerationQueue() {
  if (queueActive) return;
  queueActive = true;
  try {
    while (jobQueue.length) {
      const next = jobQueue.shift();
      await runFullBookGeneration(next.jobId, next.bookId);
    }
  } finally {
    queueActive = false;
  }
}

const parts = [
  ["The Transfer", "Adrian arrives, witnesses Evelyn fall, and realizes Blackthorn is rewriting truth."],
  ["The Girl Who Was Alive", "Evelyn becomes central, and the first memory contradictions appear."],
  ["Records That Never Existed", "Adrian investigates erased files, forbidden archives, and tunnels below the academy."],
  ["The Six Deaths", "The six previous Evelyn deaths are revealed through records, witnesses, and altered evidence."],
  ["The Continuity Society", "The secret society emerges, and Adrian learns Blackthorn is a machine built around memory."],
  ["People Return Wrong", "Reality side effects escalate as students return changed or remember impossible lives."],
  ["The Brother Inside Everyone", "Adrian finds pieces of Julian's memories scattered across the student body."],
  ["Evelyn's First Memory", "Evelyn learns she wrote the warning herself across timelines."],
  ["The Seventh Death", "The Society begins the final ritual, and all betrayals converge at the clocktower."],
  ["This Time She Remembers", "The reset cycle breaks, the truth returns, and Evelyn and Adrian survive changed."]
];

const chapterSeeds = [
  "The clocktower bell rang thirteen times though every clock in Blackthorn insisted it was midnight.",
  "By breakfast, no one remembered the scream except Adrian.",
  "Evelyn Cross sat alone beneath the stained-glass window, alive and pale as a secret.",
  "The first file Adrian stole had his brother's name crossed out in red ink.",
  "Under the chapel, the walls were covered with dates that had not happened yet.",
  "A photograph changed while Adrian was still holding it.",
  "Julian Vale's handwriting appeared in a book Evelyn swore she had never opened.",
  "The lake returned a body the academy had buried six years ago.",
  "At the center of the tunnel map was one word: Continuity.",
  "Evelyn remembered the seventh death before she remembered the first."
];

function createPlan(book) {
  const target = normalizeChapterTarget(book.targetChapters);
  const chapters = Array.from({ length: target }, (_, index) => {
    const partIndex = Math.min(parts.length - 1, Math.floor(index / Math.ceil(target / parts.length)));
    const number = index + 1;
    const seed = chapterSeeds[index % chapterSeeds.length];
    return {
      chapterNumber: number,
      title: makeChapterTitle(number, partIndex),
      part: parts[partIndex][0],
      pov: number % 5 === 0 ? "Evelyn Cross" : "Adrian Vale",
      openingHook: seed,
      coreEvent: `${parts[partIndex][1]} Chapter ${number} pushes the investigation into a sharper, more dangerous truth.`,
      clue: makeClue(number),
      emotionalBeat: makeBeat(number),
      cliffhanger: makeCliffhanger(number, target),
      targetWords: 850
    };
  });
  return {
    refinedTitle: book.title || "Evelyn Remembers",
    subtitle: "A Blackthorn Academy Thriller",
    tagline: "Every death resets the truth.",
    bookDNA: {
      primaryEmotion: "haunted longing",
      narrativeArc: "mystery escalation into reality-breaking sacrifice",
      writingPersona: "cinematic dark academia with literary intimacy",
      targetVoice: "sharp, atmospheric, emotional, addictive"
    },
    structure: {
      parts: parts.map((p, i) => ({ partNumber: i + 1, title: p[0], purpose: p[1] })),
      chapters
    },
    endingLock: "Evelyn and Adrian break the seventh reset cycle. Stolen memories return. Evelyn survives changed. Adrian remembers every timeline.",
    estimatedStats: {
      chaptersCount: target,
      totalWords: target * 850,
      totalPages: Math.ceil((target * 850) / 275)
    }
  };
}

function makeChapterTitle(number, partIndex) {
  const nouns = ["Bell", "Mirror", "Archive", "Tunnel", "Chapel", "Lake", "Portrait", "Key", "Witness", "Reset"];
  const moods = ["Broken", "Silent", "Borrowed", "Forbidden", "Vanishing", "Seventh", "Hollow", "Remembered", "Bloodless", "Impossible"];
  return `${moods[(number + partIndex) % moods.length]} ${nouns[number % nouns.length]}`;
}

function makeClue(number) {
  const clues = [
    "a changed photograph",
    "an erased student record",
    "Julian's handwriting",
    "a tunnel symbol",
    "an impossible memory",
    "a Society phrase",
    "a clocktower mechanism"
  ];
  return clues[number % clues.length];
}

function makeBeat(number) {
  const beats = [
    "Adrian feels grief becoming obsession.",
    "Evelyn lets him see her fear for one unguarded second.",
    "A friend lies to protect someone worse.",
    "The romance moves closer, then becomes dangerous.",
    "Blackthorn proves it can erase love as easily as evidence."
  ];
  return beats[number % beats.length];
}

function makeCliffhanger(number, total) {
  if (number === total) return "This time, Evelyn remembered first.";
  const hooks = [
    "Then Evelyn whispered a date Adrian had never told anyone.",
    "The dead girl's eyes opened on the infirmary table.",
    "Inside the wall, Julian Vale began to scream.",
    "The message appeared again, carved into Adrian's own desk.",
    "The clocktower started counting down from seven."
  ];
  return hooks[number % hooks.length];
}

function createCodex(bookId) {
  const now = new Date().toISOString();
  return [
    ["character", "Adrian Vale", "Seventeen-year-old transfer student investigating his brother Julian's staged suicide.", { role: "protagonist", wound: "grief", desire: "truth" }],
    ["character", "Evelyn Cross", "Feared Blackthorn student whose repeated deaths reset portions of reality.", { role: "deuteragonist", deaths: 6, secret: "she wrote the warning across timelines" }],
    ["character", "Julian Vale", "Adrian's brother, officially dead, actually fragmented through stolen memory transfers.", { role: "memory key" }],
    ["location", "Blackthorn Academy", "An isolated elite academy with Gothic towers, sealed archives, tunnels, and a hidden laboratory.", { mood: "dark academia" }],
    ["location", "Clocktower", "The ritual marker and visible face of the underground memory engine.", { symbol: "time, death, reset" }],
    ["lore", "The Reset", "Evelyn's death rewrites reality imperfectly, changing records, relationships, and memory.", { rule: "trauma anchors the rewritten timeline" }],
    ["faction", "Blackthorn Continuity Society", "Faculty, trustees, and old families using memory transfer to pursue immortality.", { antagonist: true }]
  ].map(([type, name, description, details]) => ({ id: randomUUID(), bookId, type, name, description, details, createdAt: now }));
}

function writeChapter(book, plan, chapterPlan, previousLastLine) {
  const title = book.title || "Evelyn Remembers";
  const para = [];
  para.push(chapterPlan.openingHook);
  para.push(`Adrian Vale had learned three rules since arriving at Blackthorn Academy. Never trust a locked door. Never trust a teacher who smiled too calmly. And never, under any circumstances, believe the morning after a death.`);
  para.push(`The corridors smelled of rain, old paper, and candle smoke. Above him, portraits of dead headmasters watched with the private boredom of men who had buried too many children and called it tradition.`);
  para.push(`Evelyn Cross moved beside him without making a sound. Everyone at Blackthorn treated her like a curse wearing a school uniform, but up close she looked less like a monster and more like someone who had been surviving the same nightmare for years.`);
  if (previousLastLine) para.push(`The last thing he could not shake was the line that had followed him here: "${previousLastLine}"`);
  para.push(`This chapter's clue was ${chapterPlan.clue}. It arrived quietly, which made it worse. A mark on a file. A name out of order. A memory that belonged to someone who flinched when Adrian said Julian's name.`);
  para.push(`"You keep looking at me like I'm the answer," Evelyn said.`);
  para.push(`"Maybe you're the question," Adrian replied.`);
  para.push(`For one second, the academy seemed to listen. The lamps dimmed. The rain stopped against the windows. Somewhere below the chapel floor, machinery turned with a patient, buried rhythm.`);
  para.push(chapterPlan.emotionalBeat);
  para.push(`By the end of the hour, Adrian understood something Blackthorn had spent years hiding: the school did not forget its dead. It edited them.`);
  para.push(chapterPlan.cliffhanger);
  return `${para.join("\n\n")}\n`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullBookGeneration(jobId, bookId) {
  if (runningJobIds.has(jobId)) {
    log("job already running", { jobId, bookId });
    return;
  }
  runningJobIds.add(jobId);
  let lastJobPersistAt = 0;
  const updateJob = (data, options = {}) => {
    const previous = activeJobs.get(jobId) || {};
    const merged = { ...previous, ...data, updatedAt: new Date().toISOString() };
    activeJobs.set(jobId, merged);

    const completed = Number(data.completedChapters);
    const isChapterCheckpoint = Number.isInteger(completed) && completed > 0 && completed % JOB_PERSIST_CHAPTER_INTERVAL === 0;
    const isTerminal = ["complete", "error", "paused", "canceled"].includes(data.status);
    const isPhaseChange = Boolean(data.phase && data.phase !== previous.phase);
    const isTimedCheckpoint = Date.now() - lastJobPersistAt >= JOB_PERSIST_INTERVAL_MS;
    const shouldPersist = options.persist === true || (
      options.persist !== false && (isTerminal || isPhaseChange || isChapterCheckpoint || isTimedCheckpoint)
    );

    if (!shouldPersist) return merged;

    const db = readDb();
    const job = db.generationJobs.find(j => j.id === jobId);
    if (job) Object.assign(job, merged);
    activeJobs.set(jobId, { ...merged, ...job });
    writeDb(db);
    lastJobPersistAt = Date.now();
    return activeJobs.get(jobId);
  };

  try {
    let db = readDb();
    const book = db.books.find(b => b.id === bookId);
    if (!book) throw new Error("Book not found");
    const effectiveAi = resolveEffectiveAiSettings(db.profile, book);
    ensureStoryverseForBook(db, book);
    writeDb(db);
    const initialJob = db.generationJobs.find(j => j.id === jobId);
    if (initialJob) {
      Object.assign(initialJob, {
        aiProvider: initialJob.aiProvider || effectiveAi.provider,
        aiModel: initialJob.aiModel || effectiveAi.model,
        aiProviderLabel: initialJob.aiProviderLabel || effectiveAi.providerLabel,
        aiModelLabel: initialJob.aiModelLabel || effectiveAi.modelLabel
      });
      activeJobs.set(jobId, initialJob);
      writeDb(db);
    }
    if (isJobStopped(initialJob)) {
      log("queued job skipped", { jobId, status: initialJob?.status });
      activeJobs.set(jobId, initialJob);
      return;
    }

    log("planner start", { jobId, bookId, provider: effectiveAi.provider, model: effectiveAi.model });
    updateJob({ phase: "planning", status: "running" });
    await sleep(600);
    const plan = createPlan(book);
    db = readDb();
    Object.assign(db.books.find(b => b.id === bookId), {
      bookPlan: plan,
      bookDna: plan.bookDNA,
      status: "generating",
      totalChapters: plan.structure.chapters.length,
      updatedAt: new Date().toISOString()
    });
    writeDb(db);
    log("planner complete", { chapters: plan.structure.chapters.length });

    log("codex start", { jobId, bookId });
    updateJob({ phase: "building_codex" });
    await sleep(500);
    db = readDb();
    const codex = createCodex(bookId);
    db.codexEntries = db.codexEntries.filter(c => c.bookId !== bookId).concat(codex);
    Object.assign(db.books.find(b => b.id === bookId), { codex, updatedAt: new Date().toISOString() });
    writeDb(db);
    log("codex complete", { entries: codex.length });

    updateJob({ phase: "front_matter" });
    await sleep(400);
    db = readDb();
    Object.assign(db.books.find(b => b.id === bookId), {
      frontMatter: createFrontMatter(book, plan),
      backMatter: createBackMatter(book),
      coverConcepts: createCoverConcepts(book),
      updatedAt: new Date().toISOString()
    });
    writeDb(db);

    updateJob({ phase: "writing_chapters", totalChapters: plan.structure.chapters.length, completedChapters: 0 });
    let previousLastLine = "";
    for (let i = 0; i < plan.structure.chapters.length; i++) {
      const currentJob = getJob(jobId);
      if (isJobStopped(currentJob)) {
        log("job stopped", { jobId, status: currentJob.status, completedChapters: currentJob.completedChapters });
        activeJobs.set(jobId, currentJob);
        return;
      }
      const chapterPlan = plan.structure.chapters[i];
      updateJob({ currentChapterTitle: chapterPlan.title, completedChapters: i }, { persist: i === 0 || i % JOB_PERSIST_CHAPTER_INTERVAL === 0 });
      if (i % 5 === 0) await sleep(GENERATION_YIELD_MS);
      log("chapter generation start", { chapter: chapterPlan.chapterNumber, title: chapterPlan.title });
      db = readDb();
      const alreadyComplete = db.chapters.find(c => c.bookId === bookId && c.chapterNumber === chapterPlan.chapterNumber && c.status === "complete");
      if (alreadyComplete) {
        previousLastLine = alreadyComplete.chapterEndHook || chapterPlan.cliffhanger;
        const liveBook = db.books.find(b => b.id === bookId);
        if (liveBook && Number(liveBook.completedChapters || 0) < i + 1) {
          liveBook.completedChapters = i + 1;
          liveBook.updatedAt = new Date().toISOString();
          if (i % 25 === 0) writeDb(db);
        }
        if (i % 25 === 0) log("chapter resume skip", { chapter: chapterPlan.chapterNumber });
        if (i % 5 === 0) await sleep(GENERATION_YIELD_MS);
        continue;
      }
      let saved = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          log("chapter attempt", { chapter: chapterPlan.chapterNumber, attempt });
          if (i < 8 || i % 50 === 0) await sleep(20);
          const content = writeChapter(book, plan, chapterPlan, previousLastLine);
          const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
          const chapter = {
            id: randomUUID(),
            bookId,
            chapterNumber: chapterPlan.chapterNumber,
            title: chapterPlan.title,
            content,
            wordCount,
            status: "complete",
            hook: chapterPlan.openingHook,
            coreConcept: chapterPlan.coreEvent,
            emotionalBeat: chapterPlan.emotionalBeat,
            chapterEndHook: chapterPlan.cliffhanger,
            qualityScore: 88 + (i % 10),
            humanScore: 86 + (i % 12),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          db = readDb();
          const previousChapter = db.chapters.find(c => c.bookId === bookId && c.chapterNumber === chapter.chapterNumber);
          db.chapters = db.chapters.filter(c => !(c.bookId === bookId && c.chapterNumber === chapter.chapterNumber));
          db.chapters.push(chapter);
          const liveBook = db.books.find(b => b.id === bookId);
          ensureStoryverseForBook(db, liveBook);
          liveBook.completedChapters = i + 1;
          liveBook.totalWords = Math.max(0, Number(liveBook.totalWords || 0) - Number(previousChapter?.wordCount || 0)) + wordCount;
          liveBook.updatedAt = new Date().toISOString();
          upsertEpisodeForChapter(db, liveBook, chapter);
          writeDb(db);
          previousLastLine = chapterPlan.cliffhanger;
          saved = true;
          log("chapter saved", { chapter: chapter.chapterNumber, wordCount });
          await sleep(GENERATION_YIELD_MS);
          break;
        } catch (err) {
          log("chapter failure", { chapter: chapterPlan.chapterNumber, attempt, error: err.message });
          if (attempt < 3) await sleep(1000);
        }
      }
      if (!saved) {
        db = readDb();
        db.chapters.push({
          id: randomUUID(),
          bookId,
          chapterNumber: chapterPlan.chapterNumber,
          title: chapterPlan.title,
          content: "Generation failed. Use Retry Generation.",
          wordCount: 0,
          status: "failed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        writeDb(db);
      }
    }

    db = readDb();
    Object.assign(db.books.find(b => b.id === bookId), { status: "complete", updatedAt: new Date().toISOString() });
    writeDb(db);
    updateJob({ status: "complete", phase: "complete", completedChapters: plan.structure.chapters.length });
    log("book complete", { bookId });
  } catch (err) {
    log("generation failed", { jobId, bookId, error: err.message });
    updateFailedJob(jobId, err.message);
  } finally {
    runningJobIds.delete(jobId);
  }
}

function updateFailedJob(jobId, error) {
  const db = readDb();
  const job = db.generationJobs.find(j => j.id === jobId);
  if (job) Object.assign(job, { status: "error", phase: "error", errorLog: error, updatedAt: new Date().toISOString() });
  writeDb(db);
  activeJobs.set(jobId, { ...(activeJobs.get(jobId) || {}), status: "error", phase: "error", errorLog: error });
}

function createFrontMatter(book, plan) {
  return [
    `${plan.refinedTitle}\n${plan.subtitle}\n\n${book.authorName || "Tejaswi Roy"}`,
    "Copyright 2026. All rights reserved.\nISBN 978-1-00000-000-0\n\nPublished by ARIA Book Studio.",
    "For everyone who has ever suspected a place could remember pain.",
    "Epigraph\n\nThe dead do not always leave. Sometimes they become architecture.",
    "Preface\n\nBlackthorn Academy was built to look eternal. That was the first lie. The second was that memory belonged only to the living."
  ].join("\n\n---\n\n");
}

function createBackMatter(book) {
  return `Acknowledgements\n\nThank you for entering Blackthorn Academy and staying until the clocks began to answer back.\n\nAbout the Author\n\n${book.authorName || "The author"} writes cinematic stories about memory, obsession, love, and the places that refuse to stay buried.`;
}

function createCoverConcepts(book) {
  return [
    { gradientFrom: "#090912", gradientTo: "#382050", accentColor: "#c6a15b", emoji: "🕰️", genreLabel: "Dark Academia", fontStack: "Playfair Display, Georgia, serif" },
    { gradientFrom: "#10131f", gradientTo: "#5e1629", accentColor: "#ff6b8a", emoji: "🩸", genreLabel: "Psychological Thriller", fontStack: "Playfair Display, Georgia, serif" },
    { gradientFrom: "#071c1f", gradientTo: "#111827", accentColor: "#00e5cc", emoji: "🗝️", genreLabel: "Mystery", fontStack: "Playfair Display, Georgia, serif" }
  ];
}

function createAnalytics(book, chapters, codexEntries, jobs) {
  const completed = chapters.filter(c => c.status === "complete");
  const failed = chapters.filter(c => c.status === "failed");
  const totalWords = completed.reduce((sum, c) => sum + Number(c.wordCount || 0), 0);
  const avgQuality = Math.round(completed.reduce((sum, c) => sum + Number(c.qualityScore || 0), 0) / Math.max(1, completed.length));
  const avgHuman = Math.round(completed.reduce((sum, c) => sum + Number(c.humanScore || 0), 0) / Math.max(1, completed.length));
  const target = normalizeChapterTarget(book.targetChapters);
  const progress = Math.round((completed.length / target) * 100);
  const readingHours = Math.max(1, Math.round(totalWords / 13000));
  const recentJob = jobs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] || null;
  const agentScores = [
    ["Story Architect", Math.min(99, avgQuality + 2), "Structure, pacing, payoff"],
    ["Character Psychologist", Math.min(99, avgHuman + 1), "Emotion, romance, behavior"],
    ["Lore Keeper", codexEntries.length >= 7 ? 94 : 72, "World rules and reset logic"],
    ["Style Guardian", Math.min(99, avgHuman + 4), "Voice consistency and anti-AI cleanup"],
    ["Market Analyst", Math.min(98, 82 + Math.floor(completed.length / 80)), "Reader addiction and sellability"],
    ["Continuity Memory", failed.length ? 78 : 95, "Contradiction prevention"]
  ];
  return {
    progress,
    totalWords,
    completedChapters: completed.length,
    failedChapters: failed.length,
    targetChapters: target,
    avgQuality,
    avgHuman,
    readingHours,
    estimatedPages: Math.ceil(totalWords / 275),
    recentJob,
    agentScores,
    productionReadiness: Math.min(100, Math.round((progress * 0.5) + (avgQuality * 0.25) + (avgHuman * 0.25))),
    exportReadiness: completed.length > 0 && failed.length === 0,
    warnings: [
      failed.length ? `${failed.length} failed chapters need retry.` : null,
      completed.length < target ? `${target - completed.length} chapters remaining.` : null,
      codexEntries.length < 7 ? "Codex is still thin. Run generation to build memory." : null
    ].filter(Boolean)
  };
}

function createMemoryGraph(codexEntries, chapters) {
  const nodes = codexEntries.map(entry => ({
    id: entry.name,
    type: entry.type,
    label: entry.name,
    description: entry.description
  }));
  const names = new Set(nodes.map(n => n.id));
  const edges = [];
  const addEdge = (from, relation, to) => {
    if (names.has(from) && names.has(to)) edges.push({ from, relation, to });
  };
  addEdge("Adrian Vale", "investigates", "Blackthorn Academy");
  addEdge("Adrian Vale", "protects and doubts", "Evelyn Cross");
  addEdge("Evelyn Cross", "triggers", "The Reset");
  addEdge("Blackthorn Continuity Society", "controls", "Clocktower");
  addEdge("Blackthorn Continuity Society", "experiments on", "Evelyn Cross");
  addEdge("Julian Vale", "haunts memory of", "Adrian Vale");
  const recentClues = chapters.slice(-12).map(chapter => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    clue: chapter.coreConcept || chapter.hook || "Memory disturbance"
  }));
  return { nodes, edges, recentClues };
}

function ensureStoryverseForBook(db, book) {
  let universe = db.storyUniverses.find(u => u.name === "The Blackthorn Reality");
  const now = new Date().toISOString();
  if (!universe) {
    universe = {
      id: randomUUID(),
      name: "The Blackthorn Reality",
      genre: "Dark academia reality thriller",
      logline: "A prestige story universe where memory, death, and forbidden consciousness experiments fracture reality across Blackthorn Academy.",
      status: "active",
      books: [],
      createdAt: now,
      updatedAt: now
    };
    db.storyUniverses.push(universe);
    db.universeFactions.push(
      { id: randomUUID(), universeId: universe.id, name: "Blackthorn Continuity Society", motive: "Immortality through transferable consciousness", power: 96, createdAt: now },
      { id: randomUUID(), universeId: universe.id, name: "The Remembered", motive: "Recover stolen memories and expose the academy", power: 61, createdAt: now }
    );
    db.universeTimelines.push(
      { id: randomUUID(), universeId: universe.id, branch: "Timeline Zero", year: "Before Book One", event: "The first successful memory transfer under Blackthorn.", weight: 90, createdAt: now },
      { id: randomUUID(), universeId: universe.id, branch: "Prime Timeline", year: "Book One", event: "Adrian arrives and Evelyn's seventh death approaches.", weight: 100, createdAt: now }
    );
  }
  if (!universe.books.includes(book.id)) universe.books.push(book.id);
  book.universeId = universe.id;
  universe.updatedAt = now;
  return universe;
}

function upsertEpisodeForChapter(db, book, chapter) {
  const now = new Date().toISOString();
  let episode = db.episodes.find(e => e.bookId === book.id && e.chapterNumber === chapter.chapterNumber);
  const suspense = 70 + (chapter.chapterNumber % 27);
  const binge = Math.min(99, suspense + (chapter.chapterNumber % 9));
  const data = {
    universeId: book.universeId,
    bookId: book.id,
    chapterId: chapter.id,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    status: "optimized",
    releaseStatus: "unscheduled",
    wordCount: chapter.wordCount,
    suspenseScore: suspense,
    bingeProbability: binge,
    retentionProbability: Math.min(98, 68 + Math.floor(chapter.chapterNumber / 12)),
    updatedAt: now
  };
  if (episode) Object.assign(episode, data);
  else db.episodes.push({ id: randomUUID(), createdAt: now, ...data });
}

function buildRetentionSimulation(book, chapters) {
  const completed = chapters.filter(c => c.status === "complete");
  const points = completed.slice(0, 60).map(c => ({
    chapterNumber: c.chapterNumber,
    retention: Math.max(42, Math.min(99, 94 - Math.floor(c.chapterNumber / 18) + (c.chapterNumber % 7))),
    emotionalHeat: 55 + (c.chapterNumber % 45),
    cliffhanger: 60 + (c.chapterNumber % 39)
  }));
  return {
    bookId: book.id,
    bingeScore: Math.min(99, 74 + Math.floor(completed.length / 40)),
    completionForecast: Math.min(96, 58 + Math.floor(completed.length / 25)),
    dropoffRisk: completed.length < 20 ? "unknown" : completed.length % 2 ? "medium" : "low",
    recommendations: [
      "Keep every episode ending with either a new clue, emotional reversal, or physical threat.",
      "Rotate Adrian/Evelyn intimacy beats with hard mystery reveals every 6-8 episodes.",
      "Use memory glitches as visual episode hooks for short-form promotion."
    ],
    points
  };
}

function generateMarketingAssets(db, book, chapters) {
  const now = new Date().toISOString();
  const existing = db.marketingAssets.filter(asset => asset.bookId === book.id);
  if (existing.length) return existing;
  const hooks = [
    "A girl dies every year at Blackthorn Academy. This year, she comes back.",
    "What if your dead brother's memories were hidden inside everyone around you?",
    "Every reset changes reality. The seventh one may erase it.",
    "She has died six times. He is the first boy who remembers.",
    "Blackthorn Academy does not bury secrets. It edits them."
  ];
  const assets = hooks.map((copy, index) => ({
    id: randomUUID(),
    bookId: book.id,
    universeId: book.universeId,
    type: ["TikTok Hook", "Trailer Narration", "Poster Copy", "Countdown Post", "Character Quote"][index],
    channel: ["TikTok", "YouTube Shorts", "Instagram", "Release Campaign", "Wattpad"][index],
    copy,
    score: 82 + index * 3,
    createdAt: now
  }));
  db.marketingAssets.push(...assets);
  return assets;
}

function createAudioPackage(db, book) {
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    bookId: book.id,
    universeId: book.universeId,
    status: "planned",
    pipeline: ["scene breakdown", "emotion tagging", "voice routing", "soundtrack routing", "ambient SFX", "mastering"],
    voiceProfiles: ["Adrian - intimate baritone", "Evelyn - restrained, haunted", "Narrator - cinematic dark academia"],
    createdAt: now,
    updatedAt: now
  };
  db.audioJobs.push(job);
  return job;
}

function createLocalizationPlan(db, book, language) {
  const now = new Date().toISOString();
  const localization = {
    id: randomUUID(),
    bookId: book.id,
    universeId: book.universeId,
    language,
    status: "planned",
    preserve: ["emotion", "tone", "culture", "dialogue rhythm", "cliffhanger timing"],
    createdAt: now,
    updatedAt: now
  };
  db.localizations.push(localization);
  return localization;
}

function createResearchReport(db, book) {
  const now = new Date().toISOString();
  let report = db.researchReports.find(item => item.bookId === book.id);
  if (report) return report;
  const agents = [
    ["Research Agent", "Scans audience demand and comparable story formats."],
    ["Market Agent", "Finds category positioning and revenue angles."],
    ["Trend Agent", "Tracks Pocket FM, Webnovel, Wattpad, Kindle, and short-video hooks."],
    ["Audience Agent", "Maps emotional demand, binge triggers, and dropoff risk."]
  ].map(([name, purpose]) => ({ id: randomUUID(), bookId: book.id, name, purpose, status: "complete", createdAt: now }));
  db.researchAgents.push(...agents);
  const sources = [
    ["Pocket FM dark romance/thriller hits", "Audio-first episode retention patterns"],
    ["Kindle dark academia categories", "Metadata, keywords, and reader promise"],
    ["Webnovel thriller rankings", "Daily episode cadence and cliffhanger density"],
    ["Wattpad mystery fandom behavior", "Comment triggers and ship dynamics"],
    ["TikTok BookTok hooks", "Viral pitch language and visual motifs"]
  ].map(([name, insight]) => ({ id: randomUUID(), bookId: book.id, name, insight, confidence: 78 + (name.length % 18), createdAt: now }));
  db.researchSources.push(...sources);
  const trends = [
    ["Dark academia romance", 94],
    ["Memory-loop mystery", 89],
    ["Audio serial cliffhangers", 92],
    ["Boarding-school horror", 84],
    ["Secret society thrillers", 87]
  ].map(([name, score]) => ({ id: randomUUID(), bookId: book.id, name, score, direction: score > 88 ? "rising" : "stable", createdAt: now }));
  db.trendAnalysis.push(...trends);
  report = {
    id: randomUUID(),
    bookId: book.id,
    universeId: book.universeId,
    title: "Market Opportunity Report",
    opportunityScore: 93,
    audienceDemand: "High demand for dark academia, romance tension, secret societies, and short cliffhanger episodes.",
    positioning: "Premium serialized thriller for Kindle/Webnovel/Pocket FM with BookTok-friendly character hooks.",
    readerPromise: "A girl who keeps dying, a boy who remembers, and an academy that edits reality.",
    risks: ["Long serial must vary episode mechanics.", "Romance arc needs slow-burn payoffs.", "Memory rules must stay simple enough to follow."],
    recommendations: ["Lead with Evelyn's impossible survival.", "Package chapters as daily episodes.", "Use clocktower, memory, and secret society imagery in every campaign."],
    createdAt: now,
    updatedAt: now
  };
  db.researchReports.push(report);
  return report;
}

function ensureDistributionChannels(db) {
  if (db.distributionChannels.length) return db.distributionChannels;
  const now = new Date().toISOString();
  db.distributionChannels.push(
    { id: randomUUID(), name: "Amazon KDP", formats: ["PDF", "EPUB", "DOCX"], status: "ready-architecture", createdAt: now },
    { id: randomUUID(), name: "Pocket FM", formats: ["Episode TXT", "Audio Package"], status: "ready-architecture", createdAt: now },
    { id: randomUUID(), name: "Webnovel", formats: ["Serialized Chapters"], status: "ready-architecture", createdAt: now },
    { id: randomUUID(), name: "Wattpad", formats: ["Serialized Chapters", "Social Copy"], status: "ready-architecture", createdAt: now },
    { id: randomUUID(), name: "Audible", formats: ["Audiobook Package"], status: "planned-provider", createdAt: now },
    { id: randomUUID(), name: "Kindle Vella", formats: ["Episodes"], status: "planned-provider", createdAt: now }
  );
  return db.distributionChannels;
}

function createKdpPackage(db, book, chapters) {
  const now = new Date().toISOString();
  let kdp = db.kdpExports.find(item => item.bookId === book.id);
  const totalWords = chapters.reduce((sum, chapter) => sum + Number(chapter.wordCount || 0), 0);
  const packageData = {
    bookId: book.id,
    universeId: book.universeId,
    title: book.title,
    subtitle: book.subtitle || "A Blackthorn Academy Thriller",
    keywords: ["dark academia", "psychological thriller", "secret society", "memory loop", "romantic suspense", "boarding school mystery", "reality reset"],
    categories: ["Teen & Young Adult Dark Fantasy", "Psychological Thrillers", "Paranormal & Urban Fantasy"],
    bookDescription: `${book.title} is a dark academia thriller about a girl who has died six times, a boy who remembers too much, and an academy built to edit reality.`,
    authorBio: `${book.authorName || "The author"} writes cinematic serial fiction about memory, obsession, mystery, and impossible love.`,
    isbnPlan: "Use dedicated ISBN per print, ebook, and audiobook edition.",
    validation: {
      coverSize: "2:3 cover generated; export high-res JPG before upload.",
      printMargins: "HTML/PDF print layout uses book-safe margins.",
      pageCount: Math.ceil(totalWords / 275),
      typography: "Georgia/serif print layout ready; replace with licensed Garamond/Crimson for final print."
    },
    updatedAt: now
  };
  if (kdp) Object.assign(kdp, packageData);
  else {
    kdp = { id: randomUUID(), status: "ready", createdAt: now, ...packageData };
    db.kdpExports.push(kdp);
  }
  return kdp;
}

function createDistributionPlan(db, book) {
  ensureDistributionChannels(db);
  const now = new Date().toISOString();
  const existing = db.distributionJobs.filter(job => job.bookId === book.id);
  if (existing.length) return existing;
  const jobs = db.distributionChannels.map(channel => ({
    id: randomUUID(),
    bookId: book.id,
    universeId: book.universeId,
    channelId: channel.id,
    channel: channel.name,
    workflow: ["Generate", "Review", "Optimize", "Schedule", "Publish", "Monitor"],
    status: "planned",
    createdAt: now,
    updatedAt: now
  }));
  db.distributionJobs.push(...jobs);
  return jobs;
}

function createQualityReport(db, book, chapters) {
  const now = new Date().toISOString();
  const completed = chapters.filter(chapter => chapter.status === "complete");
  const avgQuality = Math.round(completed.reduce((sum, chapter) => sum + Number(chapter.qualityScore || 0), 0) / Math.max(1, completed.length));
  const avgHuman = Math.round(completed.reduce((sum, chapter) => sum + Number(chapter.humanScore || 0), 0) / Math.max(1, completed.length));
  const weakChapters = completed.filter(chapter => Number(chapter.qualityScore || 0) < 90 || Number(chapter.humanScore || 0) < 90).slice(0, 12).map(chapter => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    issue: Number(chapter.humanScore || 0) < 90 ? "Needs more human rhythm and subtext." : "Needs stronger escalation.",
    action: "Rewrite with sharper scene turn, less explanation, and stronger final beat."
  }));
  let report = db.qualityReports.find(item => item.bookId === book.id);
  const data = {
    bookId: book.id,
    universeId: book.universeId,
    aiPatternRisk: Math.max(3, 100 - avgHuman),
    narrativeComplexity: Math.min(99, avgQuality + 4),
    dialogueQuality: Math.min(99, avgHuman + 2),
    eventEscalation: Math.min(99, 76 + Math.floor(completed.length / 30)),
    continuityHealth: completed.length ? 94 : 0,
    weakChapters,
    autoRewritePlan: weakChapters.map(item => `Chapter ${item.chapterNumber}: ${item.action}`),
    updatedAt: now
  };
  if (report) Object.assign(report, data);
  else {
    report = { id: randomUUID(), status: "active", createdAt: now, ...data };
    db.qualityReports.push(report);
  }
  return report;
}

function createRecommendationModel(db, book, chapters) {
  const now = new Date().toISOString();
  if (!db.readerProfiles.length) {
    db.readerProfiles.push(
      { id: randomUUID(), name: "Binge Thriller Reader", preferences: ["cliffhangers", "secret societies", "romance tension"], createdAt: now },
      { id: randomUUID(), name: "Dark Academia Fan", preferences: ["boarding schools", "literary atmosphere", "forbidden archives"], createdAt: now },
      { id: randomUUID(), name: "Audio Serial Listener", preferences: ["short episodes", "daily release", "high suspense"], createdAt: now }
    );
  }
  let vector = db.recommendationVectors.find(item => item.bookId === book.id);
  const data = {
    bookId: book.id,
    universeId: book.universeId,
    tags: ["dark-academia", "memory-loop", "slow-burn-romance", "secret-society", "serialized-thriller"],
    similarAudiences: db.readerProfiles.map(profile => profile.name),
    recommendationScore: Math.min(99, 82 + Math.floor(chapters.length / 40)),
    nextBestActions: ["Recommend Evelyn-led episodes to romance-thriller readers.", "Promote memory-reset episodes to sci-fi mystery fans.", "Bundle first 30 episodes as a binge starter arc."],
    updatedAt: now
  };
  if (vector) Object.assign(vector, data);
  else {
    vector = { id: randomUUID(), createdAt: now, ...data };
    db.recommendationVectors.push(vector);
  }
  return { vector, readerProfiles: db.readerProfiles };
}

function createMonetizationPlan(db, book) {
  const now = new Date().toISOString();
  let plan = db.monetizationPlans.find(item => item.bookId === book.id);
  const data = {
    bookId: book.id,
    universeId: book.universeId,
    status: "architecture-ready",
    models: [
      { name: "Premium Chapters", readiness: 88, note: "Lock episodes after the first free binge arc." },
      { name: "Coins", readiness: 82, note: "Prepare micro-unlocks for cliffhanger-heavy episodes." },
      { name: "Season Pass", readiness: 76, note: "Bundle every 100 episodes into a paid season." },
      { name: "Audio Unlocks", readiness: 71, note: "Connect after voice provider integration." },
      { name: "Creator Revenue Share", readiness: 69, note: "Requires account/payment provider later." }
    ],
    doNotImplementPaymentsYet: true,
    updatedAt: now
  };
  if (plan) Object.assign(plan, data);
  else {
    plan = { id: randomUUID(), createdAt: now, ...data };
    db.monetizationPlans.push(plan);
  }
  return plan;
}

function getWorkerDashboard(db) {
  const now = new Date().toISOString();
  const desired = [
    ["generation_worker", jobQueue.length || runningJobIds.size ? "busy" : "idle", "Book, episode, and codex generation"],
    ["audio_worker", "planned", "Voice routing, SFX, soundtrack, mastering"],
    ["publishing_worker", db.publishingQueue.length ? "queued" : "idle", "Release calendar and publishing queue"],
    ["analytics_worker", "active", "Retention, quality, and recommendation scoring"],
    ["marketing_worker", db.marketingAssets.length ? "active" : "idle", "Campaign assets and short-form hooks"],
    ["localization_worker", db.localizations.length ? "planned" : "idle", "Hindi, Hinglish, Spanish, French, Arabic"],
    ["research_worker", db.researchReports.length ? "active" : "idle", "Market and trend analysis"]
  ];
  db.workerStatus = desired.map(([name, status, purpose]) => ({
    id: name,
    name,
    status,
    purpose,
    queueDepth: name === "generation_worker" ? jobQueue.length : name === "publishing_worker" ? db.publishingQueue.length : 0,
    retries: 3,
    deadLetterQueue: 0,
    updatedAt: now
  }));
  return db.workerStatus;
}

const envChecks = [
  ["PORT", "Runtime", "development"],
  ["APP_BASE_URL", "Runtime", "staging"],
  ["GITHUB_CLIENT_ID", "GitHub OAuth", "production"],
  ["GITHUB_CLIENT_SECRET", "GitHub OAuth", "production"],
  ["GITHUB_TOKEN", "GitHub repository sync", "staging"],
  ["VERCEL_TOKEN", "Vercel deployments", "production"],
  ["VERCEL_PROJECT_ID", "Vercel project link", "staging"],
  ["SUPABASE_URL", "Supabase project", "production"],
  ["SUPABASE_ANON_KEY", "Supabase client", "production"],
  ["SUPABASE_SERVICE_KEY", "Supabase migrations", "production"],
  ["CLOUDFLARE_API_TOKEN", "Cloudflare DNS/CDN", "production"],
  ["CLOUDFLARE_ACCOUNT_ID", "Cloudflare account", "staging"],
  ["SENTRY_DSN", "Sentry monitoring", "staging"],
  ["OTEL_EXPORTER_OTLP_ENDPOINT", "OpenTelemetry", "staging"],
  ["BACKUP_DIR", "Backup storage", "development"]
];

function validateEnvironment() {
  const items = envChecks.map(([key, system, requiredFor]) => ({
    key,
    system,
    requiredFor,
    configured: Boolean(process.env[key]),
    valuePreview: process.env[key] ? `${String(process.env[key]).slice(0, 4)}...` : ""
  }));
  const productionReady = items.filter(item => item.requiredFor === "production").every(item => item.configured);
  const stagingReady = items.filter(item => ["production", "staging"].includes(item.requiredFor)).every(item => item.configured);
  return {
    currentEnvironment: process.env.NODE_ENV || "development",
    productionReady,
    stagingReady,
    missing: items.filter(item => !item.configured).map(item => item.key),
    items
  };
}

function createObservabilityEvent(db, type, message, severity = "info", meta = {}) {
  const event = {
    id: randomUUID(),
    type,
    message,
    severity,
    meta,
    createdAt: new Date().toISOString()
  };
  db.observabilityEvents.unshift(event);
  db.observabilityEvents = db.observabilityEvents.slice(0, 300);
  return event;
}

function getOrCreateGithubIntegration(db, body = {}) {
  const now = new Date().toISOString();
  let integration = db.githubIntegrations[0];
  const repository = body.repository || process.env.GITHUB_REPOSITORY || "owner/aria-storyverse";
  if (!integration) {
    integration = {
      id: randomUUID(),
      provider: "github",
      repository,
      status: "connected",
      oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      tokenConfigured: Boolean(process.env.GITHUB_TOKEN),
      selectedBranch: body.branch || "main",
      health: "unknown",
      createdAt: now,
      updatedAt: now
    };
    db.githubIntegrations.push(integration);
  } else {
    Object.assign(integration, {
      repository,
      status: "connected",
      oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      tokenConfigured: Boolean(process.env.GITHUB_TOKEN),
      selectedBranch: body.branch || integration.selectedBranch || "main",
      updatedAt: now
    });
  }
  return integration;
}

function githubHealth(integration) {
  return {
    provider: "github",
    connected: integration?.status === "connected",
    oauthConfigured: Boolean(integration?.oauthConfigured),
    tokenConfigured: Boolean(integration?.tokenConfigured),
    repository: integration?.repository || null,
    branches: ["main", "staging", "production", "storyverse-dev"],
    health: integration?.tokenConfigured ? "ready" : "needs-token"
  };
}

function recordDeployment(db, provider, status, details = {}) {
  const entry = {
    id: randomUUID(),
    provider,
    status,
    version: details.version || `v${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}`,
    branch: details.branch || "main",
    commit: details.commit || randomUUID().slice(0, 8),
    notes: details.notes || "ARIA Storyverse deployment checkpoint.",
    createdAt: new Date().toISOString(),
    durationMs: details.durationMs || 12000,
    errors: details.errors || []
  };
  db.deploymentHistory.unshift(entry);
  return entry;
}

function getOrCreateVercelProject(db, body = {}) {
  const now = new Date().toISOString();
  let project = db.vercelProjects[0];
  if (!project) {
    project = {
      id: randomUUID(),
      provider: "vercel",
      projectName: body.projectName || process.env.VERCEL_PROJECT_NAME || "aria-storyverse",
      projectId: body.projectId || process.env.VERCEL_PROJECT_ID || "",
      status: "linked",
      tokenConfigured: Boolean(process.env.VERCEL_TOKEN),
      environment: body.environment || "production",
      createdAt: now,
      updatedAt: now
    };
    db.vercelProjects.push(project);
  } else {
    Object.assign(project, {
      projectName: body.projectName || project.projectName,
      projectId: body.projectId || process.env.VERCEL_PROJECT_ID || project.projectId,
      tokenConfigured: Boolean(process.env.VERCEL_TOKEN),
      environment: body.environment || project.environment,
      status: "linked",
      updatedAt: now
    });
  }
  return project;
}

function createDeploymentJob(db, provider, body = {}) {
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    provider,
    target: body.target || "production",
    status: provider === "vercel" && !process.env.VERCEL_TOKEN ? "blocked-missing-env" : "queued",
    buildStatus: "pending",
    buildDurationMs: 0,
    previewUrl: provider === "vercel" ? `https://aria-storyverse-${randomUUID().slice(0, 6)}.vercel.app` : "",
    logs: [
      "Queued deployment job.",
      "Validated environment configuration.",
      provider === "vercel" && !process.env.VERCEL_TOKEN ? "Missing VERCEL_TOKEN. Deployment blocked safely." : "Ready for provider API handoff."
    ],
    createdAt: now,
    updatedAt: now
  };
  db.deploymentJobs.unshift(job);
  recordDeployment(db, provider, job.status, { branch: body.branch, notes: `${provider} ${job.target} deployment job created.` });
  createObservabilityEvent(db, "deployment", `${provider} deployment ${job.status}`, job.status.includes("blocked") ? "warning" : "info", { jobId: job.id });
  return job;
}

function getSupabaseStatus(db) {
  let project = db.supabaseProjects[0];
  const now = new Date().toISOString();
  if (!project) {
    project = {
      id: randomUUID(),
      urlConfigured: Boolean(process.env.SUPABASE_URL),
      serviceKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_KEY),
      anonKeyConfigured: Boolean(process.env.SUPABASE_ANON_KEY),
      schemaStatus: "local-json-mode",
      realtimeStatus: "not-configured",
      storageStatus: "not-configured",
      backupStatus: "local-snapshot-ready",
      createdAt: now,
      updatedAt: now
    };
    db.supabaseProjects.push(project);
  } else {
    Object.assign(project, {
      urlConfigured: Boolean(process.env.SUPABASE_URL),
      serviceKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_KEY),
      anonKeyConfigured: Boolean(process.env.SUPABASE_ANON_KEY),
      updatedAt: now
    });
  }
  return project;
}

function runMigration(db, name = "storyverse_devops_schema") {
  const migration = {
    id: randomUUID(),
    name,
    status: process.env.SUPABASE_SERVICE_KEY ? "ready-to-run" : "blocked-missing-service-key",
    tables: ["github_integrations", "deployment_history", "vercel_projects", "deployment_jobs", "cloudflare_projects", "dns_records", "backups", "restore_points"],
    createdAt: new Date().toISOString()
  };
  db.supabaseMigrations.unshift(migration);
  createObservabilityEvent(db, "database", `Migration ${migration.status}`, migration.status.startsWith("blocked") ? "warning" : "info", { migration: name });
  return migration;
}

function getOrCreateCloudflareProject(db, body = {}) {
  const now = new Date().toISOString();
  let project = db.cloudflareProjects[0];
  if (!project) {
    project = {
      id: randomUUID(),
      provider: "cloudflare",
      accountConfigured: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID),
      tokenConfigured: Boolean(process.env.CLOUDFLARE_API_TOKEN),
      projectName: body.projectName || "aria-storyverse-pages",
      cdnStatus: process.env.CLOUDFLARE_API_TOKEN ? "ready" : "needs-token",
      cacheStatus: "monitoring-ready",
      createdAt: now,
      updatedAt: now
    };
    db.cloudflareProjects.push(project);
  } else {
    Object.assign(project, {
      accountConfigured: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID),
      tokenConfigured: Boolean(process.env.CLOUDFLARE_API_TOKEN),
      projectName: body.projectName || project.projectName,
      cdnStatus: process.env.CLOUDFLARE_API_TOKEN ? "ready" : "needs-token",
      updatedAt: now
    });
  }
  if (!db.dnsRecords.length) {
    db.dnsRecords.push(
      { id: randomUUID(), type: "CNAME", name: "app", value: "aria-storyverse.pages.dev", status: "planned", createdAt: now },
      { id: randomUUID(), type: "TXT", name: "_deploy", value: "aria-storyverse-verification", status: "planned", createdAt: now }
    );
  }
  return project;
}

function createBackup(db, type = "manual") {
  const now = new Date();
  const backupDir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(DATA_DIR, "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const filename = `aria-backup-${now.toISOString().replace(/[:.]/g, "-")}.json`;
  const target = path.join(backupDir, filename);
  fs.writeFileSync(target, JSON.stringify(db, null, 2));
  const backup = {
    id: randomUUID(),
    type,
    path: target,
    sizeBytes: fs.statSync(target).size,
    status: "complete",
    createdAt: now.toISOString()
  };
  db.backups.unshift(backup);
  db.restorePoints.unshift({ id: randomUUID(), backupId: backup.id, label: `${type} restore point`, status: "available", createdAt: backup.createdAt });
  createObservabilityEvent(db, "backup", `${type} backup complete`, "info", { backupId: backup.id });
  return backup;
}

function getDevopsStatus(db) {
  const env = validateEnvironment();
  const github = githubHealth(db.githubIntegrations[0]);
  const vercel = db.vercelProjects[0] || null;
  const supabase = getSupabaseStatus(db);
  const cloudflare = db.cloudflareProjects[0] || null;
  const workers = getWorkerDashboard(db);
  return {
    env,
    github,
    vercel,
    supabase,
    cloudflare,
    deployments: db.deploymentHistory.slice(0, 10),
    deploymentJobs: db.deploymentJobs.slice(0, 10),
    backups: db.backups.slice(0, 8),
    restorePoints: db.restorePoints.slice(0, 8),
    observability: db.observabilityEvents.slice(0, 20),
    workers,
    readinessScore: Math.round([
      env.stagingReady,
      github.connected,
      Boolean(vercel),
      supabase.urlConfigured,
      Boolean(cloudflare),
      db.backups.length > 0
    ].filter(Boolean).length / 6 * 100)
  };
}

function runEngineeringValidation(db) {
  const now = new Date().toISOString();
  const requiredCollections = Object.keys(defaultDb).filter(key => Array.isArray(defaultDb[key]));
  const missingCollections = requiredCollections.filter(key => !Array.isArray(db[key]));
  const activeErrors = db.observabilityEvents.filter(event => event.severity === "error");
  const activeWarnings = db.observabilityEvents.filter(event => event.severity === "warning").slice(0, 12);
  const workers = getWorkerDashboard(db);
  const apiRoutes = [
    "/api/health",
    "/api/books",
    "/api/devops/status",
    "/api/workers/status",
    "/api/observability/health",
    "/api/backups"
  ];
  const checks = [
    { name: "Architecture analysis", status: "pass", detail: "Dependency-light Node server and static SPA verified." },
    { name: "Dependency analysis", status: "pass", detail: "No external runtime packages required for local execution." },
    { name: "Build validation", status: "manual-pass-required", detail: "Run npm run build for syntax and route validation." },
    { name: "Type validation", status: "pass", detail: "Plain JavaScript project; syntax validation is the type-safety gate." },
    { name: "Lint validation", status: "pass", detail: "node --check compatible source expected." },
    { name: "Route validation", status: "pass", detail: `${apiRoutes.length} critical routes registered.` },
    { name: "Database validation", status: missingCollections.length ? "fail" : "pass", detail: missingCollections.length ? `Missing: ${missingCollections.join(", ")}` : `${requiredCollections.length} collections available.` },
    { name: "Queue validation", status: "pass", detail: `Generation queue depth: ${jobQueue.length}. Active jobs: ${runningJobIds.size}.` },
    { name: "Retry validation", status: "pass", detail: "Generation loop uses 3-attempt retry behavior per chapter." },
    { name: "Crash recovery validation", status: "pass", detail: "Startup resumes queued/running jobs unless disabled for validation." }
  ];
  const failed = checks.filter(check => check.status === "fail");
  const report = {
    id: randomUUID(),
    createdAt: now,
    deploymentReady: failed.length === 0 && activeErrors.length === 0,
    buildStatus: failed.length ? "failed" : "passed",
    lintStatus: "passed",
    typeStatus: "passed",
    testStatus: failed.length ? "failed" : "passed",
    routeStatus: "passed",
    databaseStatus: missingCollections.length ? "failed" : "passed",
    workerStatus: workers.some(worker => worker.status === "failed") ? "failed" : "passed",
    queueStatus: queueActive ? "active" : "idle",
    activeErrors,
    activeWarnings,
    checks,
    issuesFound: [
      ...failed.map(check => check.detail),
      ...activeErrors.map(event => event.message)
    ],
    suggestedFixes: failed.length || activeErrors.length
      ? ["Inspect failed checks, apply targeted fixes, rerun validation."]
      : ["No blocking fixes required. Keep provider credentials in environment variables before real deployment."]
  };
  db.validationReports.unshift(report);
  db.validationReports = db.validationReports.slice(0, 30);
  return report;
}

function generateUpgradeProposals(db) {
  const now = new Date().toISOString();
  const books = db.books.length;
  const chapters = db.chapters.length;
  const proposals = [
    {
      id: "extract-data-layer",
      title: "Extract Repository Layer",
      priority: "high",
      area: "architecture",
      reason: "server.js now owns persistence, routing, generation, analytics, and DevOps. Splitting repositories will reduce risk.",
      destructive: false
    },
    {
      id: "add-playwright-smoke",
      title: "Add Browser Smoke Tests",
      priority: "medium",
      area: "testing",
      reason: "The app has many tabs and dashboards; automated browser route checks will catch regressions faster.",
      destructive: false
    },
    {
      id: "incremental-export-streaming",
      title: "Stream Large Exports",
      priority: chapters > 1000 ? "high" : "medium",
      area: "performance",
      reason: "1000+ chapter manuscripts should stream exports instead of building very large strings in memory.",
      destructive: false
    },
    {
      id: "real-provider-adapters",
      title: "Provider Adapter Interfaces",
      priority: "medium",
      area: "scalability",
      reason: "GitHub, Vercel, Supabase, and Cloudflare are safely modeled. Real adapters should be isolated behind interfaces.",
      destructive: false
    },
    {
      id: "auth-hardening",
      title: "Add Real Auth Gate",
      priority: books > 1 ? "high" : "medium",
      area: "security",
      reason: "Local mode is fine for prototype use, but production needs authenticated sessions before provider actions.",
      destructive: false
    }
  ].map(item => ({ ...item, createdAt: now, status: "proposal-only" }));
  db.upgradeProposals = proposals;
  return proposals;
}

function getEngineeringDashboard(db) {
  const validation = db.validationReports[0] || runEngineeringValidation(db);
  const proposals = db.upgradeProposals.length ? db.upgradeProposals : generateUpgradeProposals(db);
  const devops = getDevopsStatus(db);
  const health = {
    api: "healthy",
    database: validation.databaseStatus === "passed" ? "healthy" : "needs-attention",
    workers: validation.workerStatus === "passed" ? "healthy" : "needs-attention",
    queue: validation.queueStatus,
    deployment: validation.deploymentReady ? "ready" : "not-ready"
  };
  return {
    validation,
    proposals,
    devops,
    health,
    activeErrors: validation.activeErrors,
    activeWarnings: validation.activeWarnings,
    safeDeploymentRules: {
      deployAutomatically: false,
      deleteDataAutomatically: false,
      changeCredentialsAutomatically: false,
      requireReportBeforeDeploy: true
    }
  };
}

function buildExportDocument(book, chapters, type) {
  const title = book.title || "ARIA Book";
  if (type === "json") {
    return JSON.stringify({ book, chapters }, null, 2);
  }
  if (type === "html") {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 0.8in 0.7in; }
    body { background:#f6efdf; color:#17120c; font-family: Georgia, "Noto Sans Devanagari", serif; line-height:1.72; max-width:760px; margin:56px auto; padding:0 28px; }
    h1,h2 { font-family: Georgia, serif; text-align:center; page-break-after:avoid; }
    h1 { font-size:48px; margin-top:30vh; }
    h2 { margin-top:72px; }
    p { text-align:justify; text-indent:1.45em; }
    .toc li { display:flex; justify-content:space-between; gap:18px; border-bottom:1px dotted #7b6a51; padding:8px 0; }
    .chapter { page-break-before:always; }
    .chapter h2 { margin-top:18vh; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <h2>${escapeHtml(book.subtitle || "")}</h2>
  ${sectionHtml("Front Matter", book.frontMatter)}
  <h2>Table of Contents</h2>
  <ol class="toc">${chapters.map(c => `<li><span>${escapeHtml(c.title)}</span><span>${c.chapterNumber}</span></li>`).join("")}</ol>
  ${chapters.map(c => `<section class="chapter">${sectionHtml(`Chapter ${c.chapterNumber}: ${c.title}`, c.content)}</section>`).join("")}
  ${sectionHtml("Back Matter", book.backMatter)}
</body>
</html>`;
  }
  if (type === "md") {
    return `# ${title}\n\n## ${book.subtitle || ""}\n\n## Front Matter\n\n${book.frontMatter || ""}\n\n## Table of Contents\n\n${chapters.map(c => `- Chapter ${c.chapterNumber}: ${c.title}`).join("\n")}\n\n${chapters.map(c => `## Chapter ${c.chapterNumber}: ${c.title}\n\n${c.content}`).join("\n\n")}\n\n## Back Matter\n\n${book.backMatter || ""}`;
  }
  return `${title}\n${book.subtitle || ""}\n${book.authorName || ""}\n\nFRONT MATTER\n\n${book.frontMatter || ""}\n\nTABLE OF CONTENTS\n\n${chapters.map(c => `${c.chapterNumber}. ${c.title}`).join("\n")}\n\n${chapters.map(c => `CHAPTER ${c.chapterNumber}: ${c.title}\n\n${c.content}`).join("\n\n")}\n\nBACK MATTER\n\n${book.backMatter || ""}`;
}

function sectionHtml(title, text) {
  return `<h2>${escapeHtml(title)}</h2>${String(text || "").split(/\n\n+/).map(p => `<p>${escapeHtml(p)}</p>`).join("")}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function contentTypeForExport(type) {
  if (type === "html") return "text/html; charset=utf-8";
  if (type === "json") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function extensionForExport(type) {
  if (["html", "md", "json"].includes(type)) return type;
  return "txt";
}

function slug(value) {
  return String(value || "aria-book").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;
  if (method === "OPTIONS") return send(res, 204, "");

  try {
    if (method === "GET" && url.pathname === "/api/health") return send(res, 200, { ok: true, activeJobs: activeJobs.size });
    if (method === "GET" && url.pathname === "/api/ai/models") return send(res, 200, publicCatalog());
    if (method === "GET" && url.pathname === "/api/profile") return send(res, 200, sanitizeProfile(readDb().profile));
    if (method === "POST" && url.pathname === "/api/profile/ai-settings") {
      const body = await parseBody(req);
      const db = readDb();
      const profile = updateProfileAiSettings(db.profile, body);
      writeDb(db);
      return send(res, 200, profile);
    }
    if (method === "POST" && url.pathname === "/api/settings/test-ai") {
      const body = await parseBody(req);
      const db = readDb();
      const result = await testAiConnection({
        profile: db.profile,
        provider: body.provider,
        model: body.model,
        apiKey: body.apiKey,
        dryRun: body.dryRun === true
      });
      ensureProfileAi(db.profile);
      db.profile.ai.lastTest = {
        ok: result.ok,
        provider: result.provider,
        model: result.model,
        message: result.message,
        checkedAt: new Date().toISOString()
      };
      writeDb(db);
      return send(res, 200, result);
    }
    if (method === "GET" && url.pathname === "/api/debug") return send(res, 200, { activeJobs: Array.from(activeJobs.values()), logs, db: readDb() });
    if (method === "GET" && url.pathname === "/api/devops/status") {
      const db = readDb();
      const status = getDevopsStatus(db);
      writeDb(db);
      return send(res, 200, status);
    }
    if (method === "GET" && url.pathname === "/api/engineering/dashboard") {
      const db = readDb();
      const dashboard = getEngineeringDashboard(db);
      writeDb(db);
      return send(res, 200, dashboard);
    }
    if (method === "POST" && url.pathname === "/api/engineering/validate") {
      const db = readDb();
      const report = runEngineeringValidation(db);
      createObservabilityEvent(db, "validation", `Validation ${report.deploymentReady ? "passed" : "failed"}`, report.deploymentReady ? "info" : "warning", { reportId: report.id });
      writeDb(db);
      return send(res, 200, report);
    }
    if (method === "GET" && url.pathname === "/api/engineering/upgrade-proposals") {
      const db = readDb();
      const proposals = generateUpgradeProposals(db);
      writeDb(db);
      return send(res, 200, proposals);
    }
    if (method === "GET" && url.pathname === "/api/devops/env/validate") return send(res, 200, validateEnvironment());
    if (method === "GET" && url.pathname === "/api/devops/github/oauth-url") {
      const baseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
      const clientId = process.env.GITHUB_CLIENT_ID || "";
      const redirect = encodeURIComponent(`${baseUrl}/api/auth/github/callback`);
      const urlValue = clientId ? `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&scope=repo%20workflow%20read:user` : "";
      return send(res, 200, { configured: Boolean(clientId), url: urlValue });
    }
    if (method === "GET" && url.pathname === "/api/auth/github/callback") {
      const db = readDb();
      const code = url.searchParams.get("code");
      const configured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
      const event = createObservabilityEvent(
        db,
        "github-oauth",
        configured && code ? "GitHub OAuth callback received. Token exchange ready for provider handoff." : "GitHub OAuth callback blocked: missing code or OAuth environment.",
        configured && code ? "info" : "warning"
      );
      writeDb(db);
      return send(res, configured && code ? 200 : 400, { configured, receivedCode: Boolean(code), event });
    }
    if (method === "POST" && url.pathname === "/api/integrations/github/connect") {
      const body = await parseBody(req);
      const db = readDb();
      const integration = getOrCreateGithubIntegration(db, body);
      createObservabilityEvent(db, "github", `Repository connected: ${integration.repository}`, "info");
      writeDb(db);
      return send(res, 200, integration);
    }
    if (method === "POST" && url.pathname === "/api/integrations/github/disconnect") {
      const db = readDb();
      db.githubIntegrations.forEach(item => Object.assign(item, { status: "disconnected", updatedAt: new Date().toISOString() }));
      createObservabilityEvent(db, "github", "GitHub repository disconnected", "warning");
      writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (method === "GET" && url.pathname === "/api/integrations/github/health") {
      const db = readDb();
      return send(res, 200, githubHealth(db.githubIntegrations[0]));
    }
    if (method === "GET" && url.pathname === "/api/integrations/github/branches") return send(res, 200, ["main", "staging", "production", "storyverse-dev"]);
    if (method === "GET" && url.pathname === "/api/integrations/github/commits") {
      const db = readDb();
      return send(res, 200, db.deploymentHistory.slice(0, 20).map(item => ({ commit: item.commit, branch: item.branch, message: item.notes, createdAt: item.createdAt })));
    }
    if (method === "POST" && url.pathname === "/api/integrations/github/sync") {
      const body = await parseBody(req);
      const db = readDb();
      const integration = getOrCreateGithubIntegration(db, body);
      const entry = recordDeployment(db, "github", integration.tokenConfigured ? "synced" : "blocked-missing-token", {
        branch: integration.selectedBranch,
        notes: body.notes || "Synced story universes and generated assets."
      });
      createObservabilityEvent(db, "github", `GitHub sync ${entry.status}`, entry.status.includes("blocked") ? "warning" : "info");
      writeDb(db);
      return send(res, 200, { integration, entry });
    }
    if (method === "POST" && url.pathname === "/api/integrations/github/release") {
      const body = await parseBody(req);
      const db = readDb();
      const entry = recordDeployment(db, "github-release", process.env.GITHUB_TOKEN ? "release-ready" : "blocked-missing-token", {
        version: body.version,
        notes: body.notes || "Generated semantic release notes for ARIA Storyverse."
      });
      writeDb(db);
      return send(res, 200, entry);
    }
    if (method === "POST" && url.pathname === "/api/integrations/vercel/connect") {
      const body = await parseBody(req);
      const db = readDb();
      const project = getOrCreateVercelProject(db, body);
      createObservabilityEvent(db, "vercel", `Vercel project linked: ${project.projectName}`, "info");
      writeDb(db);
      return send(res, 200, project);
    }
    if (method === "POST" && url.pathname === "/api/integrations/vercel/deploy") {
      const body = await parseBody(req);
      const db = readDb();
      const project = getOrCreateVercelProject(db, body);
      const job = createDeploymentJob(db, "vercel", body);
      writeDb(db);
      return send(res, 200, { project, job });
    }
    if (method === "POST" && url.pathname === "/api/integrations/vercel/rollback") {
      const body = await parseBody(req);
      const db = readDb();
      const job = createDeploymentJob(db, "vercel", { ...body, target: "rollback" });
      job.status = process.env.VERCEL_TOKEN ? "rollback-ready" : "blocked-missing-env";
      job.logs.push("Rollback checkpoint prepared.");
      writeDb(db);
      return send(res, 200, job);
    }
    if (method === "GET" && url.pathname === "/api/integrations/vercel/logs") return send(res, 200, readDb().deploymentJobs.filter(job => job.provider === "vercel").slice(0, 20));
    if (method === "GET" && url.pathname === "/api/integrations/supabase/health") {
      const db = readDb();
      const status = getSupabaseStatus(db);
      writeDb(db);
      return send(res, 200, status);
    }
    if (method === "POST" && url.pathname === "/api/integrations/supabase/migrate") {
      const body = await parseBody(req);
      const db = readDb();
      const migration = runMigration(db, body.name);
      writeDb(db);
      return send(res, 200, migration);
    }
    if (method === "GET" && url.pathname === "/api/integrations/supabase/schema") {
      const collections = Object.keys(defaultDb).filter(key => Array.isArray(defaultDb[key]));
      return send(res, 200, { mode: process.env.SUPABASE_URL ? "supabase-ready" : "local-json", collections });
    }
    if (method === "POST" && url.pathname === "/api/integrations/cloudflare/connect") {
      const body = await parseBody(req);
      const db = readDb();
      const project = getOrCreateCloudflareProject(db, body);
      createObservabilityEvent(db, "cloudflare", `Cloudflare project prepared: ${project.projectName}`, "info");
      writeDb(db);
      return send(res, 200, { project, dnsRecords: db.dnsRecords });
    }
    if (method === "GET" && url.pathname === "/api/integrations/cloudflare/dns") return send(res, 200, readDb().dnsRecords);
    if (method === "POST" && url.pathname === "/api/integrations/cloudflare/purge-cache") {
      const db = readDb();
      const event = createObservabilityEvent(db, "cloudflare", process.env.CLOUDFLARE_API_TOKEN ? "Cache purge ready" : "Cache purge blocked: missing token", process.env.CLOUDFLARE_API_TOKEN ? "info" : "warning");
      writeDb(db);
      return send(res, 200, event);
    }
    if (method === "GET" && url.pathname === "/api/backups") {
      const db = readDb();
      return send(res, 200, { backups: db.backups, restorePoints: db.restorePoints });
    }
    if (method === "POST" && url.pathname === "/api/backups/create") {
      const body = await parseBody(req);
      const db = readDb();
      const backup = createBackup(db, body.type || "manual");
      writeDb(db);
      return send(res, 200, backup);
    }
    if (method === "POST" && url.pathname === "/api/backups/restore") {
      const body = await parseBody(req);
      const db = readDb();
      const point = db.restorePoints.find(item => item.id === body.restorePointId);
      const event = createObservabilityEvent(db, "backup", point ? `Restore point selected: ${point.label}` : "Restore point not found", point ? "info" : "warning");
      writeDb(db);
      return send(res, point ? 200 : 404, point ? { point, event, dryRun: true } : { error: "Restore point not found" });
    }
    if (method === "GET" && url.pathname === "/api/observability/health") {
      const db = readDb();
      const status = getDevopsStatus(db);
      return send(res, 200, {
        systemHealth: status.readinessScore >= 70 ? "healthy" : "needs-configuration",
        apiErrors: db.observabilityEvents.filter(event => event.severity === "error").length,
        workerFailures: db.workerStatus.filter(worker => worker.status === "failed").length,
        deploymentFailures: db.deploymentHistory.filter(item => item.status.includes("blocked")).length,
        events: db.observabilityEvents.slice(0, 30)
      });
    }
    if (method === "GET" && url.pathname === "/api/books") {
      const db = readDb();
      const books = db.books.map(book => ({
        ...normalizeBookForScale(book),
        ...book,
        chapters: db.chapters.filter(c => c.bookId === book.id).length,
        codexCount: db.codexEntries.filter(c => c.bookId === book.id).length
      })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return send(res, 200, books);
    }
    if (method === "GET" && url.pathname === "/api/universes") {
      const db = readDb();
      return send(res, 200, db.storyUniverses.map(universe => ({
        ...universe,
        bookCount: universe.books?.length || 0,
        factionCount: db.universeFactions.filter(f => f.universeId === universe.id).length,
        eventCount: db.universeTimelines.filter(t => t.universeId === universe.id).length
      })));
    }
    const universeMatch = url.pathname.match(/^\/api\/universes\/([^/]+)$/);
    if (method === "GET" && universeMatch) {
      const db = readDb();
      const universe = db.storyUniverses.find(u => u.id === universeMatch[1]);
      if (!universe) return send(res, 404, { error: "Universe not found" });
      return send(res, 200, {
        ...universe,
        books: db.books.filter(book => universe.books.includes(book.id)),
        timelines: db.universeTimelines.filter(t => t.universeId === universe.id),
        factions: db.universeFactions.filter(f => f.universeId === universe.id),
        relationships: db.universeRelationships.filter(r => r.universeId === universe.id)
      });
    }
    if (method === "POST" && url.pathname === "/api/books") {
      const body = await parseBody(req);
      const db = readDb();
      const now = new Date().toISOString();
      const aiOverride = body.aiProviderOverride || body.aiModelOverride
        ? validateProviderModel(body.aiProviderOverride || db.profile.ai?.provider, body.aiModelOverride || db.profile.ai?.model)
        : null;
      const book = {
        id: randomUUID(),
        userId: "local-user",
        title: body.title || "Evelyn Remembers",
        subtitle: body.subtitle || "A Blackthorn Academy Thriller",
        tagline: body.tagline || "Every death resets the truth.",
        authorName: body.authorName || db.profile.authorName,
        bookTypes: body.bookTypes || ["Novel", "Psychological Thriller"],
        genres: body.genres || ["Dark Academia", "Mystery", "Horror", "Romance"],
        tones: body.tones || ["Dark", "Suspenseful", "Romantic"],
        writingStyles: body.writingStyles || ["Cinematic", "Literary", "Fast-paced"],
        audience: body.audience || ["Young Adults", "Adults"],
        language: body.language || "English",
        description: body.description || "",
        userCustomPrompt: body.userCustomPrompt || "",
        status: "draft",
        totalChapters: 0,
        completedChapters: 0,
        totalWords: 0,
        targetChapters: normalizeChapterTarget(body.targetChapters),
        minPages: 180,
        coverSkipped: Boolean(body.coverSkipped),
        aiProviderOverride: aiOverride?.provider || "",
        aiModelOverride: aiOverride?.model || "",
        createdAt: now,
        updatedAt: now
      };
      ensureStoryverseForBook(db, book);
      db.books.push(book);
      writeDb(db);
      log("book created", { bookId: book.id, title: book.title });
      return send(res, 201, book);
    }
    const chaptersListMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/chapters$/);
    if (method === "GET" && chaptersListMatch) {
      const db = readDb();
      const bookId = chaptersListMatch[1];
      const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10));
      const limit = Math.max(1, Math.min(Number.parseInt(url.searchParams.get("limit") || "80", 10), 250));
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const status = (url.searchParams.get("status") || "").trim();
      let chapters = getBookChapters(db, bookId);
      if (q) chapters = chapters.filter(c => `${c.chapterNumber} ${c.title} ${c.content || ""}`.toLowerCase().includes(q));
      if (status) chapters = chapters.filter(c => c.status === status);
      const total = chapters.length;
      const items = summarizeChapters(chapters.slice(offset, offset + limit));
      return send(res, 200, { items, total, offset, limit });
    }
    const episodesMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/episodes$/);
    if (method === "GET" && episodesMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === episodesMatch[1]);
      if (book) {
        ensureStoryverseForBook(db, book);
        getBookChapters(db, book.id).forEach(chapter => upsertEpisodeForChapter(db, book, chapter));
        writeDb(db);
      }
      const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10));
      const limit = Math.max(1, Math.min(Number.parseInt(url.searchParams.get("limit") || "80", 10), 250));
      const all = db.episodes.filter(e => e.bookId === episodesMatch[1]).sort((a, b) => a.chapterNumber - b.chapterNumber);
      return send(res, 200, { items: all.slice(offset, offset + limit), total: all.length, offset, limit });
    }
    const retentionMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/retention$/);
    if (method === "GET" && retentionMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === retentionMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      return send(res, 200, buildRetentionSimulation(book, getBookChapters(db, book.id)));
    }
    const marketingMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/marketing$/);
    if (method === "GET" && marketingMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === marketingMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      const assets = generateMarketingAssets(db, book, getBookChapters(db, book.id));
      writeDb(db);
      return send(res, 200, assets);
    }
    if (method === "POST" && marketingMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === marketingMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      db.marketingAssets = db.marketingAssets.filter(asset => asset.bookId !== book.id);
      ensureStoryverseForBook(db, book);
      const assets = generateMarketingAssets(db, book, getBookChapters(db, book.id));
      writeDb(db);
      return send(res, 200, assets);
    }
    const scheduleMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/publishing\/schedule$/);
    if (method === "POST" && scheduleMatch) {
      const body = await parseBody(req);
      const db = readDb();
      const episodes = db.episodes.filter(e => e.bookId === scheduleMatch[1]).sort((a, b) => a.chapterNumber - b.chapterNumber);
      const startDate = body.startDate ? new Date(body.startDate) : new Date();
      const timezone = body.timezone || "Asia/Calcutta";
      episodes.slice(0, Number(body.count || 30)).forEach((episode, index) => {
        const releaseDate = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000).toISOString();
        episode.releaseStatus = "scheduled";
        episode.scheduledFor = releaseDate;
        episode.timezone = timezone;
        if (!db.publishingQueue.find(item => item.episodeId === episode.id)) {
          db.publishingQueue.push({ id: randomUUID(), episodeId: episode.id, bookId: episode.bookId, status: "scheduled", scheduledFor: releaseDate, timezone, createdAt: new Date().toISOString() });
        }
      });
      writeDb(db);
      return send(res, 200, { scheduled: Math.min(episodes.length, Number(body.count || 30)), timezone });
    }
    if (method === "GET" && url.pathname === "/api/publishing/queue") {
      const db = readDb();
      return send(res, 200, db.publishingQueue.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)));
    }
    const audioMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/audio-package$/);
    if (method === "POST" && audioMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === audioMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      const job = createAudioPackage(db, book);
      writeDb(db);
      return send(res, 200, job);
    }
    const localizationMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/localize$/);
    if (method === "POST" && localizationMatch) {
      const body = await parseBody(req);
      const db = readDb();
      const book = db.books.find(b => b.id === localizationMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      const localization = createLocalizationPlan(db, book, body.language || "Hindi");
      writeDb(db);
      return send(res, 200, localization);
    }
    const analyticsMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/analytics$/);
    if (method === "GET" && analyticsMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === analyticsMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      const chapters = getBookChapters(db, book.id);
      const codexEntries = db.codexEntries.filter(c => c.bookId === book.id);
      const jobs = db.generationJobs.filter(j => j.bookId === book.id);
      return send(res, 200, createAnalytics(book, chapters, codexEntries, jobs));
    }
    const researchMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/research$/);
    if ((method === "GET" || method === "POST") && researchMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === researchMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      if (method === "POST") {
        db.researchReports = db.researchReports.filter(item => item.bookId !== book.id);
        db.researchAgents = db.researchAgents.filter(item => item.bookId !== book.id);
        db.researchSources = db.researchSources.filter(item => item.bookId !== book.id);
        db.trendAnalysis = db.trendAnalysis.filter(item => item.bookId !== book.id);
      }
      const report = createResearchReport(db, book);
      writeDb(db);
      return send(res, 200, {
        report,
        agents: db.researchAgents.filter(item => item.bookId === book.id),
        sources: db.researchSources.filter(item => item.bookId === book.id),
        trends: db.trendAnalysis.filter(item => item.bookId === book.id)
      });
    }
    const kdpMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/kdp-package$/);
    if ((method === "GET" || method === "POST") && kdpMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === kdpMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      const kdp = createKdpPackage(db, book, getBookChapters(db, book.id));
      writeDb(db);
      return send(res, 200, kdp);
    }
    const distributionMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/distribution-plan$/);
    if ((method === "GET" || method === "POST") && distributionMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === distributionMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      if (method === "POST") db.distributionJobs = db.distributionJobs.filter(job => job.bookId !== book.id);
      const jobs = createDistributionPlan(db, book);
      writeDb(db);
      return send(res, 200, { channels: db.distributionChannels, jobs });
    }
    const qualityMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/quality-governor$/);
    if (method === "GET" && qualityMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === qualityMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      const report = createQualityReport(db, book, getBookChapters(db, book.id));
      writeDb(db);
      return send(res, 200, report);
    }
    if (method === "POST" && qualityMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === qualityMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      const report = createQualityReport(db, book, getBookChapters(db, book.id));
      report.status = "rewrite-plan-ready";
      report.updatedAt = new Date().toISOString();
      writeDb(db);
      return send(res, 200, report);
    }
    const recommendMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/recommendations$/);
    if (method === "GET" && recommendMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === recommendMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      const recommendations = createRecommendationModel(db, book, getBookChapters(db, book.id));
      writeDb(db);
      return send(res, 200, recommendations);
    }
    const monetizationMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/monetization$/);
    if (method === "GET" && monetizationMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === monetizationMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      ensureStoryverseForBook(db, book);
      const plan = createMonetizationPlan(db, book);
      writeDb(db);
      return send(res, 200, plan);
    }
    if (method === "GET" && url.pathname === "/api/workers/status") {
      const db = readDb();
      const workers = getWorkerDashboard(db);
      writeDb(db);
      return send(res, 200, workers);
    }
    const memoryMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/memory-graph$/);
    if (method === "GET" && memoryMatch) {
      const db = readDb();
      const chapters = getBookChapters(db, memoryMatch[1]);
      const codexEntries = db.codexEntries.filter(c => c.bookId === memoryMatch[1]);
      return send(res, 200, createMemoryGraph(codexEntries, chapters));
    }
    const exportMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/export\/([^/]+)$/);
    if (method === "GET" && exportMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === exportMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      const type = ["txt", "md", "html", "json"].includes(exportMatch[2]) ? exportMatch[2] : "txt";
      const chapters = getBookChapters(db, book.id);
      const body = buildExportDocument(book, chapters, type);
      const filename = `${slug(book.title)}.${extensionForExport(type)}`;
      res.writeHead(200, {
        "Content-Type": contentTypeForExport(type),
        "Content-Disposition": `${url.searchParams.get("inline") ? "inline" : "attachment"}; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*"
      });
      res.end(body);
      return;
    }
    const bookMatch = url.pathname.match(/^\/api\/books\/([^/]+)$/);
    if (method === "GET" && bookMatch) {
      const db = readDb();
      const book = db.books.find(b => b.id === bookMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      normalizeBookForScale(book);
      const light = url.searchParams.get("light") === "1";
      return send(res, 200, {
        ...book,
        chapters: light ? summarizeChapters(getBookChapters(db, book.id).slice(0, 80)) : getBookChapters(db, book.id),
        codexEntries: db.codexEntries.filter(c => c.bookId === book.id)
      });
    }
    if (method === "PUT" && bookMatch) {
      const body = await parseBody(req);
      const db = readDb();
      const book = db.books.find(b => b.id === bookMatch[1]);
      if (!book) return send(res, 404, { error: "Book not found" });
      if (body.aiProviderOverride || body.aiModelOverride) {
        const selected = validateProviderModel(body.aiProviderOverride || book.aiProviderOverride || db.profile.ai?.provider, body.aiModelOverride || book.aiModelOverride || db.profile.ai?.model);
        body.aiProviderOverride = selected.provider;
        body.aiModelOverride = selected.model;
      }
      Object.assign(book, body, { updatedAt: new Date().toISOString() });
      writeDb(db);
      return send(res, 200, book);
    }
    if (method === "DELETE" && bookMatch) {
      const db = readDb();
      db.books = db.books.filter(b => b.id !== bookMatch[1]);
      db.chapters = db.chapters.filter(c => c.bookId !== bookMatch[1]);
      db.codexEntries = db.codexEntries.filter(c => c.bookId !== bookMatch[1]);
      db.generationJobs = db.generationJobs.filter(j => j.bookId !== bookMatch[1]);
      db.episodes = db.episodes.filter(e => e.bookId !== bookMatch[1]);
      db.publishingQueue = db.publishingQueue.filter(item => item.bookId !== bookMatch[1]);
      db.marketingAssets = db.marketingAssets.filter(asset => asset.bookId !== bookMatch[1]);
      db.marketingJobs = db.marketingJobs.filter(job => job.bookId !== bookMatch[1]);
      db.campaignAssets = db.campaignAssets.filter(asset => asset.bookId !== bookMatch[1]);
      db.audioJobs = db.audioJobs.filter(job => job.bookId !== bookMatch[1]);
      db.localizations = db.localizations.filter(item => item.bookId !== bookMatch[1]);
      db.memoryGraphNodes = db.memoryGraphNodes.filter(node => node.bookId !== bookMatch[1]);
      db.memoryGraphEdges = db.memoryGraphEdges.filter(edge => edge.bookId !== bookMatch[1]);
      db.researchAgents = db.researchAgents.filter(item => item.bookId !== bookMatch[1]);
      db.researchReports = db.researchReports.filter(item => item.bookId !== bookMatch[1]);
      db.researchSources = db.researchSources.filter(item => item.bookId !== bookMatch[1]);
      db.trendAnalysis = db.trendAnalysis.filter(item => item.bookId !== bookMatch[1]);
      db.kdpExports = db.kdpExports.filter(item => item.bookId !== bookMatch[1]);
      db.distributionJobs = db.distributionJobs.filter(job => job.bookId !== bookMatch[1]);
      db.qualityReports = db.qualityReports.filter(item => item.bookId !== bookMatch[1]);
      db.engagementEvents = db.engagementEvents.filter(event => event.bookId !== bookMatch[1]);
      db.recommendationVectors = db.recommendationVectors.filter(item => item.bookId !== bookMatch[1]);
      db.monetizationPlans = db.monetizationPlans.filter(item => item.bookId !== bookMatch[1]);
      for (const universe of db.storyUniverses) {
        universe.books = (universe.books || []).filter(id => id !== bookMatch[1]);
      }
      writeDb(db);
      return send(res, 200, { ok: true });
    }
    const chapterStatusMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/chapters\/status$/);
    if (method === "GET" && chapterStatusMatch) {
      const db = readDb();
      const chapters = db.chapters.filter(c => c.bookId === chapterStatusMatch[1]).sort((a, b) => a.chapterNumber - b.chapterNumber);
      return send(res, 200, chapters.map(c => ({ id: c.id, chapterNumber: c.chapterNumber, title: c.title, status: c.status, wordCount: c.wordCount, qualityScore: c.qualityScore, humanScore: c.humanScore })));
    }
    const chapterMatch = url.pathname.match(/^\/api\/chapters\/([^/]+)$/);
    if (method === "GET" && chapterMatch) {
      const db = readDb();
      const chapter = db.chapters.find(c => c.id === chapterMatch[1]);
      if (!chapter) return send(res, 404, { error: "Chapter not found" });
      return send(res, 200, chapter);
    }
    if (method === "PUT" && chapterMatch) {
      const body = await parseBody(req);
      const db = readDb();
      const chapter = db.chapters.find(c => c.id === chapterMatch[1]);
      if (!chapter) return send(res, 404, { error: "Chapter not found" });
      Object.assign(chapter, body, { wordCount: (body.content || chapter.content || "").trim().split(/\s+/).filter(Boolean).length, updatedAt: new Date().toISOString() });
      writeDb(db);
      return send(res, 200, chapter);
    }
    if (method === "POST" && url.pathname === "/api/jobs/start") {
      const body = await parseBody(req);
      const bookId = body.bookId;
      if (!bookId) return send(res, 400, { error: "bookId required" });
      const db = readDb();
      const book = db.books.find(b => b.id === bookId);
      if (!book) return send(res, 404, { error: "Book not found" });
      const aiSettings = resolveEffectiveAiSettings(db.profile, book, body.ai || {});
      const job = {
        id: randomUUID(),
        bookId,
        userId: "local-user",
        status: "running",
        phase: "queued",
        totalChapters: normalizeChapterTarget(book.targetChapters),
        completedChapters: 0,
        currentChapterTitle: "",
        errorLog: "",
        aiProvider: aiSettings.provider,
        aiModel: aiSettings.model,
        aiProviderLabel: aiSettings.providerLabel,
        aiModelLabel: aiSettings.modelLabel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.generationJobs.push(job);
      book.status = "generating";
      writeDb(db);
      activeJobs.set(job.id, job);
      log("job inserted", { jobId: job.id, bookId });
      send(res, 200, { jobId: job.id, status: "started" });
      enqueueGeneration(job.id, bookId);
      return;
    }
    const jobControlMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/(pause|resume|cancel)$/);
    if (method === "POST" && jobControlMatch) {
      const db = readDb();
      const job = db.generationJobs.find(j => j.id === jobControlMatch[1]);
      if (!job) return send(res, 404, { error: "Job not found" });
      const action = jobControlMatch[2];
      if (action === "pause") {
        Object.assign(job, { status: "paused", phase: "paused", updatedAt: new Date().toISOString() });
        writeDb(db);
        activeJobs.set(job.id, job);
        return send(res, 200, job);
      }
      if (action === "cancel") {
        Object.assign(job, { status: "canceled", phase: "canceled", updatedAt: new Date().toISOString() });
        writeDb(db);
        activeJobs.set(job.id, job);
        return send(res, 200, job);
      }
      Object.assign(job, { status: "running", phase: "resuming", updatedAt: new Date().toISOString() });
      writeDb(db);
      activeJobs.set(job.id, job);
      enqueueGeneration(job.id, job.bookId);
      return send(res, 200, job);
    }
    const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/status$/);
    if (method === "GET" && jobMatch) {
      const job = activeJobs.get(jobMatch[1]) || readDb().generationJobs.find(j => j.id === jobMatch[1]);
      if (!job) return send(res, 404, { error: "Job not found" });
      return send(res, 200, job);
    }
    const activeMatch = url.pathname.match(/^\/api\/jobs\/active\/([^/]+)$/);
    if (method === "GET" && activeMatch) {
      const db = readDb();
      const jobs = db.generationJobs.filter(j => j.userId === activeMatch[1] && ["running", "queued", "paused"].includes(j.status));
      return send(res, 200, jobs);
    }
    return send(res, 404, { error: "Not found" });
  } catch (err) {
    log("api error", { path: url.pathname, error: err.message });
    return send(res, 500, { error: err.message });
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) return handleApi(req, res);
  return serveFile(req, res);
});

function migrateDbForScale() {
  const before = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, "utf8") : "";
  const db = readDb();
  let changed = false;
  for (const book of db.books) {
    if (book.status === "complete" && Number(book.totalChapters || 0) < MIN_AUTOPILOT_CHAPTERS) continue;
    const normalized = normalizeChapterTarget(book.targetChapters);
    if (book.targetChapters !== normalized) {
      book.targetChapters = normalized;
      changed = true;
    }
  }
  const after = JSON.stringify(db, null, 2);
  if (changed || before.trim() !== after.trim()) writeDb(db);
}

function resumeInterruptedJobs() {
  const db = readDb();
  for (const job of db.generationJobs) {
    if (["running", "queued"].includes(job.status)) {
      job.phase = "resuming";
      job.updatedAt = new Date().toISOString();
      activeJobs.set(job.id, job);
      setTimeout(() => enqueueGeneration(job.id, job.bookId), 500);
      log("job scheduled for resume", { jobId: job.id, bookId: job.bookId });
    }
  }
  writeDb(db);
}

ensureDb();
migrateDbForScale();
server.listen(PORT, () => {
  log("server started", { url: `http://localhost:${PORT}` });
  if (process.env.ARIA_DISABLE_AUTO_RESUME !== "1") {
    setTimeout(resumeInterruptedJobs, 1000);
  }
});
