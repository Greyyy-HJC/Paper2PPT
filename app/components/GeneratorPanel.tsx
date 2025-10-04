'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GeneratedDeck } from '@/lib/types';
import { generateStaticDeck } from '@/lib/static/staticGenerator';

type Mode = 'static' | 'llm';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI-Compatible',
  anthropic: 'Anthropic',
  azure: 'Azure OpenAI',
  custom: 'Custom Endpoint',
};

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-sonnet-20240229',
  azure: 'gpt-4o-mini',
  custom: 'gpt-4o-mini',
};

const CARD_CLASSES =
  'rounded-3xl border border-white/60 bg-white/90 p-6 shadow-[0_28px_60px_-30px_rgba(30,41,59,0.45)] backdrop-blur-xl';

const STATIC_ONLY = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';
const AVAILABLE_MODES: Mode[] = STATIC_ONLY ? ['static'] : ['static', 'llm'];

function base64ToBlob(base64: string, contentType = 'application/zip'): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

function usePersistentState(key: string, initialValue: string) {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    return window.localStorage.getItem(key) ?? initialValue;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

export default function GeneratorPanel() {
  const [mode, setMode] = useState<Mode>('static');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [targetSlides, setTargetSlides] = useState(12);
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'azure' | 'custom'>('openai');
  const [model, setModel] = useState(DEFAULT_MODEL_BY_PROVIDER.openai);
  const [apiKey, setApiKey] = usePersistentState('paper2ppt-api-key', '');
  const [apiBaseUrl, setApiBaseUrl] = usePersistentState('paper2ppt-api-base', 'https://api.openai.com/v1');

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deck, setDeck] = useState<GeneratedDeck | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>('Paper2PPT.zip');

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  useEffect(() => {
    setModel(DEFAULT_MODEL_BY_PROVIDER[provider] ?? 'gpt-4o-mini');
  }, [provider]);

  const outlinePreview = useMemo(() => deck?.outline ?? [], [deck]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== 'application/pdf') {
      setErrorMessage('请上传 PDF 文件。');
      return;
    }
    setPdfFile(file);
    setErrorMessage(null);
  }, []);

  const handleGenerateStatic = useCallback(async () => {
    if (!pdfFile) {
      setErrorMessage('请先选择一份论文 PDF。');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('解析 PDF 并生成初稿…');
    setErrorMessage(null);

    try {
      const { deck: generatedDeck, zipBlob, zipFilename } = await generateStaticDeck(pdfFile, {
        targetSlides,
      });
      setDeck(generatedDeck);
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      const url = URL.createObjectURL(zipBlob);
      setDownloadUrl(url);
      setDownloadName(zipFilename);
      setStatusMessage('生成完成，可下载 ZIP 或进一步编辑。');
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : '静态生成失败，请稍后再试。');
    } finally {
      setIsGenerating(false);
    }
  }, [pdfFile, targetSlides, downloadUrl]);

  const handleGenerateLlm = useCallback(async () => {
    if (!pdfFile) {
      setErrorMessage('请先选择一份论文 PDF。');
      return;
    }
    if (!apiKey.trim()) {
      setErrorMessage('请输入有效的大模型 API Key。');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('调用大模型生成摘要与幻灯片结构…');
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('mode', 'llm');
      formData.append('provider', provider);
      formData.append('model', model);
      formData.append('apiBaseUrl', apiBaseUrl);
      formData.append('targetSlides', String(targetSlides));
      formData.append('file', pdfFile);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || '服务端生成失败，请稍后再试。');
      }

      const payload = (await response.json()) as {
        deck: GeneratedDeck;
        filename: string;
        zipBase64: string;
      };

      if (payload.deck) {
        setDeck(payload.deck);
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      const blob = base64ToBlob(payload.zipBase64);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadName(payload.filename ?? `Paper2PPT-${Date.now()}.zip`);
      setStatusMessage('生成完成，可下载 ZIP。');
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : '调用大模型失败，请检查参数。');
    } finally {
      setIsGenerating(false);
    }
  }, [pdfFile, apiKey, provider, model, apiBaseUrl, targetSlides, downloadUrl]);

  const handleGenerate = useCallback(async () => {
    if (mode === 'static') {
      await handleGenerateStatic();
    } else {
      await handleGenerateLlm();
    }
  }, [mode, handleGenerateStatic, handleGenerateLlm]);

  const downloadButton = downloadUrl ? (
    <a
      href={downloadUrl}
      download={downloadName}
      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
    >
      下载 ZIP
    </a>
  ) : null;

  return (
    <div className="space-y-8">
      <section className={`${CARD_CLASSES} space-y-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 rounded-full bg-slate-100 p-1 text-sm font-semibold">
            {AVAILABLE_MODES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-4 py-1 transition ${
                  mode === value ? 'bg-white text-slate-900 shadow-inner' : 'text-slate-500'
                }`}
              >
                {value === 'static' ? '静态生成（离线可用）' : 'LLM 驱动（高质量）'}
              </button>
            ))}
          </div>

          {STATIC_ONLY && (
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600">
              GitHub Pages 版本仅提供静态生成，如需调用大模型请在本地运行。
            </span>
          )}

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              静态版：浏览器内解析
            </div>
            {!STATIC_ONLY && (
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                LLM：需要个人 API Key
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <label
              htmlFor="pdf-upload"
              className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center transition hover:border-slate-400 hover:bg-white"
            >
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="text-base font-medium text-slate-800">
                {pdfFile ? pdfFile.name : '拖拽或点击上传论文 PDF'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                文件仅在浏览器中处理，不会上传至服务器（除非启用 LLM 模式）。
              </p>
            </label>

            <div className="rounded-2xl bg-slate-50 p-4">
              <label className="flex items-center justify-between text-sm text-slate-600">
                <span>目标幻灯片页数</span>
                <span className="font-semibold text-slate-900">{targetSlides}</span>
              </label>
              <input
                type="range"
                min={8}
                max={18}
                value={targetSlides}
                onChange={(event) => setTargetSlides(Number(event.target.value))}
                className="mt-3 w-full"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
            {mode === 'llm' ? (
              <>
                <label className="block space-y-2 text-sm text-slate-600">
                  <span>模型服务提供商</span>
                  <select
                    value={provider}
                    onChange={(event) => setProvider(event.target.value as typeof provider)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                  >
                    {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2 text-sm text-slate-600">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">保存在浏览器 LocalStorage，仅用于当前机器。</span>
                </label>

                <label className="block space-y-2 text-sm text-slate-600">
                  <span>模型名称</span>
                  <input
                    type="text"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>

                <label className="block space-y-2 text-sm text-slate-600">
                  <span>API Base URL</span>
                  <input
                    type="text"
                    value={apiBaseUrl}
                    onChange={(event) => setApiBaseUrl(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                  />
                </label>
              </>
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">静态生成说明</p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                  <li>直接在浏览器中解析 PDF，提取标题、章节与要点。</li>
                  <li>按照 IF-Beamer 模版生成 LaTeX 文件并打包。</li>
                  <li>生成的内容适合作为初稿，可手动进一步润色。</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isGenerating ? '生成中…' : mode === 'static' ? '生成静态幻灯片' : '调用 LLM 生成'}
          </button>
          {downloadButton}
          {statusMessage && <p className="text-xs text-slate-500">{statusMessage}</p>}
        </div>
        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}
      </section>

      {deck && (
        <section className={`${CARD_CLASSES} space-y-6`}>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">生成概要</h2>
            <p className="mt-1 text-sm text-slate-500">
              {deck.metadata.paperTitle}
            </p>
            {deck.metadata.authors && (
              <p className="text-xs text-slate-400">{deck.metadata.authors}</p>
            )}
          </div>

          {outlinePreview.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Outline</h3>
              <ul className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                {outlinePreview.map((item, index) => (
                  <li key={item + index} className="rounded-xl bg-slate-100 px-3 py-2">
                    {index + 1}. {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Slides Preview</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {deck.slides.map((slide) => (
                <div key={slide.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                  <p className="font-semibold text-slate-800">{slide.title}</p>
                  {slide.section && (
                    <p className="text-xs uppercase tracking-wide text-slate-400">{slide.section}</p>
                  )}
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {slide.blocks
                      .filter((block) => block.kind === 'bullets')
                      .flatMap((block) => (block.kind === 'bullets' ? block.items : []))
                      .slice(0, 4)
                      .map((item, index) => (
                        <li key={`${slide.id}-${index}`}>{item}</li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
