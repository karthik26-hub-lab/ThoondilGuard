# Reporting integration handoff

## Ownership and current UI
The resident interface provides contact verification, masked review, submission receipt, duplicate, held-for-review and cooldown screens. These screens use the existing warm neutral and teal styling and Tamil/English setting. `/report/preview` lets the team inspect each outcome without sending messages. Actual contact verification and report acceptance require the teammate's API. Administrator report details accept optional verification and submission flags; absent values are shown as unavailable, never verified.

## Configuration and files
Set `VITE_REPORT_API_URL` to the HTTPS reporting API base, without a trailing slash. This is separate from the message-analysis API configuration. Rebuild after changing Vite environment values. Resident adapter: `src/lib/reportService.ts`; flow: `src/pages/ReportVerification.tsx`. Match the contracts below or update this adapter together with the backend. Do not place SMS provider, email provider, database or administrator secrets in Vite variables.

## Proposed API contracts
1. POST `/report-verifications`: `{channel: "sms" | "email", contact}`. Return `{challengeId, maskedDestination, resendAfterSeconds}` only after the provider accepts the delivery request. Sending is not proof of delivery. Normalize contacts server-side; validate length and format.
2. POST `/report-verifications/confirm`: `{challengeId, code}`. Return `{verificationToken}` only after a valid code. Bind the short-lived token to the verified contact, purpose and server session. Store codes securely; enforce expiry, maximum attempts, resend limits and token replay rules. Never log codes or verification tokens.
3. POST `/reports`: `{text, region, category, risk, verificationToken}` with `Idempotency-Key` header. Return `{outcome: "accepted" | "duplicate" | "held", receipt: {reference, accessKey, status: "Pending review"}}`. Treat client risk as an untrusted hint. Server validates and masks stored evidence. Acceptance means queued, not approved or publicly published.
4. POST `/reports/track`: `{reference, accessKey}`. Return only public report status, timestamps and approved public response. This endpoint still needs wiring into the existing tracking interface. Do not expose internal notes, contact details, other reports or full private evidence.

## Retry and error behavior
Return HTTP 429 with numeric `Retry-After` seconds for cooldown; expose this header through CORS. UI retains the report and shows a countdown. Return 401 for expired verification, 422 for invalid fields, and a consistent safe error object. Current adapter shows a general error for most non-success responses; field-specific messages can be added when the contract is agreed. Use explicit allowed portal origins and appropriate request authentication. Never treat CORS as authorization.

## Repeated submissions and new numbers
Enforce controls on the server, not only disabled buttons. Combine limits by verified contact, server session, network signals and service-wide load. Use configurable thresholds; a shared college network must not automatically block all residents. New contacts start with a small quota and do not gain trusted status from OTP alone. Validate a bot-challenge token on the server when adding a challenge provider; the current UI does not yet collect a bot token.

Idempotency must return the same result for a retry of the same verified submission. Reject reuse of a key with changed content. Detect repeated submissions by the same reporter and flag bursts across signals. Keep independent residents' reports even when they concern the same domain; group them as related evidence. Never return someone else's receipt or private key just because their text matches. Report volume alone cannot raise credibility or publish an alert. Hold suspicious bursts for administrator inspection. These controls reduce abuse; they cannot guarantee identification of someone changing contact, device and network.

## Administrator connection
Use the same backend/database for resident reports and administrator reports. Protect all administrator endpoints with real authentication and server-side authorization. Proposed endpoints: GET `/admin/reports`, GET `/admin/reports/:reference`, PATCH `/admin/reports/:reference`, GET `/admin/report-groups`, POST `/admin/alerts` and POST `/admin/alerts/:id/publish`. The current dashboard state adapter must be replaced with these calls.

Admin report fields include masked evidence, region, language, channel, concern, workflow status, decision, indicators, findings, `contactVerified` (boolean) and `submissionFlag` (safe display text, e.g. repeated submission or held for review). Show absence as unavailable. Keep abuse flags separate from the assessment of whether the reported message is suspicious. Save decision rationale and server-generated audit events. Only authenticated administrators may publish alerts after evidence review. Changing an administrator decision updates the safe resident tracking status through the shared database.

## Privacy and notifications
Use one verified contact method, not compulsory phone plus email. Do not collect Aadhaar photographs in this flow. Keep contact data private, access-controlled and separate from masked evidence; set retention periods. Store tracking access keys as hashes; rate-limit failed tracking attempts and use indistinguishable invalid-reference/key errors. Generate references and high-entropy keys server-side. Decide how users securely recover or save keys; do not claim recovery is available unless implemented. Never send or expose keys in public logs. Only show notification success after a real provider response, with wording that distinguishes accepted from delivered.

## Teammate acceptance checks
Test valid/invalid/expired OTP, resend and attempt limits, double-click/retry idempotency, changed payload with reused key, new-contact bursts, shared Wi-Fi legitimate submissions, independent matching reports, cooldown recovery, network failure, unauthorized admin requests, guessed tracking references, correct private-key access, administrator status updates and publication approval. Verify Tamil text and mobile layout. Document actual thresholds and measured results rather than claiming absolute spam prevention.

## Contact validation
Phone input uses fixed +91 and exactly ten digits; API receives +91 followed by digits. Email requires a complete domain suffix, including .com, .in or other valid suffixes. Backend repeats validation and verifies ownership by OTP.

## Public threat intelligence
Resident /analyst is a public empty state until an approved public-data API is connected. Do not expose administrator reports directly. Proposed GET /intelligence?area=...&days=7 returns only reviewed public groups: shared public indicators, area, dates, review status and bilingual safe steps; no reporter contacts, private notes or access keys. The current area/period inputs hold selections; fetching must be added when this contract is agreed.

## Accessibility verification remaining
Implemented skip link, visible focus, route focus, larger-text toggle, menu expansion state/Escape, reduced-motion styles, result read-aloud with textual equivalent, and static walkthrough steps. Voice availability depends on device language support. Test manually with NVDA, Android TalkBack and iOS VoiceOver, keyboard, 200–400% zoom, contrast auditing and a Braille device/user before claiming complete WCAG or government certification.
