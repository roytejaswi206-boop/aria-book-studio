# ARIA Book Studio - AI-Powered Story Generation

A production-ready application for autonomous book and story generation using Claude AI with real-time generation progress, chapter management, and comprehensive export capabilities.

## 🎯 Features

- **AI-Powered Story Generation**: Uses Claude to generate complete books with customizable tone, genre, and audience
- **Live Progress Tracking**: Real-time progress monitoring with detailed chapter-by-chapter updates
- **Chapter Management**: Individual chapter retry, status tracking, and completion markers
- **Generation Cancellation**: Stop generation at any time with graceful cleanup
- **Performance Metrics**: Token usage, cache efficiency, and generation speed analytics
- **Export Options**: Download as TXT, Markdown, HTML, or PDF
- **Debug Panel**: Real-time metrics and event logging (CTRL+SHIFT+D)
- **Error Resilience**: Automatic retries with exponential backoff for failed chapters
- **Rate Limit Handling**: Proper Anthropic API 429 error handling with retry-after support

## 📋 Requirements

- Node.js 18+
- npm or yarn
- Supabase account (for data persistence)
- Anthropic API key (for Claude access)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Setup Environment

Create `.env` file in the `server/` directory:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
ANTHROPIC_MODEL=claude-sonnet-4-6
PORT=3001
```

### 3. Setup Database

Run the database schema migration:

```bash
psql -h your-host.supabase.co -U postgres -d postgres -f schema.sql
```

Or use Supabase SQL Editor to paste the contents of `schema.sql`.

### 4. Start Development Servers

**Terminal 1 - Start Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Start Frontend:**
```bash
cd client
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## 📖 Usage

### Creating a Book

1. Click "New Book" in the sidebar
2. Configure book settings:
   - Title & subtitle
   - Author name
   - Language (English, Hindi, Hinglish, etc.)
   - Genres & tones
   - Writing style preferences
   - Target audience
   - Target page count
3. Click "Generate Chapters" to start generation

### Monitoring Generation

- Watch progress in the generation panel
- View current phase (Planning, Building Codex, Writing Chapters, etc.)
- See chapter-by-chapter progress
- Press `CTRL+SHIFT+D` to open debug panel for detailed metrics

### Debug Panel (CTRL+SHIFT+D)

View real-time information:
- **Active Job**: Job ID, status, current phase, chapter count
- **Generation Metrics**: 
  - Elapsed time
  - Token usage (input, output, cache)
  - Chapters written
  - Time per chapter
- **Chapter Statuses**: Individual status for each chapter
- **Event Log**: Timestamped event history

### Exporting Books

Once generation completes:
1. Select book from library
2. Click export button in Export Panel
3. Choose format:
   - TXT (Plain text)
   - Markdown (With formatting)
   - HTML (Styled)
   - PDF (Print-ready)

### Retrying Failed Chapters

If a chapter fails:
1. It will be marked "failed" in the chapters list
2. Click retry button on the failed chapter
3. Generation will regenerate that chapter with context from previous chapters
4. Already-completed chapters cannot be regenerated

### Cancelling Generation

During generation:
1. Click "Cancel Generation" button in the progress panel
2. Current chapters will be saved
3. Generation stops gracefully
4. You can resume generation later

## 🧪 Testing

Run the comprehensive end-to-end test suite:

```bash
node test-generation-flow.js
```

This tests:
- Server health and connectivity
- Book creation and fetching
- Generation job lifecycle
- Polling and status updates
- Cancellation workflow
- Chapter retry mechanism
- Book deletion

## 🔧 Architecture

### Backend (Node.js + Express)
- **API Routes**: 12 endpoints for book/job/chapter management
- **Claude Integration**: Prompt caching, token tracking, cache efficiency metrics
- **Error Handling**: Rate-limit aware with retry-after header support
- **Generation Flow**:
  1. Book planning (creates structure)
  2. Character/location codex building
  3. Front matter generation
  4. Cover concept generation (optional)
  5. Chapter writing (with retry on failure)
  6. Back matter generation

