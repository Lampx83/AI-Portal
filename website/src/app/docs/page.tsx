export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white">Documentation</h1>
      <p className="mt-4 text-white/70">
        Docs are available in the main AI-Portal repository:
      </p>
      <ul className="mt-6 space-y-2 text-brand-400">
        <li>
          <a
            href="https://github.com/Lampx83/AI-Portal/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            README — Overview and quick start
          </a>
        </li>
        <li>
          <a
            href="https://github.com/Lampx83/AI-Portal/blob/main/docs/DEVELOPERS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            DEVELOPERS.md — Developer guide
          </a>
        </li>
        <li>
          <a
            href="https://github.com/Lampx83/AI-Portal/tree/main/packages/cli/create-ai-portal"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            create-ai-portal — CLI usage
          </a>
        </li>
      </ul>
      <p className="mt-8 text-sm text-white/50">
        A dedicated docs site can be added here later. For now, all guides live in
        the repo.
      </p>
    </div>
  );
}
