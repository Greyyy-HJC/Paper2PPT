# Paper2PPT

Paper2PPT 可以把学术论文 PDF 快速转化为适配 IF-Beamer 模版的学术汇报幻灯片。你可以只用浏览器完成静态解析，也可以接入自己的大模型 API，以获得更高质量的摘要与讲稿结构。

> **项目状态**：Paper2PPT 仍在持续优化中，功能与界面可能会随着后续迭代调整。

## 功能亮点
- **双模式生成**：
  - 静态模式只在浏览器中解析 PDF，启发式切分章节并导出约 10-15 页幻灯片。
  - LLM 模式会先在本地解析 PDF，再将结构化上下文发送给 OpenAI 兼容接口（含 Azure、Anthropic、DeepSeek 等）生成讲稿。
- **即用模板**：内置 IF-Beamer 主题，自动生成标题页、目录、章节页与总结页。
- **一键打包**：生成的 `main.tex` 会和 `if-beamer.cls`、`figuras/` 资源同时压缩为 ZIP，可直接上传到 Overleaf。
- **预览与校对**：生成完成后在页面中查看大纲与要点，方便快速校对。

## 快速上手
```bash
npm install
npm run dev
# 打开 http://localhost:3000
```
1. 上传论文 PDF。
2. 若使用 LLM 模式，选择模型提供商并填写 API Key、模型名与 Base URL（默认指向 `https://api.openai.com/v1`）。
3. 点击“生成静态幻灯片”或“调用 LLM 生成”，下载 ZIP 并导入 Overleaf。

## GitHub Pages 构建
仅需静态版本时运行：
```bash
npm run build:static
```
编译后的静态站点会放在 `out/` 目录。若部署到 GitHub Pages，可执行：
```bash
npm run build:pages
```
该命令会自动将静态资源复制到 `docs/` 目录，并禁用页面上的 LLM 模式入口。

## 目录结构
```
.
├── app/
│   ├── components/GeneratorPanel.tsx   # 上传、配置、生成 UI
│   └── api/generate/route.ts           # LLM 模式服务端接口
├── lib/
│   ├── core/analyzer.ts               # PDF 启发式分析 + slide 结构
│   ├── pdf/extract.ts                 # 基于 pdfjs-dist 的文本抽取
│   ├── server/llm.ts                  # 多家模型接口适配（含可定制提示词）
│   ├── static/staticGenerator.ts      # 静态模式生成与打包
│   └── templates/ifBeamer.ts          # LaTeX 渲染
├── public/templates/if-beamer/        # IF-Beamer 主题资源
├── LICENSE
├── README.md
└── agent.md
```

## 预设模型（更新 2025-02）
| 提供商 | Base URL 示例 | 预设模型 |
| --- | --- | --- |
| OpenAI / 兼容接口 | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `o1`, `o1-mini` |
| Azure OpenAI | `https://{resource}.openai.azure.com/openai` + `?api-version=` | `gpt-4o`, `gpt-4o-mini`, `gpt-35-turbo`（需填写部署名） |
| Anthropic Claude | `https://api.anthropic.com/v1` | `claude-3.5-sonnet-20240620`, `claude-3.5-haiku-20240620`, `claude-3-opus-20240229`, `claude-3-sonnet-20240229` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-reasoner` |
| 自定义兼容接口 | 自填 | 任意遵循 OpenAI Chat Completions 的模型标识 |

前端会根据选择自动切换模型列表，并在必要时添加额外请求头（如 `x-api-key`, `anthropic-version`, `api-key` 等）。还提供“提示词”文本框，可在默认模板基础上自定义生成策略。

## 常见问题
- **LLM 模式耗时？** 解析和调用均在本地触发，若网络较慢建议先使用静态模式生成初稿。
- **PDF 解析失败？** 复杂图表或扫描件可能解析不完整，可主动在 ZIP 中补充图片或手动调整 LaTeX。
- **如何替换模板颜色？** 修改 `public/templates/if-beamer/if-beamer.cls` 中的 `mainColor1`/`mainColor2` 即可。

## 许可证
- 代码与文档基于 MIT License 发布，详见 `LICENSE`。
- IF-Beamer 模板遵循原作者许可（GPU-v3）。

欢迎通过 Issue/PR 分享使用反馈或贡献新的模板与解析策略。
