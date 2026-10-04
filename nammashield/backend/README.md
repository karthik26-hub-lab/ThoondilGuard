# ThoondilGuard Backend

An independently runnable Express and TypeScript API for ThoondilGuard's Phase 3 backend foundation, with an internal Phase 4 analysis engine. The backend connects to MongoDB Atlas through Mongoose and provides health checks, citizen report submission and tracking, published-alert retrieval, and a limited public threat-intelligence feed.

## Architecture

```text
HTTP request → Express route → controller → service → Mongoose model → MongoDB Atlas
```

Controllers handle HTTP input and output. Services own data access, reference generation, and public response mapping. Report validation runs as middleware before the controller. All endpoints are currently unauthenticated; there are no authority/admin routes.

## Tech stack

- Node.js 20 or newer
- Express 5 and TypeScript
- MongoDB Atlas and Mongoose
- Zod request validation
- Helmet security headers, CORS, and express-rate-limit
- dotenv environment loading

## Project structure

```text
src/
  config/        Environment and MongoDB connection
  controllers/   HTTP handlers
  middleware/    Validation, rate limits, errors, 404s
  models/        Report, ThreatIndicator, Campaign, Case, Alert, AuditEvent
  routes/        API route registration
  services/      Mongoose queries and response mapping
  types/         Validation and Express types
  server.ts      Express app and startup/shutdown
```

## Prerequisites and installation

Install Node.js 20+ and npm. From this directory:

```powershell
npm install
```

## Environment variables

Copy the placeholder file and set local values:

```powershell
Copy-Item .env.example .env
```

| Variable | Required | Default / purpose |
|---|---:|---|
| `PORT` | No | `5000`; HTTP listening port |
| `NODE_ENV` | No | `development`; read by configuration but currently does not change endpoint behavior |
| `CLIENT_ORIGIN` | No | `http://localhost:5173`; one or more comma-separated browser origins |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string, including the database path |
| `INTERNAL_THREAT_INTELLIGENCE_TOKEN` | No | Optional 32+ character bearer-token gate for the internal campaign intelligence API; blank disables that API |

This backend does not read separate `MONGODB_DATABASE`, `MONGODB_USERNAME`, or `MONGODB_PASSWORD` variables. The database name is selected by the path in `MONGODB_URI`. Never copy real connection values into documentation or commit `.env`; [`.gitignore`](.gitignore) excludes it. [`.env.example`](.env.example) contains placeholders only.

## Run locally

Run the frontend and backend in separate terminals. From this directory:

```powershell
npm run dev
```

The server connects to MongoDB before listening on `http://localhost:5000`. Successful startup logs a database connection message and the listening port.

Available package scripts:

```powershell
npm run dev        # Start the backend
npm run typecheck  # TypeScript check without output
npm run build      # Compile to dist/
npm run evaluate:dataset # Deterministic dataset baseline; no Gemini requests
npm run verify:analysis  # Local provider contract and failure-path checks
npm run verify:phase4c   # Focused URL/OCR and integration checks
npm run verify:phase4d   # Focused unified-analysis and indicator checks
npm run verify:phase5a   # Deterministic similarity and isolated database correlation checks
npm run verify:phase5b   # Campaign detection, audit, and internal API privacy checks
npm run evaluate:gemini  # Controlled resumable live Gemini reference evaluation
npm start          # Run the compiled dist/server.js
```

## API reference

All routes currently require **no authentication**. Success responses use `{ "success": true, "data": ... }`, except the established `/api/health` response, which is flat. Errors use `{ "success": false, "message": "..." }`; validation errors also include an `errors` array.

### `GET /api/health`

**Purpose:** API process health. This endpoint returns its response independently of a database query.

**Authentication:** None.

**Request:** No parameters or body.

**Success — HTTP 200:**

```json
{
  "success": true,
  "status": "ok",
  "service": "ThoondilGuard API",
  "version": "1.0.0"
}
```

**Errors:** No route-specific error response is defined.

### `GET /api/health/db`

**Purpose:** Report the live Mongoose connection state.

**Authentication:** None.

**Request:** No parameters or body.

**Connected — HTTP 200:**

```json
{
  "success": true,
  "data": { "database": "mongodb", "status": "connected" }
}
```

**Disconnected — HTTP 503:**

