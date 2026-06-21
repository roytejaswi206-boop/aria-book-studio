# ARIA Telegram Bot - API Reference

Complete API documentation for ARIA Book Studio Telegram Bot.

## Base URLs

**Development:**
```
http://localhost:3002
```

**Production:**
```
https://your-domain.com
```

## Authentication

### Telegram User ID

All API requests that require user context should include the Telegram ID.

Format: `telegramId` as path parameter or query string.

Example: `/api/user/123456789`

**Note:** In production, you may want to add token-based authentication. See [Security](#security) section.

## API Endpoints

### Health Check

#### `GET /health`

Check bot status and uptime.

**Response:**
```json
{
  "status": "ok",
  "mode": "webhook",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### User Management

#### `GET /api/user/:telegramId`

Get user information.

**Parameters:**
- `telegramId` (path, required): Telegram user ID (integer)

**Response:**
```json
{
  "success": true,
  "user": {
    "telegramId": 123456789,
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "booksCreated": 5,
    "chaptersCreated": 42,
    "totalWords": 125000,
    "createdAt": "2024-01-10T15:30:00.000Z",
    "lastActive": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `404` - User not found
- `500` - Server error

---

### Books Management

#### `GET /api/user/:telegramId/books`

List all books for a user.

**Parameters:**
- `telegramId` (path, required): Telegram user ID (integer)

**Query Parameters:**
- `limit` (optional, default: 50): Maximum number of books to return
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "success": true,
  "books": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "The Great Adventure",
      "subtitle": "A tale of discovery",
      "status": "draft",
      "totalChapters": 12,
      "totalWords": 45000,
      "createdAt": "2024-01-10T15:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Errors:**
- `500` - Server error

---

### Exports Management

#### `GET /api/exports/:telegramId`

List export jobs for a user.

**Parameters:**
- `telegramId` (path, required): Telegram user ID (integer)

**Response:**
```json
{
  "success": true,
  "exports": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "bookId": "550e8400-e29b-41d4-a716-446655440000",
      "format": "pdf",
      "status": "completed",
      "fileSize": 1024000,
      "downloadUrl": "/exports/export-123.pdf",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "completedAt": "2024-01-15T10:05:00.000Z"
    }
  ]
}
```

**Statuses:**
- `pending` - Job waiting to be processed
- `processing` - Currently generating file
- `completed` - Ready for download
- `failed` - Error during export

---

#### `POST /api/export-book`

Trigger book export job.

**Request Body:**
```json
{
  "telegramId": 123456789,
  "bookId": "550e8400-e29b-41d4-a716-446655440000",
  "format": "pdf"
}
```

**Parameters:**
- `telegramId` (required): Telegram user ID
- `bookId` (required): UUID of the book to export
- `format` (required): Export format - `pdf`, `markdown`, or `text`

**Response:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440002",
  "status": "pending"
}
```

**Errors:**
- `400` - Missing required fields
- `404` - Book not found
- `500` - Server error

---

#### `GET /exports/:fileName`

Download an exported file.

**Parameters:**
- `fileName` (path, required): Export file name (returned from export job)

**Response:**
- Binary file content with appropriate content-type

**Errors:**
- `404` - File not found
- `403` - Access denied (security check)

---

## Telegram Commands

All commands are initiated from Telegram bot.

### /start
Initialize bot and show welcome message.

### /help
Show command reference.

### /newbook
Create a new book. Guided flow:
1. Enter book title
2. Enter subtitle (optional)
3. Enter description
4. Book created and saved

### /books
List all user's books with details.

### /openbook
Select and open a book to view details and manage.

### /outline
Generate chapter outline. Guided flow:
1. Enter book title
2. Enter story description
3. Claude generates outline
4. Display chapter suggestions

### /chapter
Write a chapter. Guided flow:
1. Select book
2. Enter chapter content
3. Save chapter to book

### /character
Create character profile. Guided flow:
1. Enter character name
2. Enter character description
3. Claude generates full profile
4. Display personality, background, arc

### /world
Build story world. Guided flow:
1. Enter world/setting name
2. Enter world type (fantasy, sci-fi, etc.)
3. Claude generates worldbuilding
4. Display geography, culture, magic system

### /export
Export book. Guided flow:
1. Select book
2. Choose format (PDF, Markdown, Text)
3. Start export job
4. Get download link when ready

---

## Webhook Integration

### Telegram Webhook

**URL:** `POST /webhook/telegram`

Telegram sends all updates to this endpoint. Bot processes messages and callbacks.

**Automatic Processing:**
- Handles all commands
- Processes user input for multi-step flows
- Manages button callbacks
- Sends responses back to Telegram

**Security:**
- Validate sender is Telegram
- Verify message source

---

## Rate Limiting

### Current Limits

Default rate limits (can be configured via environment variables):

- **Messages:** 30 per minute per user
- **Exports:** 10 per hour per user
- **API Calls:** 100 per minute per user

Response header when rate limited:
```
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1234567890
```

Response status: `429 Too Many Requests`

---

## Error Handling

All errors follow standard HTTP status codes.

### Common Error Responses

#### 400 Bad Request
```json
{
  "error": "Missing required fields",
  "details": ["bookId", "format"]
}
```

#### 404 Not Found
```json
{
  "error": "User not found",
  "telegramId": 123456789
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## Data Types

### Book Object

```typescript
interface Book {
  id: string;                    // UUID
  telegramId: bigint;           // Telegram user ID
  userId: string;                // Internal user ID
  title: string;
  subtitle?: string;
  description?: string;
  status: 'draft' | 'generating' | 'complete' | 'error';
  author_name?: string;
  genres?: string[];
  tones?: string[];
  total_chapters: number;
  completed_chapters: number;
  total_words: number;
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
  created_via: 'web' | 'telegram' | 'api';
}
```

### Chapter Object

```typescript
interface Chapter {
  id: string;                    // UUID
  book_id: string;               // UUID reference to book
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  status: 'pending' | 'complete' | 'failed';
  hook?: string;
  core_concept?: string;
  emotional_beat?: string;
  chapter_end_hook?: string;
  created_at: string;
  updated_at: string;
}
```

### User Object

```typescript
interface User {
  id: string;                    // UUID
  telegram_id: bigint;           // Unique Telegram ID
  telegram_username?: string;
  first_name: string;
  last_name?: string;
  user_id: string;               // Internal ID
  preferences: object;           // JSON preferences
  credits_remaining: number;
  books_created_count: number;
  chapters_created_count: number;
  total_words_generated: number;
  created_at: string;
  updated_at: string;
  last_active_at?: string;
}
```

### Export Job Object

```typescript
interface ExportJob {
  id: string;                    // UUID
  telegram_id: bigint;
  book_id: string;               // UUID reference to book
  export_format: 'pdf' | 'markdown' | 'text';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path?: string;
  file_size_bytes?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}
```

---

## Code Examples

### JavaScript/Node.js

#### Get User Books

```javascript
async function getUserBooks(telegramId) {
  const response = await fetch(`http://localhost:3002/api/user/${telegramId}/books`);
  const data = await response.json();
  return data.books;
}

// Usage
const books = await getUserBooks(123456789);
console.log(books);
```

#### Export Book

```javascript
async function exportBook(telegramId, bookId, format = 'pdf') {
  const response = await fetch('http://localhost:3002/api/export-book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramId,
      bookId,
      format
    })
  });
  return await response.json();
}