### Frontend (React + Vite)
- **State Management**: Zustand for global state, React hooks for local state
- **Polling**: Smart polling with cleanup on unmount
- **UI Components**:
  - Library: Browse and manage books
  - Book Preview: Display generated content
  - Export Panel: Format-specific export options
  - Debug Panel: Real-time metrics and logs
- **Progress Tracking**: Live updates with percentage and phase labels

### Database (Supabase PostgreSQL)
- **Tables**:
  - `books`: Book metadata and content
  - `chapters`: Generated chapter content and metadata
  - `generation_jobs`: Job tracking with status and metrics

## 📊 Generation Metrics

The system tracks:
- **Token Usage**: Input, output, and cache-read tokens
- **Performance**: Milliseconds per chapter
- **Efficiency**: Cache hit/miss ratios
- **Reliability**: Retry counts and error logs

All metrics available in the debug panel for optimization.

## 🛡️ Error Handling

### Rate Limiting (429)
- Automatically detects Anthropic rate limits
- Respects `retry-after` header
- Exponential backoff up to 60 seconds
- Logs all retry attempts

### Failed Chapters
- Automatic retry up to 3 times
- Chapter marked as "failed" if all retries exhausted
- Does not abort entire book generation
- Can be manually retried individually

### Network Errors
- Polling stops on unmount to prevent memory leaks
- Graceful degradation if services unavailable
- Error messages displayed in debug panel

## 🔐 Security

- Supabase Row-Level Security (RLS) ready
- CORS configured for localhost development
- Service key used server-side only
- Environment variables for all secrets

## 📝 Verification

See [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md) for:
- Complete list of all fixes and improvements
- Verification checklist
- Performance optimizations
- Quality improvements

## 📜 API Reference

### Books
- `POST /api/books` - Create book
- `GET /api/books` - List user's books
- `GET /api/books/:bookId` - Get book details
- `DELETE /api/books/:bookId` - Delete book

### Generation Jobs
- `POST /api/jobs/start` - Start generation
- `GET /api/jobs/:jobId/status` - Get job status
- `POST /api/jobs/:jobId/cancel` - Cancel job
- `GET /api/jobs/active/:userId` - List active jobs

### Chapters
- `GET /api/books/:bookId/chapters` - Get all chapters
- `GET /api/books/:bookId/chapters/status` - Get chapter statuses
- `POST /api/books/:bookId/chapters/:chapterNumber/retry` - Retry chapter

## 🎓 Model Information

- **Model**: Claude Sonnet 4
- **Cache Strategy**: Prompt caching for book plan + codex
- **Max Tokens**: Varies by phase (1200-3000)

## 📦 Production Deployment

For production:
1. Use environment variables from secure vault
2. Set up proper database backups
3. Enable Supabase Row-Level Security
4. Use a process manager (PM2, systemd) for Node.js
5. Configure reverse proxy (nginx, Cloudflare)
6. Enable CORS for production domain
7. Set up monitoring and alerting

## 🐛 Troubleshooting

### Generation never starts
- Check Anthropic API key is valid
- Verify Supabase connection
- Check server logs for errors

### Polling errors in console
- Normal during heavy load - retries automatically
- Check network tab in browser DevTools
- Verify API_URL in .env.local

### Memory usage growing
- Ensure debug panel is closed when not in use
- Clear browser cache periodically
- Check for stale jobs in database

### PDF export not working
- Verify html2canvas and jspdf are installed
- Check browser console for errors
- Try HTML export as fallback

## 📞 Support

For issues or questions:
1. Check the debug panel (CTRL+SHIFT+D)
2. Review [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md)
3. Run test suite: `node test-generation-flow.js`
4. Check server logs for detailed errors

## 📄 License

MIT

---

**Status**: Production Ready ✅  
**Last Updated**: 2026-05-28  
**Version**: 1.0.0

