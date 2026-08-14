# Plagiarism Detection Caching System

## Overview

This system implements **one-time plagiarism scanning** with intelligent result caching to prevent unnecessary rescans and conserve detection credits.

## How It Works

### 1. First Scan (New Document)
When a document is uploaded and scanned for the first time:

1. **Content Hashing**: Document text is hashed using SHA-256
2. **Cache Check**: System checks `document_detection_cache` table for existing results
3. **Detection Run**: If no cache exists, plagiarism detection runs:
   - TF-IDF local similarity check
   - Optional AI semantic analysis
   - Optional internet search
4. **Results Saved**: All results are saved to TWO tables:
   - `plagiarism_results` - Individual matches and scores
   - `document_detection_cache` - Complete analysis with JSONB data
5. **Credit Consumed**: 1 detection credit is consumed from user's quota

### 2. Subsequent Views (Cached Results)
When the same document is opened again:

1. **Cache Lookup**: System finds existing results using document hash
2. **Instant Return**: Cached results are returned immediately
3. **No Credit Used**: Zero detection credits consumed
4. **Visual Indicator**: Green banner shows "Saved Results Loaded"

## Database Schema

### `document_detection_cache` Table
```sql
CREATE TABLE document_detection_cache (
  id               UUID PRIMARY KEY,
  student_id       UUID NOT NULL,
  document_id      UUID NOT NULL,
  document_hash    TEXT NOT NULL,              -- SHA-256 of content
  ai_score         FLOAT,                      -- AI plagiarism score
  similarity_score FLOAT,                      -- TF-IDF similarity score
  detection_status TEXT,                       -- 'completed', 'processing', 'failed'
  api_provider     TEXT,                       -- 'openai+local', 'local'
  result_data      JSONB,                      -- Full detection results
  detected_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, document_id, document_hash)
);
```

### `plagiarism_results` Table
```sql
CREATE TABLE plagiarism_results (
  id                   UUID PRIMARY KEY,
  document_id          UUID NOT NULL,
  matched_document_id  UUID,                   -- Local document match
  similarity_score     FLOAT NOT NULL,
  matched_paragraph    TEXT,                   -- Paragraph-level match details
  source               TEXT NOT NULL,          -- 'local', 'openai', 'internet'
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

## User Experience Flow

### Result Page Behavior

#### First Time (No Cache)
```
1. User opens result page
2. Loading spinner shows
3. System checks database for cached results
4. No results found → Auto-runs plagiarism scan
5. Results displayed + saved to database
6. Button shows: "Re-run Analysis"
```

#### Subsequent Times (Cached)
```
1. User opens result page
2. Loading spinner shows briefly
3. System finds cached results in database
4. Green banner appears: "Saved Results Loaded"
5. Results displayed instantly (from cache)
6. Button shows: "Re-scan Document (New Analysis)"
7. Clicking re-scan shows confirmation warning
```

## User Interface Elements

### Cached Results Banner
```html
<div class="cached-result-banner">
  <i class="fas fa-database"></i>
  <div>
    <strong>Saved Results Loaded</strong>
    <p>This document was already scanned. Showing saved results (no additional scan needed).</p>
  </div>
  <span class="cached-date">Scanned: Jan 15, 2026</span>
</div>
```

**Styling**: Green gradient background with success icon

### Re-scan Confirmation Dialog
When user clicks "Re-scan Document" on a cached result:
```
This document already has saved results.

Re-scanning will consume 1 detection credit from your quota.

Do you want to proceed with a fresh scan?
[Cancel] [OK]
```

## Detection Quota System

### Quota Tracking
```sql
CREATE TABLE student_detection_usage (
  student_id       UUID NOT NULL,
  used_count       INTEGER DEFAULT 0,
  maximum_allowed  INTEGER DEFAULT 3,
  remaining_count  INTEGER DEFAULT 3,
  period           TEXT DEFAULT 'lifetime',
  UNIQUE (student_id, period)
);
```

### System Settings
Configurable in `system_settings` table:
- `max_document_detections_per_student` (default: 3)
- `ai_scanning_enabled` (default: true)
- `max_ai_scans_per_user` (default: unlimited)

## API Endpoints

### Check Plagiarism (POST /api/check-plagiarism)
**Request**:
```json
{
  "document_id": "uuid",
  "use_openai": false
}
```

**Response (Cached)**:
```json
{
  "document_id": "uuid",
  "title": "Document Title",
  "cached_result": true,
  "message": "Using saved result. No credit consumed.",
  "local_check": { ... },
  "openai_check": null,
  "detection_limit": {
    "used_count": 2,
    "remaining_count": 1,
    "maximum_allowed": 3
  },
  "cached_at": "2026-01-15T10:30:00Z"
}
```

**Response (New Scan)**:
```json
{
  "document_id": "uuid",
  "title": "Document Title",
  "cached_result": false,
  "message": "Detection completed. Results saved.",
  "local_check": { ... },
  "openai_check": { ... },
  "detection_limit": {
    "used_count": 3,
    "remaining_count": 0,
    "maximum_allowed": 3
  }
}
```

### Get Results (GET /api/results/:document_id)
Returns all saved plagiarism results for a document from the database.

**Response**:
```json
{
  "results": [
    {
      "id": "uuid",
      "document_id": "uuid",
      "matched_document_id": "uuid",
      "similarity_score": 45.2,
      "matched_paragraph": "{ ... }",
      "source": "local",
      "created_at": "2026-01-15T10:30:00Z"
    }
  ]
}
```

## Key Functions

### Backend (controllers/plagiarismController.js)
- `checkPlagiarism()` - Main detection endpoint with caching logic
- `getCachedDetection()` - Retrieve cached results
- `saveDetectionCacheRecord()` - Save new detection results
- `markDetectionCompleted()` - Mark scan as complete
- `consumeDetectionCredit()` - Deduct from user quota

### Frontend (public/js/result.js)
- `loadReport()` - Load document and check for cached results
- `showCachedResultBanner()` - Display green success banner
- `renderResultsFromDB()` - Render saved results from database
- `runAnalysis()` - Run new scan (with confirmation if cached exists)

## Benefits

1. **Cost Savings**: Avoid redundant API calls and computation
2. **Fast Response**: Instant load times for cached results
3. **Quota Conservation**: Users can view reports unlimited times
4. **User Experience**: Clear indicators of cached vs. new scans
5. **Fair Usage**: Prevent abuse while allowing legitimate re-checks

## Admin Controls

Administrators can configure:
- Maximum detections per student
- AI scanning enable/disable
- Max AI scans per user
- File upload limits

Access: `Admin Panel > Settings`

## Troubleshooting

### Results Not Caching
1. Check `document_detection_cache` table for records
2. Verify `detection_status` is 'completed'
3. Ensure document hash matches

### Quota Not Updating
1. Check `student_detection_usage` table
2. Verify trigger/function execution
3. Check `consumeDetectionCredit()` function logs

### Cache Not Showing
1. Verify JavaScript loads: `result.js`
2. Check browser console for errors
3. Ensure CSS loaded: `.cached-result-banner`

## Version History

- **v2.0** (2026-01-15): Enhanced UI with cached result banner and confirmation dialog
- **v1.5** (2026-01-10): Added detection caching system
- **v1.0** (2026-01-01): Initial release with basic plagiarism detection
