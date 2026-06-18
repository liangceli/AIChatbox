# Current Stage

Date: 2026-06-18

Stage: Clerk local business loop hardening and verification.

Active goal: real company users must sign in locally with Clerk, map to tenant roles, manage knowledge, run Answer Debug, use the customer widget, request human support, and receive agent replies with tenant isolation enforced.

Current implementation focus:
- Admin Web verifies Clerk sessions and proxies admin API calls through same-origin server routes.
- API verifies Clerk JWTs in `ADMIN_API_PROTECTION_MODE=clerk`.
- Verified Clerk users are mapped to existing platform users and tenant roles before tenant data is returned.
- Admin conversation actions now use the verified server-side Clerk mapping as the acting support user.
- `/admin/:path*` and `/agent` are protected by Admin Web middleware.
- Widget chat persists customer messages before calling OpenAI, then stores assistant replies in a second short transaction so slow model calls do not expire database transactions.

Current status: code hardening and non-browser API verification are in progress; full real-Clerk browser QA is blocked in the automation browser by external network access denial to Clerk CDN and must be completed in a normal browser session.
