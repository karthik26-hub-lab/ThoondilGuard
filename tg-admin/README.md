# ThoondilGuard administrator workspace

Separate resident-compatible admin frontend for one Administrator role. The current app is a demo and must not hold live resident information until backend authentication and authorisation are connected.

## Review locally
Install dependencies with `npm install`, then `npm run dev`. Open the local address and select **Preview demo workspace**. The sign-in fields are disabled because no authentication service is configured. Demo changes persist in the current browser session. Sign out removes preview access; Settings can reset the sample state.

## Implemented UI flows
- Overview with counts derived from five synthetic reports.
- Search and filters for date, status, concern, language, channel and area.
- Individual masked evidence, synthetic automated assessment, administrator decision and required rationale.
- Candidate indicator groups with confirm/reject reasons.
- Bilingual alert draft, exact resident preview, validation, demo publication and withdrawal.
- Local illustrative activity history, extension connection status and settings.
- English/Tamil language preference, keyboard focus, narrow-window navigation and unsaved-change warnings.

All publication is local demo state; no resident notifications, shared reports or official deployment are represented. Administrator notes are excluded from alert previews. Follow BACKEND-HANDOFF.md to connect real services. Browser/session flags are not authentication or server permissions. Windows installer packaging remains a later step.

## Verify
`npm run build` checks types and builds. `npm run lint` checks source. The separate public resident portal is unchanged by this project.
