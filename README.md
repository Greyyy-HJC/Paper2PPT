# Paper2PPT

Paper2PPT 将学术论文 PDF 快速转化为可导入 Overleaf 的 IF-Beamer 幻灯片。应用同时提供两种模式：

1. **静态模式（GitHub Pages 兼容）**：在浏览器内解析 PDF，使用启发式摘要生成约 15 页的初稿幻灯片，并将 `main.tex` 与模版资源打包下载。
2. **LLM 模式（本地运行）**：调用个人的大模型 API Key（OpenAI 兼容 / Azure OpenAI / Anthropic Claude / DeepSeek 等）生成更贴合论文结构的总结、要点与备注，再输出同样的打包结果。

## 功能概览
- 📄 **PDF 解析**：基于 `pdfjs-dist` 抽取标题、作者、章节线索与关键语句。
- 🧠 **多策略内容建模**：静态模式使用启发式切分；LLM 模式将提取的上下文交给模型生成 JSON 结构，再与内置安全兜底逻辑融合。
- 🎯 **Beamer 渲染**：使用 `renderIfBeamerDocument` 将结构化内容映射为 LaTeX，并自动生成目录、章节、结尾页。
- 🗂️ **模板打包**：`main.tex` + `if-beamer.cls` + `figuras/` 统一打包为 `Paper2PPT-{timestamp}.zip`，可直接上传到 Overleaf。
- 👀 **网页预览**：在生成后展示 Outline 与每页要点，便于快速校对。

## 快速开始（本地运行，支持 LLM）
```bash
npm install
npm run dev
# 浏览器访问 http://localhost:3000
```

- 选择 PDF 后，可切换到 **“LLM 驱动”** 模式，填写 API Key、模型名称与 Base URL（默认指向 OpenAI）。
- 静态模式无需任何密钥，全部逻辑在浏览器端完成。

## GitHub Pages / 纯静态部署
若只需静态初稿版本，可执行：
```bash
npm install
npm run build:static
```
- 构建产物位于 `out/`，可直接推送到 `gh-pages` 分支或部署任意静态站点。
- 静态构建时会自动设置 `NEXT_PUBLIC_STATIC_EXPORT=true`，前端仅保留静态模式 UI。

## 目录结构
```
.
├── app/                     # Next.js App Router 页面与组件
│   ├── components/          # UI 与交互逻辑（GeneratorPanel 等）
│   └── api/generate/        # LLM 模式使用的服务器端生成接口
├── lib/
│   ├── core/analyzer.ts     # PDF 文本启发式分析与 slide 结构生成
│   ├── pdf/extract.ts       # 基于 pdfjs-dist 的文本抽取
│   ├── static/staticGenerator.ts # 浏览器端静态生成 + ZIP 打包
│   ├── server/llm.ts        # LLM 提示词组织与响应解析
│   └── templates/ifBeamer.ts # IF-Beamer LaTeX 渲染函数
├── public/templates/if-beamer/
│   ├── if-beamer.cls
│   ├── figuras/logoPPGCA.png
│   ├── main.tex             # 模版示例（仅展示，不直接使用）
│   └── manifest.json        # 打包所需资源清单
└── README.md / agent.md     # 项目说明与智能体指南
```

## 开发说明
- Node.js ≥ 18，默认使用 npm；可按需改用 pnpm。
- TypeScript 处于 `strict` 模式，新增代码请尽量补全类型。
- LLM API 调用支持 OpenAI 兼容（含 DeepSeek）、Azure OpenAI 以及 Anthropic Claude（`/v1/messages`）；填写 Base URL 时请按照官方文档携带部署路径与 `api-version`。
- 静态生成模式在浏览器内下载 ZIP，不会将论文上传到服务器。

## 预设模型与官方 API（更新于 2025-02）
> 资料来源：OpenAI Platform、Microsoft Azure OpenAI、Anthropic API、DeepSeek API 公告。

| 提供商 | 默认 Base URL 示例 | 推荐模型 / 部署名称 |
| --- | --- | --- |
| OpenAI / 兼容接口 | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `o1`, `o1-mini` |
| Azure OpenAI | `https://{resource}.openai.azure.com/openai`<br/>（需附 `?api-version=2024-02-15-preview` 等查询参数） | 自定义部署名称，默认列出 `gpt-4o`, `gpt-4o-mini`, `gpt-35-turbo` |
| Anthropic Claude | `https://api.anthropic.com/v1` | `claude-3.5-sonnet-20240620`, `claude-3.5-haiku-20240620`, `claude-3-opus-20240229`, `claude-3-sonnet-20240229` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-reasoner` |
| 自定义兼容接口 | 用户自填 | 任意遵循 OpenAI Chat Completions 的模型标识 |

前端会根据所选提供商切换模型下拉列表，并在需要时自动添加请求头（如 Anthropic `x-api-key`、Azure `api-key`）。

## 模板资产
- 模板位于 `public/templates/if-beamer/`，`manifest.json` 控制需要复制进压缩包的文件。
- 原始 `Beamer_template.zip` 仅作为备份保留在同一目录，默认不随结果导出。

## TODO & 后续方向
- 更细粒度的段落/图表识别，提高静态模式质量。
- 接入更多 LLM（Google Gemini、Moonshot 等）与长文档分块/检索增强。
- 在网页中渲染 PDF/LaTeX 预览，帮助快速校对。
- 增加幻灯片手动编辑功能与版本管理。

## 许可证
- IF-Beamer 模板沿用原项目许可证（GPU-v3）。
- 其余代码默认 MIT，将在后续补充 `LICENSE` 文件。
