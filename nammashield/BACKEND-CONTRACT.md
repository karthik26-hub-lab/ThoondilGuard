# Checker connector
Set VITE_BACKEND_URL in .env.local to the deployed API base URL and restart/rebuild. Leave blank for explicitly labelled local demo rules.

POST /analyze with JSON { "text": "message", "language": "en" } (en or ta). Response: { "riskLevel": "Needs verification", "findings": ["reason"], "actions": ["next step"] }. Allowed riskLevel values: High concern, Needs verification, No strong warning signs found. Keep these values in English; return explanations in the requested language.

Use HTTPS and allow the frontend origin in CORS, including OPTIONS and Content-Type. Database credentials and model keys stay on the server. Common personal details are masked before sending, but masking is imperfect. Do not log or store input by default. Rate limit and validate requests. API errors/timeouts are displayed; they never silently fall back to demo. Timeout: 10 seconds.

This connector covers analysis only. Reports and alerts still use local prototype storage. A database dataset by itself is not a detection service; the API must implement analysis. Screenshot OCR uses English OCR assets downloaded separately; Tamil OCR and offline scanning are not promised.
