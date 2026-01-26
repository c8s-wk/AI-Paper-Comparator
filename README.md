# AI Paper Comparator

一站式论文语义查重原型，包含 FastAPI 后端 + Next.js 前端。特色能力：
- **Top‑Down 宏观比对**：摘要/引言层面对研究目标、方法、数据集做框架分析。
- **Bottom‑Up 微观比对**：分块向量检索 + LLM 逐段判定。
- **掩码鲁棒性检测**：随机 Mask 压力测试，识别“高级洗稿”。
- 前端展示总体相似度、宏观结论、掩码鲁棒性结果、逐条命中及最终判决。

## 目录结构
```
backend/    FastAPI 服务、向量库、LLM 比对
frontend/   Next.js 16 App Router 前端
app.db      默认 SQLite 文件
uploads/    上传文件目录（运行时生成）
chroma_db/  Chroma 持久化目录（运行时生成）
env.template  环境变量模板
```

## 快速开始
```bash
python -m venv venv
.\venv\Scripts\activate   # Windows PowerShell
```
### 1) 后端
```bash
cd backend
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
cp ../env.template .env   # 或手动创建 .env，至少包含 OPENAI_API_KEY
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
关键环境变量（可放 .env）：
- `OPENAI_API_KEY`（必填）
- `OPENAI_MODEL` 默认 `gpt-4o-mini`
- 阈值/切分/掩码：`SIM_THRESHOLD_EXACT`(0.1) `SIM_THRESHOLD_SUSPICIOUS`(0.4) `CHUNK_SIZE`(500) `CHUNK_OVERLAP`(100) `MASK_RUNS`(3) `MASK_RATIO`(0.5)

### 2) 前端
```bash
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```
前端会调用 `http://127.0.0.1:8000/api`，如果后端地址变更，请修改 `frontend/lib/api.ts` 中的 `API_BASE`。

## 使用流程
1. 打开 `http://localhost:3000`，上传基准论文与待测论文（PDF）。
2. 后端完成向量化后点击“开始深度分析”，跳转报告页 `/report/{task_id}`。
3. 报告页展示：总体相似度、宏观框架结论、掩码鲁棒性、AI 最终判决、逐条命中对照。

## 主要技术栈
- 后端：FastAPI, SQLAlchemy + SQLite, ChromaDB, OpenAI SDK, PyMuPDF
- 前端：Next.js 16 (App Router), React 19, Tailwind (通过 `globals.css`)

## 调参与扩展
- 想更严苛：降低阈值 `SIM_THRESHOLD_SUSPICIOUS` 或提高 `MASK_RUNS`。
- 想更快更省：提高阈值、减少掩码轮次或关闭掩码（`MASK_RUNS=0`）。
- 如需替换模型/代理：设置 `OPENAI_MODEL`、`OPENAI_BASE_URL`（OpenAI SDK 支持）。

## 常见问题
- 启动时报 `OPENAI_API_KEY is not set`：确认 `.env` 路径与变量已加载，或在 shell 中先 `set OPENAI_API_KEY=...`。
- 前端空白：确保后端 8000 端口可访问，前端 API 地址正确。
- 数据库缺表：后端启动时会自动 `create_all`；如损坏可删除 `app.db` 后重启（会丢历史数据）。

## 许可证
仅供内部实验与演示用途，未添加开源许可证，请勿用于生产。
