# Online Alpha Smoke Checklist

This checklist distinguishes local readiness from real online alpha evidence.

## Evidence Levels

- Local pass: local services and mocked tests pass.
- Staging/online pass: deployed admin-web and API URLs are reachable with real environment configuration.
- External embed pass: customer widget works from a separate test domain.
- Real alpha-ready pass: all online checks pass with real Clerk auth, mapped tenant role, real database, and real OpenAI if enabled.

## Online Smoke

1. Open deployed admin-web URL.
2. Confirm unauthenticated `/admin` redirects to `/sign-in`.
3. Sign in through Clerk.
4. Confirm unmapped user cannot access tenant admin data.
5. Bootstrap/map the Clerk user to the alpha tenant and role.
6. Confirm mapped user can access the intended tenant.
7. Confirm mapped user cannot access another tenant without a role.
8. Create or update tenant AI profile.
9. Import or create a knowledge document.
10. Inspect chunks and confirm no unsafe source locator behavior.
11. Run Answer Debug.
12. If OpenAI env changed, run real OpenAI smoke from the deployed/secret-managed environment.
13. Open external widget test page.
14. Ask a knowledge-backed question.
15. Confirm AI answer and citations.
16. Ask a knowledge-miss question.
17. Confirm no hallucinated citation.
18. Request human handoff.
19. Agent signs in through Clerk.
20. Agent replies.
21. Customer sees the agent reply.
22. Customer ends handoff or agent ends human mode.
23. Refresh widget page and confirm conversation restore.
24. Run mobile sanity check for admin and widget.
25. Check browser Network/console for absence of secrets.
26. Check API/admin-web logs for absence of Clerk tokens, OpenAI key, DB URL, admin token, session secret, raw prompts, and auth headers.

Do not mark alpha-ready if any step relies on fake/local-only tokens, mocked Clerk, mocked OpenAI, or localhost-only URLs.
