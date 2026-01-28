# AI Paper Comparator / AI 论文查重系统

选择语言 / Choose language:
- [中文说明](#中文说明)
- [English](#english)

本项目包含 FastAPI 后端与 Next.js 前端，用于语义级论文/文档查重。前端已内置中英文切换（主页与报告页右上角）。

## 中文说明

### 功能亮点
- **Top-Down 对比**：按研究目标、方法、数据集等维度的宏观语义对比。
- **Bottom-Up 逐段匹配**：段落向量检索 + LLM 片段判定，输出疑似抄袭片段。
- **掩码鲁棒性测试**：随机 Mask 文本后复检，评估命中稳健性。
- **可视化报告**：整体相似度、段落统计、掩码测试、AI 最终判定与详细匹配列表。

### 目录结构
```
backend/      FastAPI 服务、向量库、LLM 对比
frontend/     Next.js 16 (App Router) 前端
app.db        默认 SQLite 文件
chroma_db/    Chroma 持久化目录（运行时生成）
uploads/      上传文件目录（运行时生成）
.env.template 环境变量模板
```

### 快速开始
```bash
python -m venv venv
.\venv\Scripts\activate   # Windows PowerShell
```

#### 1) 后端
```bash
cd backend
pip install -r requirements.txt
cp ../env.template .env   # 或手动创建 .env，至少包含 OPENAI_API_KEY
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
关键环境变量（可写入 `.env`）：
- `OPENAI_API_KEY`（必填）
- `OPENAI_MODEL` 默认 `gpt-4o-mini`
- 查重/掩码参数：`SIM_THRESHOLD_EXACT`(0.1) `SIM_THRESHOLD_SUSPICIOUS`(0.4) `CHUNK_SIZE`(500) `CHUNK_OVERLAP`(100) `MASK_RUNS`(3) `MASK_RATIO`(0.5)

#### 2) 前端
```bash
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```
前端默认调用 `http://127.0.0.1:8000/api`，若后端地址变更，请修改 `frontend/lib/api.ts` 中的 `API_BASE`。

### 使用流程
1. 打开 `http://localhost:3000`，选择界面语言（中文/English）。
2. 上传基准文档与待查文档（PDF）。
3. 等待后端解析后点击“开始语义分析”，跳转报告页 `/report/{task_id}`。
4. 报告页可查看整体相似度、掩码鲁棒性、AI 判定以及疑似片段对照。

### 调参与扩展
- 想降低误报：提高 `SIM_THRESHOLD_SUSPICIOUS` 或减少 `MASK_RUNS`。
- 想加快速度：降低掩码次数或关闭掩码（`MASK_RUNS=0`）。
- 更换模型/代理：设置 `OPENAI_MODEL` 或 `OPENAI_BASE_URL`（OpenAI SDK 兼容）。

### 常见问题
- 启动报错 `OPENAI_API_KEY is not set`：确认 `.env` 路径正确，或在 shell 中先 `set OPENAI_API_KEY=...`。
- 前端空白：确认后端 8000 端口可访问，或更新 `API_BASE`。
- 数据库损坏：删除 `app.db` 后重启（将清空历史数据）。

### 免责声明
仅供内部实验与演示，未附开源许可，请勿用于生产环境。

## English

### Highlights
- **Top-down comparison** across goals, methods, datasets, and findings.
- **Bottom-up retrieval**: chunk-level vector search + LLM judgment for suspicious passages.
- **Mask robustness test** to gauge stability of similarities.
- **Rich report UI**: overall similarity, chunk stats, mask results, AI verdict, and detailed matches.

### Project Layout
```
backend/      FastAPI service, vector DB, LLM comparison
frontend/     Next.js 16 (App Router) UI
app.db        Default SQLite file
chroma_db/    Chroma persistence (generated at runtime)
uploads/      Uploaded files (generated at runtime)
.env.template Env template
```

### Quick Start
```bash
python -m venv venv
.\venv\Scripts\activate   # Windows PowerShell
```

#### 1) Backend
```bash
cd backend
pip install -r requirements.txt
cp ../env.template .env   # or create .env with at least OPENAI_API_KEY
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Key env vars (put in `.env` if needed):
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` default `gpt-4o-mini`
- Thresholds & masking: `SIM_THRESHOLD_EXACT`(0.1) `SIM_THRESHOLD_SUSPICIOUS`(0.4) `CHUNK_SIZE`(500) `CHUNK_OVERLAP`(100) `MASK_RUNS`(3) `MASK_RATIO`(0.5)

#### 2) Frontend
```bash
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```
The UI calls `http://127.0.0.1:8000/api` by default; update `frontend/lib/api.ts` if your backend host/port changes.

### Usage
1. Visit `http://localhost:3000` and pick the UI language (中文/English).
2. Upload the reference (Original) PDF and the suspect PDF.
3. After parsing, click “Start similarity analysis” to jump to `/report/{task_id}`.
4. Review overall score, mask robustness, AI verdict, and suspicious passages.

### Tuning
- Reduce false positives: raise `SIM_THRESHOLD_SUSPICIOUS` or lower `MASK_RUNS`.
- Speed up: decrease mask runs or disable masking with `MASK_RUNS=0`.
- Swap model/proxy: set `OPENAI_MODEL` or `OPENAI_BASE_URL` (OpenAI SDK compatible).

### FAQ
- `OPENAI_API_KEY is not set`: ensure `.env` is loaded or export the variable in your shell.
- Blank frontend: confirm backend 8000 is reachable or update `API_BASE`.
- Corrupted DB: delete `app.db` and restart (history will be cleared).

### Note
The UI includes a language toggle (top right on both home and report pages) so users can switch between Chinese and English at any time.
