-- ARIA Book Studio — Supabase schema
-- Run this in the Supabase SQL Editor before using the app.
-- The backend (server/index.js) reads/writes these three tables.

-- Books -----------------------------------------------------------------
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  title text,
  subtitle text,
  tagline text,
  author_name text,
  book_types text[] default '{}',
  genres text[] default '{}',
  tones text[] default '{}',
  writing_styles text[] default '{}',
  audience text[] default '{}',
  language text default 'English',
  description text,
  user_custom_prompt text,
  status text default 'draft',          -- draft | generating | complete | error
  cover_concepts jsonb,
  cover_skipped boolean default false,
  book_plan jsonb default '{}'::jsonb,
  book_dna jsonb default '{}'::jsonb,
  codex jsonb default '{}'::jsonb,
  front_matter text,
  back_matter text,
  total_chapters integer default 0,
  completed_chapters integer default 0,
  total_words integer default 0,
  min_pages integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chapters --------------------------------------------------------------
-- The UNIQUE (book_id, chapter_number) constraint is REQUIRED: the server
-- upserts chapters with onConflict: 'book_id,chapter_number' so retries and
-- resumes update the existing row instead of inserting duplicates.
create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id) on delete cascade,
  chapter_number integer,
  title text,
  content text,
  word_count integer default 0,
  status text default 'pending',        -- pending | complete | failed
  hook text,
  core_concept text,
  emotional_beat text,
  chapter_end_hook text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (book_id, chapter_number)
);

-- Generation jobs -------------------------------------------------------
create table if not exists generation_jobs (
  id uuid primary key,
  book_id uuid references books(id) on delete cascade,
  user_id text,
  status text default 'running',         -- running | complete | error
  total_chapters integer default 0,
  completed_chapters integer default 0,
  current_chapter_title text,
  phase text default 'planning',
  error_log text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_books_user on books (user_id);
create index if not exists idx_chapters_book on chapters (book_id);
create index if not exists idx_jobs_user on generation_jobs (user_id);
