# backend/services/comparator.py
import os
import random
from typing import List, Dict, Any

import fitz  # PyMuPDF
from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy.orm import Session

from database.models import ComparisonTask, ProcessStatus, Document
from database.vector_store import vector_db_client

# ---- configurable thresholds ----
THRESHOLD_EXACT = float(os.getenv("SIM_THRESHOLD_EXACT", 0.1))        # cosine distance < 0.1 → verbatim
THRESHOLD_SUSPICIOUS = float(os.getenv("SIM_THRESHOLD_SUSPICIOUS", 0.4))  # distance < 0.4 → paraphrasing

# chunking
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 500))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 100))

# masking robustness
MASK_RUNS = int(os.getenv("MASK_RUNS", 3))        # how many masked trials
MASK_RATIO = float(os.getenv("MASK_RATIO", 0.5))  # % tokens/chars masked

# LLM config
load_dotenv()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT = float(os.getenv("OPENAI_TIMEOUT", 30))


class Comparator:
    def __init__(self, db: Session):
        self.db = db
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set. Please create a .env file.")
        self.llm = OpenAI(api_key=api_key)

    def compare(self, task_id: int):
        """Top-Down + Bottom-Up + Masked robustness."""
        task = self.db.query(ComparisonTask).filter(ComparisonTask.id == task_id).first()
        if not task:
            return

        try:
            print(f"🚀 [Comparator] Starting analysis for Task {task_id}...")
            task.status = ProcessStatus.PROCESSING
            self.db.commit()

            # 0) fetch docs
            source_doc: Document = self.db.query(Document).filter(Document.id == task.source_doc_id).first()
            target_doc: Document = self.db.query(Document).filter(Document.id == task.target_doc_id).first()
            if not source_doc or not target_doc:
                raise Exception("Documents not found")

            # 1) Top-Down macro compare (abstract/introduction)
            source_intro = self._extract_intro(source_doc.file_path)
            target_intro = self._extract_intro(target_doc.file_path)
            macro_analysis = self._analyze_framework(target_intro, source_intro)

            # 2) Bottom-Up micro compare (vector search + LLM)
            target_data = vector_db_client.get_document_chunks(target_doc.id)
            target_texts = target_data["documents"]
            target_metas = target_data["metadatas"]
            if not target_texts:
                raise Exception("Target document has no chunks found.")

            matches: List[Dict[str, Any]] = []
            total_chunks = 0
            suspicious_count = 0
            mask_scores: List[float] = []

            for page_idx, t_text in enumerate(target_texts):
                sub_chunks = self._chunk_text(t_text)
                for sub_text in sub_chunks:
                    total_chunks += 1
                    result = vector_db_client.query_context(sub_text, source_doc.id, top_k=1)
                    if not result["distances"][0]:
                        continue

                    distance = result["distances"][0][0]
                    s_text = result["documents"][0][0]
                    s_meta = result["metadatas"][0][0]

                    if distance < THRESHOLD_SUSPICIOUS:
                        match_type = "paraphrasing" if distance >= THRESHOLD_EXACT else "verbatim"
                        ai_verdict = self._analyze_with_llm(sub_text, s_text)

                        masked_avg = self._mask_robust_score(sub_text, source_doc.id)
                        if masked_avg is not None:
                            mask_scores.append(masked_avg)

                        matches.append(
                            {
                                "id": len(matches),
                                "type": match_type,
                                "score": round((1 - distance) * 100, 2),
                                "target_text": sub_text,
                                "target_page": target_metas[page_idx].get("page", 0),
                                "source_text": s_text,
                                "source_page": s_meta.get("page", 0),
                                "ai_analysis": ai_verdict,
                                "masked_avg_score": masked_avg,
                                "mask_runs": MASK_RUNS,
                                "mask_ratio": MASK_RATIO,
                            }
                        )
                        suspicious_count += 1

                if page_idx % 3 == 0:
                    print(f"   Processed page {page_idx+1}/{len(target_texts)}...")

            final_score = round((suspicious_count / total_chunks) * 100, 2) if total_chunks else 0.0

            report: Dict[str, Any] = {
                "summary": {
                    "total_score": final_score,
                    "verdict": "High Risk" if final_score > 20 else "Low Risk",
                    "total_chunks": total_chunks,
                    "suspicious_chunks": suspicious_count,
                },
                "macro_analysis": macro_analysis,
                "matches": matches,
            }

            if mask_scores:
                robust_hits = sum(
                    1
                    for m in matches
                    if m.get("masked_avg_score") is not None and m["masked_avg_score"] >= m["score"] * 0.8
                )
                report["mask_check"] = {
                    "runs": MASK_RUNS,
                    "ratio": MASK_RATIO,
                    "avg_masked_score": round(sum(mask_scores) / len(mask_scores), 2),
                    "robust_hits": robust_hits,
                    "total_hits": len(mask_scores),
                }

            # 3) Final verdict
            report["final_opinion"] = self._summarize_final(macro_analysis, report)

            task.result_json = report
            task.status = ProcessStatus.COMPLETED
            self.db.commit()
            print(f"✅ [Comparator] Task {task_id} Finished! Score: {final_score}%")

        except Exception as e:
            print(f"❌ [Comparator] Error: {e}")
            task.status = ProcessStatus.FAILED
            task.result_json = {"error": str(e)}
            self.db.commit()

    # ---------- helpers ----------
    def _extract_intro(self, pdf_path: str, pages: int = 2, max_chars: int = 4000) -> str:
        """Extract first pages as intro for macro compare."""
        try:
            doc = fitz.open(pdf_path)
            texts = []
            for i, page in enumerate(doc):
                if i >= pages:
                    break
                txt = page.get_text().strip()
                if txt:
                    texts.append(txt)
            return "\n".join(texts)[:max_chars]
        except Exception as e:
            print(f"⚠️  extract_intro failed: {e}")
            return ""

    def _chunk_text(self, text: str) -> List[str]:
        """Character-level sliding window with overlap."""
        if len(text) <= CHUNK_SIZE:
            return [text]
        chunks = []
        start = 0
        while start < len(text):
            end = start + CHUNK_SIZE
            chunks.append(text[start:end])
            start = end - CHUNK_OVERLAP
        return chunks

    def _analyze_framework(self, target_intro: str, source_intro: str) -> Dict[str, str]:
        """Macro: compare objectives/methods/datasets of two papers."""
        if not target_intro or not source_intro:
            return {"verdict": "信息不足", "details": "缺少摘要/引言文本"}

        system_prompt = (
            "你是学术论文比对专家，请从宏观框架上比较两篇论文：研究目标、方法论、数据集/实验对象。"
            "用简短中文回答，给出结论（撞车/部分相似/不同）并说明理由。"
        )
        user_prompt = (
            f"待测论文摘要/引言:\n{target_intro}\n\n"
            f"基准论文摘要/引言:\n{source_intro}\n\n"
            "请输出结论和理由。"
        )
        resp = self.llm.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=220,
            temperature=0.2,
            timeout=OPENAI_TIMEOUT,
        )
        return {"verdict": "分析完成", "details": resp.choices[0].message.content.strip()}

    def _analyze_with_llm(self, text_a: str, text_b: str) -> str:
        """Micro: semantic verdict for a matched pair."""
        system_prompt = (
            "You are a concise academic plagiarism analyst. "
            "Compare two passages and return a brief Chinese verdict (<=40 words) "
            "covering whether plagiarism is likely and why."
        )
        user_prompt = (
            f"待测文本:\n{text_a}\n\n"
            f"疑似来源:\n{text_b}\n\n"
            "请判断相似程度与可能的抄袭方式，保持简洁。"
        )
        resp = self.llm.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=120,
            temperature=0.2,
            timeout=OPENAI_TIMEOUT,
        )
        return resp.choices[0].message.content.strip()

    def _mask_robust_score(self, text: str, source_id: int) -> float | None:
        """Random masking robustness check; returns avg similarity."""
        if MASK_RUNS <= 0 or MASK_RATIO <= 0:
            return None

        scores = []
        for _ in range(MASK_RUNS):
            masked = self._mask_text(text, MASK_RATIO)
            result = vector_db_client.query_context(masked, source_id, top_k=1)
            if not result["distances"][0]:
                continue
            dist = result["distances"][0][0]
            scores.append(round((1 - dist) * 100, 2))
        if not scores:
            return None
        return round(sum(scores) / len(scores), 2)

    def _mask_text(self, text: str, ratio: float) -> str:
        """Mask tokens or characters at given ratio."""
        if ratio <= 0:
            return text
        if " " in text:
            tokens = text.split()
            masked = ["[MASK]" if random.random() < ratio else tok for tok in tokens]
            return " ".join(masked)
        chars = list(text)
        masked_chars = ["□" if random.random() < ratio else ch for ch in chars]
        return "".join(masked_chars)

    def _summarize_final(self, macro: Dict[str, str], report: Dict[str, Any]) -> str:
        """Combine macro + micro findings into a final verdict."""
        summary = report.get("summary", {})
        matches = report.get("matches", [])
        mask_check = report.get("mask_check")
        mask_line = ""
        if mask_check:
            mask_line = (
                f"掩码鲁棒性：avg {mask_check['avg_masked_score']}%, "
                f"robust_hits {mask_check['robust_hits']}/{mask_check['total_hits']}. "
            )

        user_prompt = (
            f"宏观分析:\n{macro}\n\n"
            f"微观命中条数: {len(matches)}, 总体得分: {summary.get('total_score', 0)}%\n"
            f"{mask_line}"
            "请输出简短中文判决（<=60字），指出是否存在抄袭风险，并概述主要依据。"
        )
        resp = self.llm.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "你是审稿专家，请给出简洁的最终判决。"},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=80,
            temperature=0.2,
            timeout=OPENAI_TIMEOUT,
        )
        return resp.choices[0].message.content.strip()


# FastAPI background entry
def run_compare_task(task_id: int):
    from database.core import SessionLocal

    db = SessionLocal()
    try:
        service = Comparator(db)
        service.compare(task_id)
    finally:
        db.close()
