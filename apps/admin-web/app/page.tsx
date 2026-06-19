import Image from "next/image";
import Link from "next/link";

const performanceCards = [
  { value: "+43%", label: "Faster resolution", copy: "Ground every answer in approved company knowledge." },
  { value: "11k+", label: "Questions handled", copy: "Scale support without losing the context behind each reply." },
  { value: "24/7", label: "Always available", copy: "Keep service moving, then route the right cases to people." }
];

const questions = [
  {
    question: "How does the AI learn?",
    answer: "Connect approved, tenant-scoped knowledge sources. Solaris retrieves relevant evidence for each question and keeps citations attached to supported answers."
  },
  {
    question: "Can I integrate it with my existing support workflow?",
    answer: "Yes. The customer widget, shared conversation history, and Agent inbox are designed to fit around your existing service process without mixing tenant data."
  },
  {
    question: "Is there a free trial?",
    answer: "New workspaces can be created free. Access is activated through an invitation from a platform administrator so company data and roles stay controlled."
  }
];

function EmailCta({ dark = false }: { dark?: boolean }) {
  return (
    <form className="landing-email-form" action="/sign-up">
      <label className="sr-only" htmlFor={dark ? "footer-email" : "hero-email"}>Work email</label>
      <input id={dark ? "footer-email" : "hero-email"} name="email" type="email" placeholder="Enter your work email" autoComplete="email" />
      <button type="submit" className={dark ? "is-dark" : undefined}>Start for free</button>
    </form>
  );
}

export default function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link href="/" className="landing-wordmark" aria-label="Solaris AI home">SOLARIS AI</Link>
        <nav className="landing-nav" aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#features">Features</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="landing-actions">
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="landing-dark-button">Start for free</Link>
        </div>
      </header>

      <section className="landing-hero" id="product" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">AI support that stays grounded</p>
          <h1 id="landing-title">Help, convert, and grow with <span>evidence-driven AI</span></h1>
          <p className="landing-lead">Turn company knowledge into instant answers, smooth handoffs, and customer conversations that keep their context.</p>
          <EmailCta />
          <div className="landing-trust-line"><span>✓ Free to start</span><span>✓ No card required</span></div>
        </div>
        <div className="landing-hero-visual">
          <Image src="/images/landing/team-collaboration.png" alt="A support team collaborating around a laptop" fill sizes="(max-width: 760px) 100vw, 52vw" priority />
        </div>
      </section>

      <section className="landing-feature landing-feature-photo" id="features">
        <div className="landing-photo-card">
          <Image src="/images/landing/support-specialist.png" alt="A support specialist helping a customer across laptop and mobile" fill sizes="(max-width: 760px) 100vw, 46vw" />
          <div className="landing-message-card" aria-hidden="true">
            <span className="landing-avatar-dot">S</span><i /><i />
            <b className="material-symbols-outlined">mail</b>
          </div>
        </div>
        <div className="landing-feature-copy">
          <p className="landing-eyebrow">One conversation, everywhere</p>
          <h2>Support customers across every channel</h2>
          <p>Meet customers in the widget, keep a single conversation history, and bring in a human Agent without making anyone start over.</p>
          <a href="#solutions" className="landing-dark-button">Explore channels</a>
        </div>
      </section>

      <section className="landing-solutions" id="solutions">
        <article className="landing-solution-row">
          <div className="landing-feature-copy">
            <p className="landing-eyebrow">Act on real intent</p>
            <h2>Surface the right answer automatically</h2>
            <p>Use approved knowledge and retrieval evidence to respond precisely while keeping tenant data inside its boundary.</p>
            <Link href="/sign-up" className="landing-dark-button">Connect knowledge</Link>
          </div>
          <div className="landing-browser-mock" aria-label="Knowledge recommendations preview">
            <div className="mock-browser-bar"><i /><i /><i /></div>
            <div className="mock-products">
              <div><span className="material-symbols-outlined">inventory_2</span><i /><i /></div>
              <div><span className="material-symbols-outlined">inventory_2</span><i /><i /></div>
            </div>
          </div>
        </article>

        <article className="landing-solution-row is-reversed">
          <div className="landing-agent-card">
            <Image src="/images/landing/agent-tablet.png" alt="A support Agent reviewing a customer conversation" fill sizes="(max-width: 760px) 100vw, 46vw" />
            <div className="landing-answer-lines" aria-hidden="true"><i /><i /><i /></div>
            <div className="landing-chips"><span>Automation</span><span>Grounded AI</span></div>
          </div>
          <div className="landing-feature-copy">
            <p className="landing-eyebrow">Human when it matters</p>
            <h2>Deliver on-point answers</h2>
            <p>Answer instantly when evidence exists, preserve the full conversation, and route sensitive or complex cases to the right Agent.</p>
            <Link href="/sign-in" className="landing-dark-button">Open your workspace</Link>
          </div>
        </article>
      </section>

      <section className="landing-dark-section" id="pricing">
        <div className="landing-dark-heading">
          <p className="landing-eyebrow">Built for dependable service</p>
          <h2>An AI Agent that works like part of your team</h2>
          <p>Resolve routine questions around the clock while your people focus on conversations that need judgment.</p>
        </div>
        <div className="landing-metrics">
          {performanceCards.map((card) => (
            <article key={card.value}>
              <strong>{card.value}</strong>
              <h3>{card.label}</h3>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>

        <div className="landing-faq">
          <p className="landing-eyebrow">Clear answers</p>
          <h2>Frequently asked questions</h2>
          <div className="landing-faq-list">
            {questions.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>{item.question}<span aria-hidden="true" /></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-final-cta">
        <p className="landing-eyebrow">Start today</p>
        <h2>Build better customer support with Solaris AI.</h2>
        <EmailCta dark />
        <div className="landing-trust-line"><span>✓ Free to start</span><span>✓ No card required</span></div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand"><strong>SOLARIS AI</strong><p>Grounded answers, secure tenant boundaries, and one continuous support conversation.</p></div>
        <div><strong>Product</strong><a href="#features">Features</a><a href="#solutions">Solutions</a><Link href="/chat">Chat demo</Link></div>
        <div><strong>Platform</strong><Link href="/sign-in">Sign in</Link><Link href="/sign-up">Create account</Link><Link href="/access-pending">Access</Link></div>
        <div><strong>Company</strong><a href="#product">About</a><a href="#pricing">Pricing</a><a href="mailto:support@example.com">Contact</a></div>
        <div className="landing-footer-meta"><strong>Secure by design</strong><span>Tenant scoped</span><span>Evidence grounded</span></div>
        <small>© 2026 Solaris AI. All rights reserved.</small>
      </footer>
    </main>
  );
}
