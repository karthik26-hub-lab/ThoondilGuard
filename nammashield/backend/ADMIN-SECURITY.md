# Administrator access

Administrator API requests are restricted to ADMIN_ORIGIN, independently of the resident portal's CLIENT_ORIGIN. Set ADMIN_ORIGIN to the administrator portal's exact origin. Local defaults are http://localhost:4190 and http://127.0.0.1:4190. Production requires explicit HTTPS origins and rejects known default administrator passwords and malformed password hashes at startup.

Use HTTPS sibling domains such as admin.your-domain.in and api.your-domain.in, or serve the API under the administrator portal's origin. The cookie is HttpOnly, SameSite=Strict, Secure in production, and scoped to /api/admin. An administrator site and API hosted on unrelated domains will not support this cookie configuration. Restrict the admin host to designated users through your hosting/network access policy when available.

Sessions expire after two hours, or after 30 minutes without authenticated activity. Tokens are random and stored only as hashes. Changing ADMIN_USERNAME or ADMIN_PASSWORD_HASH and restarting invalidates all previous sessions. Logout deletes the session. Admin responses are marked no-store. Login attempts use shared MongoDB rate limits. Existing sessions created before this update require a fresh sign-in.

Support screenshots are accessible through authenticated /api/admin/attachments/:filename routes. The former public /api/uploads route is removed. Screenshots use download responses, validated image signatures and nosniff. New uploads are capped at 5 MB and restricted to PNG/JPEG/WebP. Local disk uploads must be moved to shared private storage before running servers on multiple machines; database rate limits are already shared.

## Choose the production password locally

From PowerShell run:

```powershell
& 'C:\Users\KARTHIK\Desktop\rec\nammashield\backend\scripts\reset-admin-secure.ps1'
```

Enter ThoondilGuard_Admin and a new unique password of at least 14 characters. The password entry is hidden and the backend .env receives only its hash. Restart the backend afterward. Do not change APP_SECRET during a password reset: changing that secret would also invalidate report tracking keys.

For deployment, configure ADMIN_USERNAME, ADMIN_PASSWORD_HASH, APP_SECRET, ADMIN_ORIGIN, CLIENT_ORIGIN, NODE_ENV=production and the hosting-specific trusted proxy values in your hosting provider's secret configuration. This adds session/access protections; authenticator-based MFA is not implemented by this change. Test real HTTPS login, logout and attachment access on the hosted domains before public launch.