```json
{
  "success": false,
  "data": { "database": "mongodb", "status": "disconnected" },
  "message": "Database unavailable"
}
```

### `POST /api/reports`

**Purpose:** Create a citizen report and return its generated tracking reference.

**Authentication:** None.

**Request parameters:** None.

**Request body:** `inputType`, `source`, and `category` are required. `content`, `extractedText`, and coarse `location` are optional. `extractedText` may be `null`. `mixed` input requires a `content` or `extractedText` value; empty strings do not satisfy this check.

```json
{
  "inputType": "text",
  "source": "web",
  "content": "Suspicious message content",
  "category": "phishing",
  "location": {
    "city": "Chennai",
    "district": "Chennai",
    "region": "Tamil Nadu"
  }
}
```

Allowed `inputType`: `text`, `url`, `screenshot`, `mixed`.

Allowed `source`: `web`, `extension`, `whatsapp`.

Allowed `category`: `bank_impersonation`, `payment_fraud`, `delivery_scam`, `job_scam`, `investment_scam`, `account_takeover`, `phishing`, `government_impersonation`, `social_media_scam`, `romance_scam`, `other`.

`content` is limited to 20,000 characters; `extractedText` to 50,000. Location permits only `city`, `district`, and `region`, each limited to 120 characters. Unsupported location properties such as GPS coordinates or street addresses fail validation. Unknown top-level properties are stripped; the service only persists explicitly supported values. In particular, client values cannot set `referenceId`, status, risk, analysis, timestamps, or relationships.

**Success — HTTP 201:**

```json
{
  "success": true,
  "data": {
    "referenceId": "TG-2026-12345",
    "status": "NEW",
    "createdAt": "2026-10-03T12:00:00.000Z"
  }
}
```

The reference is generated server-side. New reports have `riskLevel: null` and no analysis result. Submitted content is currently persisted without redaction.

**Errors:** `400` validation failure; `413` body exceeds 128 KB; `429` submission rate limit; `503` database unavailable; `500` unexpected server error.

### `GET /api/reports/:referenceId`

**Purpose:** Track a report without an account.

**Authentication:** None.

**Request parameters:** Path parameter `referenceId`, for example `TG-2026-12345`. No request body.

**Success — HTTP 200:**

```json
{
  "success": true,
  "data": {
    "referenceId": "TG-2026-12345",
    "status": "NEW",
    "riskLevel": null,
    "category": "phishing",
    "reportedAt": "2026-10-03T12:00:00.000Z",
    "updatedAt": "2026-10-03T12:00:00.000Z"
  }
}
```

The response contains only `referenceId`, `status`, `riskLevel`, `category`, `reportedAt`, and `updatedAt`. It excludes MongoDB IDs, submitted content, extracted text, relationships, notes, and investigation metadata.

**Errors:** `404` report not found; `429` tracking rate limit; `503` database unavailable; `500` unexpected server error.

### `GET /api/alerts`

**Purpose:** List public alerts. Only records with status `PUBLISHED` are queried, sorted by newest `publishedAt` first with a stable `_id` tie-breaker.

**Authentication:** None.

**Request parameters:** Optional query parameters `page` (default `1`) and `limit` (default `10`; values above `50` are capped at `50`). Both must be positive integers; page values above 1,000,000 are invalid. No request body.

**Success — HTTP 200:**

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
  }
}
```

Alert items contain only `alertId`, `title`, `description`, optional `category` and `region`, and `publishedAt`. MongoDB IDs and campaign references are omitted.

**Errors:** `400` invalid pagination; `503` database unavailable; `500` unexpected server error.

### `GET /api/threat-intelligence`

**Purpose:** Return the current public subset of intelligence. Only `DOMAIN` indicators linked from a `PUBLISHED` alert are included.

**Authentication:** None.

**Request parameters:** No parameters or body.

**Success — HTTP 200:**

```json
{
  "success": true,
  "data": {
    "items": [{ "type": "DOMAIN", "value": "example.com" }]
  }
}
```

When there are no qualifying indicators, `items` is empty. Phone, email, report content, case information, and authority metadata are not returned.

**Errors:** `503` database unavailable; `500` unexpected server error.

## Error responses and status codes

Validation errors include field-level details without echoing submitted values:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "inputType", "message": "..." }]
}
```

