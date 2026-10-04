# NammaShield - Hackathon Prototype

A community fraud early-warning web app designed for residents in Tamil Nadu. This prototype demonstrates a "Liquid Glass" modern interface with high usability, privacy-first reporting, and a robust pattern detection system.

## 🚀 Features

- **Check Messages:** Instantly analyze SMS or URLs for suspicious patterns (Urgency, requests for credentials, dangerous URLs, common English/Tamil/Tanglish scam phrases).
- **Report & Warn:** Submit anonymous reports to alert your local community.
- **Privacy-First:** Automatically redacts phone numbers, emails, and account digits before storing or displaying them.
- **Community Alerts:** View recent scams reported in your region.
- **Web Verification Chat:** A simple, conversational AI interface (prototype for WhatsApp integration).
- **Threat Analyst View:** An aggregator dashboard grouping scams into identifiable campaigns.

## 🛠️ Architecture

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, Framer Motion (for Liquid Glass transitions)
- **Icons:** Lucide React
- **Storage:** LocalStorage (Simulated database to run locally without APIs)
- **Detection Logic:** Client-side rule-based regex and keyword matching (`src/lib/detector.ts`)

## 🎨 Privacy Choices

- Reports never collect names, IP addresses, or tracking identifiers.
- A client-side scrubber (`redactPII`) removes likely 10-digit phone numbers and emails *before* reports are saved.
- "Region" is used instead of precise GPS to maintain anonymity while keeping alerts relevant.

## 📝 Status of Features

- **Working:** 
  - Real-time text analysis and regex scoring.
  - Form submission and local storage persistence.
  - Automatic PII redaction.
  - Regional filtering on Alerts page.
  - Threat analyst metric calculations based on reported data.
- **Simulated:**
  - Network latency (artificial delay added to mimic server processing).
  - Web Chat (responds with standard analysis, simulating a future WhatsApp bot).
- **Planned (Post-Hackathon):**
  - Live PostgreSQL database via Supabase.
  - WhatsApp Business API integration.
  - NLP-based ML classification instead of static regex rules.

## ⚙️ How to Run

1. `npm install`
2. `npm run dev`
3. Open `http://localhost:5173` in your browser.
