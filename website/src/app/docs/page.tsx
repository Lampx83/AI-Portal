export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white">Documentation</h1>
      <p className="mt-4 text-white/70">
        Hướng dẫn và tài liệu AI-Portal — website chính:
      </p>
      <p className="mt-2">
        <a
          href="https://ai-portal-nine.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 font-medium hover:underline"
        >
          https://ai-portal-nine.vercel.app/
        </a>
      </p>
      <p className="mt-6 text-white/70">
        Trong repo GitHub:
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
    </div>
  );
}
