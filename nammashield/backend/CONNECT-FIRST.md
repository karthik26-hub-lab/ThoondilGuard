# Connecting the resident portal and administrator dashboard

## What is now implemented
- POST /api/analyze: server analysis adapter; rules/URL checks. Optional Gemini is used only when both a server key and model are configured. This is not a newly trained classifier.
- POST /api/report-verifications: SMS through Twilio or email through Resend. Missing providers return an error; no fake OTP delivery.
- POST /api/report-verifications/confirm: six-digit code, expiry, five attempts, signed short-lived submission token.
- POST /api/reports: verified submission, idempotency header, duplicate handling, masked message, per-contact quotas and held submissions.
- POST /api/reports/track: reference AND private key; returns only status/decision.
- /api/admin/login, session, logout: password hash, expiring database sessions, HttpOnly cookie, origin check.
- /api/admin/workspace, PATCH reports/:id, PUT alerts/:id, PUT groups: administrator actions, version conflicts and activity history.
- /api/public/alerts and /api/intelligence: published, unexpired administrator-approved notices only.

The resident and administrator source projects have adapters for these routes. Existing frontend styles and extension capture are retained. Original archive is unchanged. New Portal* database collections preserve original models; old report collections are NOT migrated automatically.

## Local setup
1. Open a terminal in this backend folder. Run `npm run setup:local`. It creates .env, a random app secret and administrator password hash. It preserves existing .env files.
2. Open .env locally. Replace MONGODB_URI with your Atlas connection string. Use a dedicated application database and least-privileged database user; allow the development machine in Atlas network access. Never paste credentials into chat.
3. Configure either Twilio SMS credentials/sender or Resend API key/verified email sender, according to the verification channel you will use.
4. CLIENT_ORIGIN must include http://localhost:4180 and http://localhost:4190. The template setup includes both. Use localhost consistently for the admin browser and API because its session cookie is SameSite Strict. Open admin at localhost, not 127.0.0.1 when API uses localhost.
5. Run `npm run dev`. The server starts only after MongoDB connects. Restart the frontend development servers after environment changes, or rebuild them.
6. Resident .env.local public URLs: VITE_BACKEND_URL and VITE_REPORT_API_URL both http://localhost:5000/api. Admin: VITE_ADMIN_API_URL=http://localhost:5000/api/admin. Existing environment values were preserved. .env.integration.example is provided in each project.
7. Sign in using the administrator username/password you chose locally. Submit a report using an actually delivered OTP, save its reference/private key, inspect it in admin, save a decision and check tracking again.

## Optional Gemini
GEMINI_API_KEY and GEMINI_MODEL belong only in backend .env. Leave both blank if pretrained models are prohibited by your event. No model name is guessed; select one available to your Google account. No API key means deterministic baseline checks, not verified AI training. Do not put this key in any VITE variable.

## Tests and remaining validation
`npm run test:integration` checks signed token expiry/tampering, password checks, admin session/logout, wrong/replayed OTP, idempotent retry/conflict and private report tracking with in-memory model adapters. No live MongoDB or delivery provider is exercised. Live end-to-end validation requires your local credentials. Frontend/backend builds pass.

## Limits to address before public deployment
- Rate limiting currently uses single-process memory and contact quotas. Use a shared store and trusted proxy configuration when scaling; add server-validated bot challenges and privacy-conscious abuse signals. New numbers can still evade phone-only controls.
- Duplicate detection is normalized masked text per contact. It is not proof that reports describe the same real incident. Reports never automatically publish alerts.
- Redaction is best effort; not a guarantee that all personal data is removed. Contact hashes and reports need retention/access policies.
- Database writes and audit events are not yet a single transaction; reconcile errors before public use. Workspace is capped at 1000 reports/500 alerts; add pagination for larger datasets.
- Admin login is single-role and password-based; add stronger authentication before government deployment. HTTPS is required in production.
- Changing APP_SECRET invalidates tracking keys and signed tokens. Back it up securely and plan controlled rotation.
- No government, identity or accessibility certification is claimed.
