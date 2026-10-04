# Production spam protection

All active submission, tracking, support, analysis, OTP and administrator-login limits use MongoDB atomic counters. Counters survive process restarts and are shared by all servers using the same database and APP_SECRET. Keys are hashed; raw client IPs and contacts are not saved in this collection. Expired counters have a TTL index, and requests reset expired windows even before TTL cleanup occurs. If the counter database is unavailable, protected requests fail with 503 instead of bypassing protection.

OTP send attempts are limited separately to one per contact per minute and five per contact per hour. Attempts consume quota before provider delivery, including provider failures, to avoid retry storms. This quota does not depend on short-lived verification documents.

## Hosting configuration

Keep TRUSTED_PROXY_CIDRS empty for local/direct access. Before publishing behind a proxy, set it to the hosting provider's documented proxy source IP addresses/CIDRs. Do not guess these ranges, use a blanket trust setting, or use hop counts. The hosting network must restrict direct backend access to those proxies. Forwarded addresses from other peers are ignored. All replicas must share MongoDB and APP_SECRET. Keep server clocks synchronized.

Public IP limits are temporary cooldowns, not proof of user identity; shared networks can reach the same quota. Existing contact quotas, same-contact duplicate detection, held reports and administrator approval remain in force. These controls do not prove that different contacts/networks belong to one person, and do not guarantee complete bot prevention. A provider-side bot challenge can be added separately if abuse requires it.

## Checks

Run npm run test:integration for route regression checks using adapters. Run npm run test:spam for live MongoDB atomic/shared-counter and proxy-spoofing checks; it creates uniquely scoped test counters and removes only those counters afterward. It sends no SMS/email and creates no reports.

Deploy with npm run build followed by npm start. Restart an existing backend after code updates. The startup initializes the counter collection/index before accepting traffic. Public launch still requires hosting-specific proxy values and a hosted end-to-end check from two client networks.
