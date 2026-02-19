import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "AI-Portal — Self-hosted AI operations platform",
  description:
    "Chat, virtual assistants, RAG, multi-Agent. Configure via /setup and Admin. Open source, free to use.",
  openGraph: {
    title: "AI-Portal — Self-hosted AI operations platform",
    description:
      "Chat, virtual assistants, RAG, multi-Agent. Open source, free to use.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <LanguageProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
