"use client";

import { DocPage } from "@/components/docs/DocPage";
import { useLanguage } from "@/contexts/LanguageContext";

const URL_FRONTEND = "http://localhost:3000";
const URL_BACKEND = "http://localhost:3001";
const URL_MINIO_API = "http://localhost:9000";
const URL_MINIO_CONSOLE = "http://localhost:9001";

export default function GettingStartedPage() {
  const { t } = useLanguage();

  return (
    <DocPage
      titleKey="docs.nav.gettingStarted"
      nextHref="/docs/admin"
      nextLabelKey="docs.nav.admin"
    >
      <h2>{t("docs.gettingStarted.quickInstallTitle")}</h2>
      <p>{t("docs.gettingStarted.quickInstallIntro")}</p>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        npx create-ai-portal@latest
      </pre>
      <p className="mt-3">
        {t("docs.gettingStarted.quickInstallOptional")}{" "}
        <code>npx create-ai-portal@latest my-portal</code>
      </p>
      <p className="mt-2">
        {t("docs.gettingStarted.quickInstallAfterDownload")}
        <a href={URL_FRONTEND} target="_blank" rel="noopener noreferrer">{URL_FRONTEND}</a>
        {t("docs.gettingStarted.quickInstallAfterLink")}
      </p>

      <h2>{t("docs.gettingStarted.systemReqsTitle")}</h2>
      <ul className="mt-2 space-y-1">
        <li>{t("docs.gettingStarted.systemReqsGit")}</li>
        <li>{t("docs.gettingStarted.systemReqsDocker")}</li>
        <li>{t("docs.gettingStarted.systemReqsNode")}</li>
      </ul>

      <h2>{t("docs.gettingStarted.downloadTitle")}</h2>
      <p>{t("docs.gettingStarted.downloadIntro")}</p>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        {"git clone https://github.com/Lampx83/AI-Portal.git\ncd AI-Portal"}
      </pre>
      <p className="mt-3">{t("docs.gettingStarted.downloadAfterClone")}</p>

      <h2>{t("docs.gettingStarted.runDockerTitle")}</h2>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        {"docker compose build\ndocker compose up -d"}
      </pre>
      <ul className="mt-3 space-y-1">
        <li><strong>{t("docs.gettingStarted.runDockerFrontend")}</strong> <a href={URL_FRONTEND} target="_blank" rel="noopener noreferrer">{URL_FRONTEND}</a></li>
        <li><strong>{t("docs.gettingStarted.runDockerBackend")}</strong> <a href={URL_BACKEND} target="_blank" rel="noopener noreferrer">{URL_BACKEND}</a></li>
        <li><strong>{t("docs.gettingStarted.runDockerPostgres")}</strong></li>
        <li>
          <strong>{t("docs.gettingStarted.runDockerMinIO")}</strong>
          <a href={URL_MINIO_API} target="_blank" rel="noopener noreferrer">{URL_MINIO_API}</a>
          {t("docs.gettingStarted.runDockerMinIOConsole")}
          <a href={URL_MINIO_CONSOLE} target="_blank" rel="noopener noreferrer">{URL_MINIO_CONSOLE}</a>
          {t("docs.gettingStarted.runDockerMinIOSuffix")}
        </li>
      </ul>

      <h2>{t("docs.gettingStarted.runDevDockerTitle")}</h2>
      <p>{t("docs.gettingStarted.runDevDockerIntro")}</p>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        {"docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build"}
      </pre>
      <p className="mt-2">
        {t("docs.gettingStarted.runDevDockerSameUrls")}
        <a href={URL_FRONTEND} target="_blank" rel="noopener noreferrer">{t("docs.gettingStarted.runDockerFrontend")}</a>
        {", "}
        <a href={URL_BACKEND} target="_blank" rel="noopener noreferrer">{t("docs.gettingStarted.runDockerBackend")}</a>
        {t("docs.gettingStarted.runDevDockerEdit")}
      </p>

      <h2>{t("docs.gettingStarted.runDevLocalTitle")}</h2>
      <p>{t("docs.gettingStarted.runDevLocalIntro")}</p>
      <ol className="list-decimal space-y-2 pl-5 mt-2">
        <li>{t("docs.gettingStarted.runDevLocalStep1")}<code>docker compose up -d postgres minio</code></li>
        <li>{t("docs.gettingStarted.runDevLocalStep2")}<code>{"cd backend && npm install && npm run dev"}</code>{t("docs.gettingStarted.runDevLocalStep2Env")}</li>
        <li>{t("docs.gettingStarted.runDevLocalStep3")}<code>{"cd frontend && npm install && npm run dev"}</code>{t("docs.gettingStarted.runDevLocalStep3Env")}</li>
      </ol>
      <p className="mt-2">
        {t("docs.gettingStarted.runDevLocalOpen")}
        <a href={URL_FRONTEND} target="_blank" rel="noopener noreferrer">{URL_FRONTEND}</a>
        {t("docs.gettingStarted.runDevLocalBackendAt")}
        <a href={URL_BACKEND} target="_blank" rel="noopener noreferrer">{URL_BACKEND}</a>
      </p>

      <h2>{t("docs.gettingStarted.firstTimeTitle")}</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>{t("docs.gettingStarted.firstTime1")}<a href={URL_FRONTEND} target="_blank" rel="noopener noreferrer">{URL_FRONTEND}</a>{t("docs.gettingStarted.firstTime1Suffix")}</li>
        <li>{t("docs.gettingStarted.firstTime2")}</li>
        <li>{t("docs.gettingStarted.firstTime3")}</li>
        <li>{t("docs.gettingStarted.firstTime4")}</li>
        <li>{t("docs.gettingStarted.firstTime5")}</li>
        <li>{t("docs.gettingStarted.firstTime6")}</li>
      </ol>
    </DocPage>
  );
}
