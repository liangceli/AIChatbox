import { LocalChatDemo } from "./components/local-chat-demo";

const surfaceAreas = [
  "Tenant configuration and branding",
  "Agent prompts and escalation policy",
  "Knowledge-base and ingestion status",
  "Conversation monitoring and human handoff"
];

export default function HomePage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "kasta";

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Admin Surface</p>
        <h1>White-label AI support operations</h1>
        <p className="lede">
          This starter admin app is intentionally thin. It establishes the internal dashboard boundary
          without baking in any tenant-specific workflows.
        </p>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Platform posture</h2>
          <p>
            Shared logic belongs in packages and tenant-scoped database records. Brand, prompt, and
            escalation differences should come from configuration, not forks.
          </p>
        </article>

        <article className="panel">
          <h2>Initial focus areas</h2>
          <ul>
            {surfaceAreas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Live local test</h2>
          <LocalChatDemo apiBaseUrl={apiBaseUrl} tenantSlug={tenantSlug} />
        </article>
      </section>
    </main>
  );
}
