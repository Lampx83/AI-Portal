const features = [
  {
    title: "Chat & Central Assistant",
    description:
      "Built-in chat UI and configurable Central assistant. Connect OpenAI, Gemini, or your own LLM via Admin.",
    icon: "💬",
  },
  {
    title: "Virtual Assistants & Agents",
    description:
      "Register external Agent APIs. Each assistant has its own alias and endpoint. Multi-agent workflows supported.",
    icon: "🤖",
  },
  {
    title: "RAG & Knowledge",
    description:
      "Use Qdrant and your data for retrieval-augmented generation. Configure in Admin → System settings.",
    icon: "📚",
  },
  {
    title: "Self-hosted",
    description:
      "Docker Compose stack: PostgreSQL, Qdrant, backend, frontend. You own the data and the infrastructure.",
    icon: "🔒",
  },
  {
    title: "Setup wizard",
    description:
      "First run: /setup for language, branding, database, admin account, and optional Central LLM. No manual .env.",
    icon: "⚙️",
  },
  {
    title: "Admin panel",
    description:
      "Manage agents, applications, system settings, and users from a single admin UI.",
    icon: "🛠️",
  },
];

export function ProductSection() {
  return (
    <section
      id="product"
      className="border-b border-white/10 bg-[#0a0a0f] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to run AI in production
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
            One platform for chat, assistants, RAG, and agents. Configure once,
            scale with your team.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-brand-500/30 hover:bg-white/[0.07]"
            >
              <div className="text-2xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-white/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
