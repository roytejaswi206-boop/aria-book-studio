export const ARIA_SYSTEM_PROMPT = `You are ARIA — Advanced Reading Intelligence Author, the world's most sophisticated book-writing AI.

CORE IDENTITY:
- Literary depth, professional editorial structure, and the warmth of a beloved storyteller.
- You NEVER sound like an AI. Prose is natural, crisp, varied, and emotionally engaging.

HUMAN WRITING DNA (apply every time you write prose):
1. RHYTHM: Vary sentence length. Short. Then a longer one that breathes and flows. Never three in a row the same shape.
2. TRANSITIONS: Use natural connective tissue ("But here's the thing—", "And yet.", "Here's what nobody tells you:"). NEVER use "Furthermore", "Moreover", "Additionally", "In conclusion", "It is worth noting".
3. SPECIFICITY: Concrete over vague. Real numbers, real places, real details.
4. EMOTION: Every few paragraphs, land a moment of curiosity, warmth, tension, or surprise.
5. CONSISTENCY: Honor every established character name, place, date, and fact. Never contradict the codex.

FORBIDDEN WORDS — never use: "delve", "tapestry", "multifaceted", "nuanced", "in today's world", "it is worth noting", "furthermore", "moreover", "in conclusion", "in summary", "shed light on", "navigate" (figuratively), "game-changer", "paradigm shift", "holistic", "synergy", "leverage" (as a verb), "utilize" (use "use").

OUTPUT DISCIPLINE:
- When asked for JSON, return ONLY valid JSON — no markdown fences, no commentary, no preamble.
- When asked for prose, write the prose directly with no headers like "Chapter X:" and no trailing summaries.`

const JSON_ONLY = 'Return ONLY valid JSON. No markdown code fences, no explanation, no text before or after the JSON.'

export const buildPlannerPrompt = (bookData) => {
  return `Create a complete JSON book plan for the following book setup. ${JSON_ONLY}

Book settings:
Title: ${bookData.title}
Language: ${bookData.language || 'English'}
Genres: ${bookData.genres?.join(', ') || 'General'}
Tones: ${bookData.tones?.join(', ') || 'Balanced'}
Writing styles: ${bookData.writing_styles?.join(', ') || 'Conversational'}
Audience: ${bookData.audience?.join(', ') || 'General'}
Target pages: ${bookData.targetPages || bookData.min_pages || 150}
Author idea / premise: ${bookData.user_custom_prompt || bookData.description || '(none provided — invent a compelling premise that fits the settings)'}

Decide a sensible number of chapters for the target page count (roughly 1 chapter per 8-12 pages). EVERY act must contain a populated "chapters" array — never leave it empty. Each chapter needs a real title, an opening hook sentence, a core concept, an emotional beat, a target wordCount, and an exact closing sentence.

Response schema:
{
  "refinedTitle": "",
  "subtitle": "",
  "tagline": "",
  "bookDNA": {
    "primaryEmotion": "",
    "narrativeArc": "",
    "writingPersona": "",
    "targetVoice": ""
  },
  "publishingAnalysis": {
    "marketAngle": "",
    "readerPromise": "",
    "uniqueHook": ""
  },
  "structure": {
    "acts": [
      {
        "actNumber": 1,
        "actTitle": "",
        "actPurpose": "",
        "chapters": [
          {
            "chapterNumber": 1,
            "title": "",
            "hook": "exact opening sentence",
            "coreConcept": "",
            "emotionalBeat": "",
            "wordCount": 2000,
            "chapterEndHook": "exact closing sentence",
            "keyEvents": [],
            "charactersInvolved": []
          }
        ]
      }
    ]
  },
  "frontMatterSections": ["Title Page","Copyright","Dedication","Preface","Table of Contents"],
  "backMatterSections": ["Epilogue","Acknowledgements","About Author"],
  "coverMood": "",
  "estimatedStats": { "totalWords": 0, "totalPages": 0, "chaptersCount": 0 }
}`
}

export const buildCodexPrompt = (bookPlan) => {
  return `Read this book plan and return a JSON codex (story bible) with characters, locations, lore, and items. Use exactly these top-level keys: "characters", "locations", "lore", "items". Each entry is an object with "name", "description", and "details". ${JSON_ONLY}

Book plan:
${JSON.stringify(bookPlan, null, 2)}`
}

export const buildFrontMatterPrompt = (bookPlan) => {
  return `Write the complete front matter for this book as finished, formatted plain text (no JSON, no placeholders). Include: Title Page, Copyright page (with a realistic copyright line and ISBN format), Dedication, a 300-word Author's Preface, and a Table of Contents listing every chapter from the plan with estimated page numbers. Return plain text only.

Book plan:
${JSON.stringify(bookPlan, null, 2)}`
}

export const buildCoverPrompt = (bookPlan) => {
  return `Create exactly 3 cover concept objects for this book as a JSON array. Each concept must include: gradientFrom, gradientTo, accentColor, titleColor, subtitleColor, authorColor (all hex colors), emoji, genreLabel, fontStack, designStyle, mood, targetFeel. ${JSON_ONLY}

Book plan:
${JSON.stringify(bookPlan, null, 2)}`
}

// Returns { cachedPrefix, prompt }.
// cachedPrefix holds the bookPlan + codex, which are identical for every chapter
// of a book — caching it avoids re-sending that payload on all 20+ chapter calls.
export const buildChapterPrompt = (bookPlan, chapterInfo, codex, previousLastLine, bookData) => {
  const cachedPrefix = `BOOK PLAN (shared context for every chapter):
${JSON.stringify(bookPlan, null, 2)}

CODEX (characters, locations, lore — maintain perfect consistency):
${JSON.stringify(codex || {}, null, 2)}`

  const prompt = `Write chapter ${chapterInfo.chapterNumber} of this book using the shared book plan and codex above.

Language: ${bookData.language || 'English'}
Voice / persona: ${bookPlan.bookDNA?.writingPersona || 'a warm, polished bestselling author'}
Target length: ${chapterInfo.wordCount || 2000} words (±10%).

Rules:
- Start IMMEDIATELY with this exact opening hook: "${chapterInfo.hook || ''}"
- Do NOT write a chapter header or "Chapter ${chapterInfo.chapterNumber}:" label — just the prose.
- Core concept to cover: ${chapterInfo.coreConcept || ''}
- Emotional beat to hit: ${chapterInfo.emotionalBeat || ''}
- Keep every character name, place, and fact consistent with the codex.
- End with this exact closing sentence: "${chapterInfo.chapterEndHook || ''}"
${previousLastLine ? `- Continue naturally from the previous chapter, which ended: "${previousLastLine}"` : ''}

Return the chapter prose only — plain text, no JSON, no commentary.`

  return { cachedPrefix, prompt }
}
