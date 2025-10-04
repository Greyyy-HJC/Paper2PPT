# Agent Notes — Paper2PPT

欢迎来到 Paper2PPT！本说明概述当前能力、关键资产与开发约束，便于后续自动化协作。

## 现状概览
- 前端：Next.js 14 + TypeScript + Tailwind，`app/components/GeneratorPanel.tsx` 提供静态生成与 LLM 生成两种流程，支持模型下拉选择与自定义服务。
- 静态模式：`lib/static/staticGenerator.ts` 在浏览器内解析 PDF、构建幻灯片结构并打包模板，worker 文件位于 `public/pdf.worker.min.js`。
- LLM 模式：`app/api/generate/route.ts` 调度 `lib/server/llm.ts`，现已适配 OpenAI / DeepSeek（chat completions）、Azure OpenAI（api-key 头）以及 Anthropic Claude `/v1/messages` 协议。
- 模板资源：位于 `public/templates/if-beamer/`，`manifest.json` 控制打包资源。
- 构建：`npm run build` 输出常规 SSR 版本；`npm run build:static`（设置 `STATIC_EXPORT=true`）用于 GitHub Pages，仅保留静态模式。

## 关键流程
1. **PDF 抽取**：`lib/pdf/extract.ts` 基于 `pdfjs-dist` 读取章节文本与元数据。
2. **启发式分析**：`lib/core/analyzer.ts` 生成 Outline、Slides、Closing 等结构，并在需要时提供 LLM 的兜底数据。
3. **LLM 调用（可选）**：`lib/server/llm.ts` 组装提示词、调用 `chat/completions`，合并模型输出与兜底逻辑。
4. **LaTeX 渲染**：`lib/templates/ifBeamer.ts` 按模板生成 `main.tex`。
5. **打包下载**：静态模式使用 JSZip（浏览器）；LLM 模式由 API Route 在 Node 中打包后以 Base64 返回。

## 约束与约定
- 代码默认 ASCII，仅在必要处添加简明注释。
- `NEXT_PUBLIC_STATIC_EXPORT=true` 时前端会隐藏 LLM UI；不要在静态构建里依赖 API Route。
- 模板文件如需更新，请同步修改 `public/templates/if-beamer/manifest.json`，保持打包资源一致。
- 不要提交用户 API Key/敏感信息至仓库；调试后请清理本地存储。

## 待办方向
- 提升静态模式摘要质量（更细化段落划分、引用图表）。
- 扩展 LLM 适配层（如 Google Gemini、Moonshot、百度千帆等）。
- 添加生成后可视化预览、手动编辑与多模板支持。
- 引入单元测试 / e2e 流程以保障 PDF 解析与 LaTeX 生成的稳定性。

祝开发顺利！