The implemented API uses `200` for successful reads/health, `201` for report creation, `400` for validation or invalid pagination, `404` for missing routes/reports, `413` for oversized JSON, `429` for limited report requests, `500` for unexpected errors, and `503` for unavailable database operations. Unexpected errors are returned generically; stack traces and raw MongoDB errors are not sent to clients.

## Validation and privacy

- Request JSON is capped at 128 KB; binary or image uploads are not supported.
- Report input uses centralized Zod validation. Required fields, enums, types, string limits, mixed-input content, and coarse location are checked before service execution.
- Server-controlled fields are not accepted from client payloads. The server sets the report reference, `NEW` status, `null` risk level, and timestamps.
- Report tracking, alerts, and threat-intelligence responses are explicit public projections, not raw Mongoose documents.
- Coarse location is optional and limited to city, district, and region. Exact addresses and GPS fields are unsupported.
- Report content is stored as submitted; privacy redaction and retention controls are not yet implemented.

## Rate limiting

The report submission endpoint is limited to **30 requests per IP per 15 minutes**. Report tracking is limited to **60 requests per IP per 15 minutes**. Exceeding either returns HTTP 429:

```json
{ "success": false, "message": "Too many requests. Please try again later." }
```

The `express-rate-limit` draft-7 standard headers currently include `RateLimit` and `RateLimit-Policy`. The default in-memory store is intended for a single development/backend process.

## CORS and security headers

CORS reads `CLIENT_ORIGIN`, supports comma-separated origins, and normalizes each to its origin. It does not use wildcard access or enable credentials. Helmet supplies standard headers including Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, and Referrer-Policy.

## Database and models

The server loads dotenv configuration and connects to MongoDB Atlas with Mongoose before listening. `GET /api/health/db` reports Mongoose connection state. The MongoDB database name is determined by the path in `MONGODB_URI`; there is no separate database-name variable.

Current models:

- `Report` — submitted report, citizen reference, status/risk fields, and coarse location.
- `ThreatIndicator` — typed indicator and its report references.
- `Campaign` — possible campaign grouping and related references.
- `Case` — case workflow, notes, and actions.
- `Alert` — reviewed public alert and publication status.
- `AuditEvent` — system/authority event structure.

Models do not imply that AI analysis, correlation, or authority APIs are implemented.

## Database Performance

