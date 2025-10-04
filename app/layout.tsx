import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Paper2PPT — Paper to Beamer Slides',
  description: 'Upload a research paper PDF and generate a 15-page Beamer deck tailored to the IF-Beamer template.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-12 pt-8 lg:px-10">
          <header className="pb-6">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Paper2PPT</p>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Generate Beamer slides from your PDF</h1>
              <p className="text-sm text-slate-600 sm:text-base">
                Works offline with heuristics, or plug in your own LLM API key for higher quality summaries.
              </p>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="pt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Paper2PPT. Template by IF-Beamer authors.
          </footer>
        </div>
      </body>
    </html>
  );
}
