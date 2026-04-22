const surfaceAreas = [
  "Tenant configuration and branding",
  "Agent prompts and escalation policy",
  "Knowledge-base and ingestion status",
  "Conversation monitoring and human handoff"
];

export default function HomePage() {
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
      </section>
    </main>
  );
}