- Citizen report tracking filters by `referenceId`; the unique `referenceId` index supports this lookup and prevents duplicate references. The response uses an explicit field allowlist and excludes `_id` and submitted/private report data.
- Published alerts filter by `status` and sort by `publishedAt` descending, then `_id` descending for stable page boundaries. The compound `{ status: 1, publishedAt: -1, _id: -1 }` index matches that query. The endpoint applies `skip()` and `limit()` in MongoDB (default limit 10, maximum 50), validates positive integer pages up to 1,000,000, and retrieves the total separately with `countDocuments()`.
- Public alert responses explicitly select public fields and omit `_id` and campaign references. Threat intelligence first finds indicators referenced by published alerts, then selects only domain type and normalized value; it returns early without querying indicators when there are no references.
- Other schema indexes are retained as declared: report status/category/createdAt, threat-indicator type+normalizedValue/lastSeen, alertId uniqueness, and campaign/case identifiers and workflow fields plus audit lookup/time indexes. Several belong to models that current public endpoints do not query, so no additional indexes were added for them. No exact duplicate index declaration was found; the alert status and publishedAt single-field indexes overlap with the compound index but are distinct and were retained.
- Mongoose schema indexes are initialized when their models are compiled and connected (subject to Mongoose's `autoIndex` setting). The current API imports Report, Alert, and ThreatIndicator models; Campaign, Case, and AuditEvent have no active API query in this phase. No `syncIndexes()`, index drops, or destructive database operations are part of startup.

## Analysis Engine (Phase 4A)

The internal `AnalysisEngine` accepts typed text, URL, screenshot, or mixed inputs, plus optional extracted text, locale metadata, category, and coarse city/district/region. Input is validated at the engine boundary; unknown fields and exact-address/GPS fields are rejected. `analyzeScreenshot()` accepts screenshot bytes separately, OCRs them, and then invokes the same analysis flow. A caller-supplied `extractedText` takes precedence as editable/corrected text.

The engine returns a risk level, cautious summary, structured reasons and evidence, a bounded heuristic confidence value, indicators, URL component analyses, optional OCR text/confidence/language/script metadata, `analyzedAt`, and analyzer version `analysis-engine-v1`. Confidence is a small baseline support measure, not a probability. `NO_STRONG_WARNING_SIGNS` means only that the current checks did not identify strong warnings; it is not a safety guarantee. Empty content produces `NEEDS_VERIFICATION`.

Providers implement the internal `AnalysisProvider` interface. The deterministic baseline checks English and common romanized Tanglish patterns for credential and sensitive-information requests, payment, urgency/threats, app installation, rewards/refunds, organization impersonation, off-platform contact, and link-like text. A separate local URL provider inspects URL structure and lexical patterns without visiting the destination. Gemini is an optional server-side structured-analysis provider. Providers contribute signals and assessments; the engine's conservative mapper makes the final decision. Gemini's suggested risk and confidence never directly set the final risk. The baseline escalates only when at least three distinct warning categories include high-severity, action, and pressure signals; weaker signals require verification. This is not a calibrated scam detection model.

The engine is not called by `POST /api/reports`, and analysis is not automatically generated or persisted. The Report analysis schema retains its existing string `reasons` field and adds optional structured `reasonDetails`, `evidence`, `indicators`, provider assessments, and warnings for compatible future storage; existing report creation/tracking response contracts are unchanged.

## Analysis providers and dataset evaluation (Phase 4B)

`GEMINI_API_KEY` is optional and read only by the backend process from its environment. Set it in the local ignored `backend/.env` if Gemini is desired; never put a real key in source, logs, examples, or client code. `backend/.env.example` contains only a placeholder. Gemini uses `@google/genai`, requests schema-constrained JSON, validates it again with Zod, limits input to 8,000 characters, and applies a 12-second timeout. Message content is marked untrusted in the prompt. Provider failures return a generic warning and the deterministic rules continue; if provider failure leaves the result weakly supported, risk remains `NEEDS_VERIFICATION`. No credentials or raw provider errors are included in API result objects.

The provider contract includes suspected category, warning signals and evidence, requested action, indicators, uncertainty, suggested risk, and confidence. Only validated warning signals are merged into the engine signals. Assessment suggestions are retained for explanation but do not override the engine's own risk mapping. `NO_STRONG_WARNING_SIGNS` is not a guarantee of safety. The engine remains an internal service and is not wired into report submission or a new public endpoint.

`datasets/prepare_dataset.py` validates the complete synthetic source, removes case-insensitive exact-text duplicates into separate processed outputs, and reports raw/cleaned distributions. The dataset has category-label purity, strong risk-label leakage, and repeated generated templates; it is for descriptive reference evaluation, not training or an independent calibration set. `npm run evaluate:dataset` runs only deterministic rules across the 885 cleaned rows and makes no Gemini requests.

Phase 4B live finalization was attempted against the existing 885-row reference using a deterministic template-deduplicated sample of five records per category × language stratum (90 total). The environment reported that the key was configured, but the first live request failed with the provider's sanitized `request_failed` code; zero Gemini rows were completed and no Gemini or combined evaluation metrics were produced. No calibration thresholds were changed. The prior deterministic 46.21% risk-level agreement remains a descriptive baseline only; category/risk leakage and generated templates mean those labels do not provide independent calibration ground truth. Do not report Phase 4B complete until a live evaluation and evidence-based calibration run succeeds.

## URL analysis and screenshot OCR (Phase 4C)

`UrlAnalysisService` extracts up to 50 HTTP(S), `www`, and domain-like URLs from message text; parses them locally; normalizes scheme/host/default ports and fragments; and obtains registrable-domain/subdomain components from `tldts`. It reports explainable low/medium heuristics for plain HTTP, IP hosts, known shorteners, deep subdomains, brand-like domains, suspicious host/path terms, IDN/punycode, percent encoding, user-info, non-default ports, and redirect query parameters. Query values with token, authentication, identity, or account-like names are redacted from normalized output. Findings are indicators only, not verdicts. The service never resolves DNS, requests a submitted URL, downloads a page, or performs a reputation lookup. Weak URL signals cannot independently produce `HIGH_CONCERN`.

`ScreenshotOcrService` uses Tesseract.js with the English model, accepts PNG/JPEG bytes up to 5 MiB and 20 megapixels, verifies image signatures/dimensions, and caps extracted text at 50,000 characters. It returns OCR text, mean confidence, a best-effort script/language label (including a small romanized-Tanglish marker heuristic), and a review flag. Low-confidence or failed OCR is not treated as ground truth: uncertain OCR caps the result at `NEEDS_VERIFICATION`; corrected text supplied by the caller is used for analysis. No screenshot endpoint or report-submission integration was added. Tesseract.js loads its English trained data on first OCR use from its configured language path or its default CDN; set `TESSERACT_LANG_PATH` to a local directory containing `eng.traineddata` or `eng.traineddata.gz` for controlled/offline deployment.

Run `npm run verify:phase4c` for focused URL normalization/signal cases, real OCR against checked-in synthetic English/Tanglish/URL/low-quality image fixtures, screenshot-to-engine flow, input-size/type validation, and provider/OCR failure handling. The checks make no Gemini calls. English-only Tesseract recognition does not provide reliable general language identification; the Tanglish label is heuristic. OCR quality depends on image resolution, fonts, and contrast. URL heuristics can produce false positives and do not establish ownership, reputation, page behavior, or maliciousness.

## Unified analysis and indicator extraction (Phase 4D)

The existing `AnalysisEngine` combines deterministic rule signals, optional Gemini signals/assessment, and local URL signals. `analyzeScreenshot()` OCRs an image and forwards its extracted or caller-corrected text into that same engine. The result includes final risk, confidence, summary, reason/evidence list, a reason-level category, uncertainty, requested action when a provider supplies one, provider assessments/warnings, providers used, URL components/evidence, OCR metadata, and normalized indicators. Gemini's suggested risk remains advisory; the existing conservative signal conjunction makes the final decision. A weak URL heuristic cannot by itself produce `HIGH_CONCERN`. Uncertain OCR lowers the result to `NEEDS_VERIFICATION` and caps confidence unless the caller supplied corrected text.

`IndicatorExtractionService` centrally emits URL, DOMAIN, PHONE, EMAIL, UPI_ID, and PHRASE indicators with original/display values, `normalizedValue`, confidence, source, and supporting evidence. URL values use the Phase 4C canonicalization and redact sensitive query values; domains are IDNA ASCII and lowercase; phone formatting is removed while preserving an explicit leading `+` and never adding a country code; email and UPI IDs are trimmed/lowercase; suspicious phrases are whitespace-collapsed/lowercase while their original text is retained in `value` and evidence. Provider-extracted values are included only when they also occur in submitted text. This is extraction/normalization only; no campaign, reputation, or correlation behavior is present.

`npm run verify:phase4d` covers the changed unified pipeline, risk gate, metadata, normalized indicators, mixed content, provider degradation, OCR uncertainty/failure, and URL-provider failure. It uses mocked Gemini and makes no live Gemini requests. The live Phase 4B evaluation runner uses the official provider, limits the sample to five distinct normalized templates per category/language stratum, rate-spaces calls, stores resumable checkpoints without message text, and writes metrics only if all selected requests succeed. The current attempt is blocked by sanitized provider code `request_failed`; it can be resumed with `npm run evaluate:gemini` after the Gemini request issue is resolved.

## Indicator correlation (Phase 5A)

Phase 5A consumes normalized indicators produced by Phase 4D; it does not replace or modify the AnalysisEngine. `ReportCorrelationService.processAnalysis(reportId, analysisResult)` is an internal service entry point for a trusted backend workflow. It persists the analysis result, canonicalizes and deduplicates indicators within the report, upserts shared `ThreatIndicator` records, links indicator IDs from reports and report IDs from indicators, then compares reports sharing indexed indicators. This operation is not wired to public report submission or a new endpoint; citizen-facing response projections remain unchanged.

Normalization is type-specific and stable: URLs use URL parsing, lowercase hosts, remove fragments and credentials, preserve paths and ordinary query parameters, and redact values for token/account/identity-like query names; domains use lowercase IDNA ASCII; phones remove formatting while preserving a supplied `+` and never inventing a country code; emails and UPI IDs are trimmed and lowercase; phrases collapse whitespace and lowercase only the comparison representation. The first submitted display value and supporting evidence remain stored. Repeated same-type normalized values are deduplicated per report. A unique `{ type, normalizedValue }` index protects global deduplication; upserts keep the earliest `firstSeen`, advance `lastSeen`, retain the strongest observed confidence, and add report references idempotently. Existing indicator metadata and first-observed evidence are preserved.

The deterministic matcher emits reason codes, indicator types, normalized values, explanations, per-signal weights, and a bounded score. Exact URL=0.82, domain=0.62, phone/email=0.76, UPI ID=0.78, distinctive phrase=0.28; generic phrase=0.005. Independent matches combine as `1 - product(1 - weight)`; a URL and its derived host are grouped as one signal to avoid double-counting. Scores >=0.70 are `STRONG_RELATION`, >=0.45 are `MODERATE_RELATION`, >=0.15 are `WEAK_RELATION`, and lower scores are `UNRELATED`. Only strong and moderate matches are stored as symmetric `relatedReports` links; weak matches can be returned as low-level evidence but do not persist as relationships. Category alone is not a match signal. Generic/common wording remains below the relationship threshold even when repeated. Correlation never changes report status, campaign IDs, cases, or alerts.

Stored links include evidence and timestamps. New links generate the existing `REPORT_CORRELATED` audit action with a non-attribution reason. The `{ type, normalizedValue }` unique index narrows indicator lookups, `reportIds` supports reverse report lookup, and `relatedReports.reportId` supports reverse relationship lookup. To bound high-fanout indicators, candidate lookup examines up to the most recent 500 linked reports per indicator. Schema index creation requires pre-existing duplicate indicator rows to be reconciled before production rollout if data was written outside this service. Correlation means only that reports share evidence; it does not establish a common operation, campaign, attacker, criminal intent, ownership, or attribution. Indicator values in correlation evidence are internal data and are not included in current public API projections.

`npm run verify:phase5a` checks normalization, exact URL/domain/phone/UPI/email matches, generic phrases, category-only/no-evidence behavior, multiple shared indicators, duplicate suppression, evidence, and three reports linked to one indicator. Its database portion uses a uniquely named temporary database and drops that test database on completion.

## Possible campaign detection and internal intelligence (Phase 5B)

`CampaignDetectionService.processAnalysis(reportId, analysisResult)` first uses the Phase 5A correlation service, then examines only the report's bounded related-report component (maximum 100 reports). A single report cannot create a campaign. A component qualifies only when it contains at least two reports and has an exact URL/phone/email/UPI match, multiple independent high-signal indicators, one high-signal indicator across at least three reports, or a high-signal indicator plus a distinctive shared phrase. Domain-only overlap between two reports, generic phrases, and category-only matches do not qualify. Existing reports outside the related component remain separate.

Campaign confidence is deterministic and ranges from 0 to 0.95. The score starts at 0.20 and adds: 0.15 for the initial two reports plus 0.05 per additional report (capped at 0.30); 0.12 per independent high-signal indicator group (capped at 0.30); up to 0.08 for evidence type diversity; 0.12 times mean Phase 5A pair similarity; up to 0.04 for category consistency; and 0.02–0.04 for reports within a 30-day or 7-day window. Report count and category cannot qualify a cluster by themselves. Confidence labels are LOW below 0.50, MEDIUM from 0.50, and HIGH from 0.75. These describe evidence support, not likelihood of criminality.

The `Campaign` record stores a stable evidence-cluster fingerprint, report/indicator membership, confidence and level, factual summary, first-detected and last-updated times, and up to 50 explainable evidence items. Evidence items reference stored indicators, carry weights/explanations/supporting report IDs, and use masked display values for phone/email/UPI, host-only URLs, and withheld phrase text. New detections start at `UNDER_REVIEW`; repeat processing reuses a matching campaign or one with at least two overlapping reports, updates evidence/membership/confidence, and preserves `firstDetectedAt` and any human-controlled status. Reports gain campaign IDs without changing status. No Case or Alert is created. Campaign creation/update and newly added report/indicator links emit SYSTEM audit events. This feature is intelligence support only: **“Possible Campaign” is a system-generated intelligence hypothesis requiring human review. It is not confirmed criminal attribution.**

The internal preparatory API is:

- `GET /api/internal/threat-intelligence/campaigns?page=1&limit=20&status=UNDER_REVIEW` — paginated factual summaries, counts, confidence, evidence summaries, and timestamps.
- `GET /api/internal/threat-intelligence/campaigns/:campaignId` — summary plus masked indicators and report references/category/date, without report content or database documents.

Both endpoints require `Authorization: Bearer <INTERNAL_THREAT_INTELLIGENCE_TOKEN>`. A token shorter than 32 characters or an unset token leaves the route disabled with `503`; an invalid token returns `401`. Campaign IDs are validated (`PC-YYYY-NNNNN`), pagination is bounded (maximum page size 50), and unknown IDs return `404`. URLs are represented by host only, phone/email/UPI values are masked, and phrase text is withheld. The existing public `GET /api/threat-intelligence` remains limited to domains on published alerts. The bearer token is only a preparatory shared-secret gate: authentication, authorization/RBAC, rotation controls, and authority identity are not implemented, so this API is not production authority-secured.

Performance uses Phase 5A's normalized indicator indexes and report links, bounded component traversal (100 reports), a campaign fingerprint, indexed campaign membership, and paginated API queries. Relevant indexes are `{ clusterFingerprint: 1 }` unique/sparse, `{ reportIds: 1 }`, and `{ status: 1, lastUpdatedAt: -1 }`. `npm run verify:phase5b` exercises campaign qualification/confidence, unrelated/category-only/generic-phrase separation, campaign reuse/update, report and indicator links, SYSTEM audit actions, API auth/pagination/status, and private-data masking against a uniquely named temporary database that is dropped after the test.

## PowerShell API tests

Run the backend first. These examples use standard PowerShell commands and localhost URLs.

### Health and database health

```powershell
Invoke-RestMethod 'http://localhost:5000/api/health'
Invoke-RestMethod 'http://localhost:5000/api/health/db'
```

### Create and track a report

```powershell
$body = @{
  inputType = 'text'
  source = 'web'
  category = 'phishing'
  content = 'Fictional test message'
} | ConvertTo-Json

$created = Invoke-RestMethod 'http://localhost:5000/api/reports' -Method Post -ContentType 'application/json' -Body $body
$created.data
Invoke-RestMethod "http://localhost:5000/api/reports/$($created.data.referenceId)"
```

### Alerts and threat intelligence

```powershell
Invoke-RestMethod 'http://localhost:5000/api/alerts?page=1&limit=10'
Invoke-RestMethod 'http://localhost:5000/api/threat-intelligence'
```

### Invalid request and unknown reference

PowerShell raises an exception for non-2xx responses; this helper prints the HTTP status and response body:

```powershell
function Show-ApiError($Action) {
  try { & $Action }
  catch {
    $response = $_.Exception.Response
    if ($response) {
      $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
      [PSCustomObject]@{
        StatusCode = [int]$response.StatusCode
        Body = $reader.ReadToEnd()
      }
      $reader.Dispose()
    } else { throw }
  }
}

Show-ApiError {
  Invoke-RestMethod 'http://localhost:5000/api/reports' -Method Post -ContentType 'application/json' -Body '{"inputType":"invalid_type","source":"web","category":"phishing"}'
}
Show-ApiError {
  Invoke-RestMethod 'http://localhost:5000/api/reports/TG-2026-99999'
}
```

## Troubleshooting

- **MongoDB connection fails:** verify the local `MONGODB_URI`, Atlas network access, database user, and URI database path. The server does not listen until connection succeeds. Never paste credentials into logs or documentation.
- **Port is already in use:** set another local `PORT` in `.env`, then use that port in requests.
- **Browser request has no CORS response header:** check that the browser's exact origin is listed in `CLIENT_ORIGIN`; do not include a URL path. Multiple origins may be comma-separated.
- **HTTP 429:** wait for the 15-minute IP window to reset; avoid repeated local smoke tests through the same address.
- **HTTP 413:** keep the JSON request under 128 KB. Screenshot file uploads are not supported.

## Current scope

Implemented: health checks, report submission/tracking, public alerts retrieval, public domain-indicator retrieval, validation, explicit public response mapping, CORS, Helmet headers, rate limiting, and an internal Phase 4 analysis engine with deterministic baseline, optional Gemini, URL analysis, and screenshot OCR. The engine is not invoked by report submission and does not automatically generate or persist analysis.

Not implemented: URL/domain reputation intelligence, automatic analysis on report submission, campaign detection, independent risk calibration, authentication/RBAC, authority APIs, WhatsApp integration, or frontend/extension API integration. Phase 5A report correlation is an internal service; campaigns and criminal attribution require later human-reviewed workflows.
