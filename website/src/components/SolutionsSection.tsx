const solutions = [
  {
    title: "For Developers",
    description:
      "Integrate AI-Portal with your stack. REST APIs, Docker, and a clear Admin for agents and apps.",
    cta: "Quick Start",
  },
  {
    title: "For Teams",
    description:
      "Central assistant and custom assistants. Share one portal across the team with role-based access.",
    cta: "Documentation",
  },
  {
    title: "Enterprise",
    description:
      "Self-host on your infrastructure. Full control over data, compliance, and scaling.",
    cta: "Deploy guide",
  },
];

export function SolutionsSection() {
  return (
    <section
      id="solutions"
      className="border-b border-white/10 bg-[#070708] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Solutions for every use case
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
            From side projects to production. AI-Portal adapts to your needs.
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {solutions.map((sol) => (
            <div
              key={sol.title}
              className="rounded-xl border border-white/10 bg-[#0a0a0f] p-6"
            >
              <h3 className="text-xl font-semibold text-white">{sol.title}</h3>
              <p className="mt-3 text-white/70">{sol.description}</p>
              <a
                href="/#hero"
                className="mt-4 inline-block text-sm font-medium text-brand-400 hover:text-brand-300"
              >
                {sol.cta} →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
