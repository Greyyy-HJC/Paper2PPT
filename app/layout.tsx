import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Paper2PPT — 论文转 Beamer 幻灯片',
  description: '上传论文 PDF，借助静态分析或大模型生成适配 IF-Beamer 模版的 15 页左右幻灯片。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-12 pt-8 lg:px-10">
          <header className="pb-6">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Paper2PPT</p>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">上传论文，一键生成 Beamer 幻灯片</h1>
              <p className="text-sm text-slate-600 sm:text-base">
                支持纯浏览器静态解析，或接入自有大模型 API 获得更高质量摘要与讲稿结构。
              </p>
              <a
                href="https://jinchen.space"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-700"
              >
                访问项目作者主页 →
              </a>
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
