# Architecture Notes

## Platform Shape

The repository separates platform capabilities from tenant-specific runtime behavior:

- `apps/api` owns HTTP boundaries, authentication, admin APIs, widget APIs, and future handoff endpoints.
- `apps/ai-worker` owns asynchronous ingestion, retrieval, summarization, and future orchestration jobs.
- `apps/admin-web` is the internal operational UI.
- `apps/customer-widget` is the embeddable end-user surface.
- `packages/*` hold reusable domain contracts and infrastructure helpers.

## Why This Shape

- It keeps widget delivery independent from admin UI concerns.
- It avoids locking AI workflows into the API process.
- It allows future queue-backed jobs without repo-level restructuring.
- It makes tenant boundaries explicit in both schema and code organization.

## Extension Points

- Add authentication and authorization modules in `apps/api`
- Add vector indexing and retrieval workers in `apps/ai-worker`
- Add tenant-level prompt and integration editors in `apps/admin-web`
- Add channel adapters later for email, WhatsApp, or CRM workflows