// Usage
const job = await exportBook(123456789, 'book-uuid', 'pdf');
console.log(`Export job started: ${job.jobId}`);
```

#### Download File

```javascript
async function downloadExport(fileName) {
  const response = await fetch(`http://localhost:3002/exports/${fileName}`);
  const blob = await response.blob();
  
  // Save to file (Node.js)
  const fs = require('fs');
  fs.writeFileSync(fileName, Buffer.from(await blob.arrayBuffer()));
}
```

### Python

#### Get User Info

```python
import requests

def get_user_info(telegram_id):
    response = requests.get(f'http://localhost:3002/api/user/{telegram_id}')
    return response.json()

# Usage
user = get_user_info(123456789)
print(user['user']['firstName'])
```

#### List Books

```python
def get_user_books(telegram_id):
    response = requests.get(f'http://localhost:3002/api/user/{telegram_id}/books')
    return response.json()['books']

# Usage
books = get_user_books(123456789)
for book in books:
    print(f"{book['title']} ({book['totalChapters']} chapters)")
```

### cURL

#### Health Check

```bash
curl http://localhost:3002/health
```

#### Get User Info

```bash
curl http://localhost:3002/api/user/123456789
```

#### Get Books

```bash
curl http://localhost:3002/api/user/123456789/books
```

#### Export Book

```bash
curl -X POST http://localhost:3002/api/export-book \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": 123456789,
    "bookId": "550e8400-e29b-41d4-a716-446655440000",
    "format": "pdf"
  }'
```

---

## Security

### Best Practices

1. **Always use HTTPS** in production
2. **Validate user ID** before processing
3. **Rate limiting** prevents abuse
4. **SQL injection** protection via Supabase
5. **CORS** configured for allowed origins

### Adding Authentication

To add API key authentication:

```javascript
// middleware/auth.js
export function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

Usage in routes:
```javascript
router.post('/api/export-book', validateApiKey, async (req, res) => {
  // ...
});
```

### IP Whitelist

Optional IP whitelist for API endpoints:

```javascript
export function checkIpWhitelist(req, res, next) {
  const allowedIps = (process.env.IP_WHITELIST || '').split(',');
  const clientIp = req.ip;
  
  if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}
```

---

## Versioning

Current API Version: **v1.0.0**

Future versions will maintain backward compatibility.

---

## Support

For API issues:
- Check error message details
- Review logs: `pm2 logs aria-bot`
- Test endpoint: `curl http://localhost:3002/health`
- Review configuration: `cat .env`

---

**Last Updated:** 2024
**Maintainer:** ARIA Team
