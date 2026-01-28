"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage, type Language } from "@/lib/useLanguage";

type MatchItem = {
  type: string;
  score: number;
  target_page: number;
  target_text: string;
  source_page: number;
  source_text: string;
  ai_analysis: string;
};

type Report = {
  summary: {
    total_score: number;
    verdict?: string;
    suspicious_chunks?: number;
    total_chunks?: number;
  };
  macro_analysis?: { verdict: string; details: string };
  mask_check?: {
    runs: number;
    ratio: number;
    avg_masked_score: number;
    robust_hits: number;
    total_hits: number;
  };
  final_opinion?: string;
  matches: MatchItem[];
};

const TEXT: Record<
  Language,
  {
    languageLabel: string;
    loadingTitle: string;
    loadingSubtitle: string;
    failedTitle: string;
    failedSubtitle: string;
    overallScore: string;
    verdictPrefix: string;
    autoVerdictHigh: string;
    autoVerdictLow: string;
    chunkStats: string;
    chunkStatsDetail: (s: number, t?: number) => string;
    maskTitle: string;
    maskSummary: (mask: NonNullable<Report["mask_check"]>) => string;
    maskMissing: string;
    macroTitle: string;
    macroVerdictPrefix: string;
    macroNone: string;
    finalTitle: string;
    finalPlaceholder: string;
    maskRunLine: (mask: NonNullable<Report["mask_check"]>) => string;
    maskAvgLine: (mask: NonNullable<Report["mask_check"]>) => string;
    matchesTitle: (count: number) => string;
    matchTypeLabel: (match: MatchItem) => string;
    suspectHeading: (page: number) => string;
    sourceHeading: (page: number) => string;
    aiAnalysisLabel: string;
    noMatchText: string;
  }
> = {
  zh: {
    languageLabel: "语言",
    loadingTitle: "AI 正在比对文档...",
    loadingSubtitle: "语义检索与分析进行中",
    failedTitle: "任务失败",
    failedSubtitle: "请返回重新发起对比。",
    overallScore: "整体相似度",
    verdictPrefix: "判定：",
    autoVerdictHigh: "高风险",
    autoVerdictLow: "低风险",
    chunkStats: "段落统计",
    chunkStatsDetail: (s, t) => `疑似片段 / 总段落：${s} / ${t ?? "?"}`,
    maskTitle: "掩码鲁棒性",
    maskSummary: (mask) =>
      `稳健命中 ${mask.robust_hits}/${mask.total_hits} · 比例 ${Math.round(
        mask.ratio * 100
      )}% · runs ${mask.runs}`,
    maskMissing: "未开启掩码测试",
    macroTitle: "人工宏观评审（可选）",
    macroVerdictPrefix: "结论：",
    macroNone: "暂无人工评审结果。",
    finalTitle: "AI 最终判定",
    finalPlaceholder: "后台尚未生成判决，请稍后刷新。",
    maskRunLine: (mask) =>
      `运行次数: ${mask.runs}，掩码比例: ${Math.round(mask.ratio * 100)}%`,
    maskAvgLine: (mask) =>
      `平均掩码后相似度: ${mask.avg_masked_score}% ，稳健命中: ${mask.robust_hits}/${mask.total_hits}`,
    matchesTitle: (count) => `检测到的疑似片段 (${count})`,
    matchTypeLabel: (match) => `${match.type} (相似度 ${match.score}%)`,
    suspectHeading: (page) => `待查文本 (Page ${page})`,
    sourceHeading: (page) => `参考来源 (Page ${page})`,
    aiAnalysisLabel: "AI 分析",
    noMatchText: "未发现明显的抄袭迹象。",
  },
  en: {
    languageLabel: "Language",
    loadingTitle: "AI is comparing the documents...",
    loadingSubtitle: "Running semantic retrieval and analysis",
    failedTitle: "Task failed",
    failedSubtitle: "Please go back and start a new comparison.",
    overallScore: "Overall similarity",
    verdictPrefix: "Verdict: ",
    autoVerdictHigh: "High risk",
    autoVerdictLow: "Low risk",
    chunkStats: "Chunk stats",
    chunkStatsDetail: (s, t) => `Suspicious / Total chunks: ${s} / ${t ?? "?"}`,
    maskTitle: "Mask robustness",
    maskSummary: (mask) =>
      `Robust hits ${mask.robust_hits}/${mask.total_hits} · ratio ${Math.round(
        mask.ratio * 100
      )}% · runs ${mask.runs}`,
    maskMissing: "Mask test not enabled",
    macroTitle: "Macro human review (optional)",
    macroVerdictPrefix: "Conclusion: ",
    macroNone: "No macro review yet.",
    finalTitle: "AI final decision",
    finalPlaceholder: "Verdict not ready yet. Please refresh later.",
    maskRunLine: (mask) =>
      `Runs: ${mask.runs}, mask ratio: ${Math.round(mask.ratio * 100)}%`,
    maskAvgLine: (mask) =>
      `Avg masked similarity: ${mask.avg_masked_score}% , robust hits: ${mask.robust_hits}/${mask.total_hits}`,
    matchesTitle: (count) => `Detected suspicious passages (${count})`,
    matchTypeLabel: (match) => `${match.type} (similarity ${match.score}%)`,
    suspectHeading: (page) => `Suspect document (Page ${page})`,
    sourceHeading: (page) => `Reference source (Page ${page})`,
    aiAnalysisLabel: "AI analysis",
    noMatchText: "No obvious plagiarism detected.",
  },
};

export default function ReportPage() {
  const params = useParams();
  const taskId = params.id as string;
  const { lang, setLang } = useLanguage();
  const t = TEXT[lang];

  const [status, setStatus] = useState<"loading" | "completed" | "failed">(
    "loading"
  );
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (status === "completed" || status === "failed") {
        clearInterval(interval);
        return;
      }
      try {
        const data = await api.getTaskResult(taskId);
        if (data.status === "completed") {
          setReport(data.result);
          setStatus("completed");
          clearInterval(interval);
        } else if (data.status === "failed") {
          setStatus("failed");
          clearInterval(interval);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [taskId, status]);

  if (status === "loading") {
    return (
      <FullScreenCenter>
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <h2 className="text-xl font-semibold">{t.loadingTitle}</h2>
        <p className="text-gray-500 mt-2">{t.loadingSubtitle}</p>
      </FullScreenCenter>
    );
  }

  if (status === "failed") {
    return (
      <FullScreenCenter textColor="text-red-600">
        <AlertTriangle className="mb-4" size={48} />
        <h2 className="text-xl font-semibold">{t.failedTitle}</h2>
        <p className="text-gray-500 mt-2">{t.failedSubtitle}</p>
      </FullScreenCenter>
    );
  }

  if (!report) return null;

  const score = report.summary.total_score;
  const scoreColor =
    score > 50 ? "text-red-600" : score > 20 ? "text-yellow-600" : "text-green-600";
  const verdict =
    report.summary.verdict ||
    (score > 20 ? t.autoVerdictHigh : t.autoVerdictLow);
  const suspicious = report.summary.suspicious_chunks ?? 0;
  const totalChunks = report.summary.total_chunks ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto flex justify-end mb-4">
        <LanguageToggle lang={lang} onChange={setLang} label={t.languageLabel} />
      </div>

      <div className="max-w-6xl mx-auto grid gap-4 md:grid-cols-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              {t.overallScore}
            </p>
            <p className={`text-4xl font-extrabold ${scoreColor}`}>{score}%</p>
            <p className="text-xs text-gray-500 mt-1">Task ID: {taskId}</p>
          </div>
          <span className="mt-2 inline-block text-sm font-semibold text-gray-800">
            {t.verdictPrefix}
            {verdict}
          </span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">{t.chunkStats}</p>
          <p className="text-3xl font-bold text-gray-900">{suspicious}</p>
          <p className="text-sm text-gray-500">
            {t.chunkStatsDetail(suspicious, totalChunks)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">{t.maskTitle}</p>
          {report.mask_check ? (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {report.mask_check.avg_masked_score}%
              </p>
              <p className="text-sm text-gray-500">
                {t.maskSummary(report.mask_check)}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">{t.maskMissing}</p>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto mb-6 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t.macroTitle}
          </h3>
          {report.macro_analysis ? (
            <>
              <p className="text-sm text-gray-600 mb-2">
                {t.macroVerdictPrefix}
                <span className="font-semibold text-gray-800">
                  {report.macro_analysis.verdict}
                </span>
              </p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {report.macro_analysis.details}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">{t.macroNone}</p>
          )}
        </div>

        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-2">{t.finalTitle}</h3>
          <p className="text-sm text-slate-100 leading-relaxed">
            {report.final_opinion || t.finalPlaceholder}
          </p>
        </div>

        {report.mask_check && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.maskTitle}</h3>
            <p className="text-sm text-gray-700">
              {t.maskRunLine(report.mask_check)}
            </p>
            <p className="text-sm text-gray-700">
              {t.maskAvgLine(report.mask_check)}
            </p>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="text-yellow-500" />{" "}
          {t.matchesTitle(report.matches.length)}
        </h2>

        {report.matches.map((match, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
              <span
                className={`text-xs font-bold px-2 py-1 rounded uppercase 
                ${
                  match.score > 80
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {t.matchTypeLabel(match)}
              </span>
              <span className="text-xs text-gray-400">Match ID: #{index + 1}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              <div className="p-6">
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                  {t.suspectHeading(match.target_page)}
                </p>
                <div className="bg-red-50 text-gray-800 p-4 rounded-lg text-sm leading-relaxed border border-red-100">
                  {match.target_text}
                </div>
              </div>

              <div className="p-6">
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                  {t.sourceHeading(match.source_page)}
                </p>
                <div className="bg-blue-50 text-gray-800 p-4 rounded-lg text-sm leading-relaxed border border-blue-100">
                  {match.source_text}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 text-gray-200 px-6 py-4 text-sm flex gap-3">
              <div className="min-w-[24px] font-bold">AI</div>
              <div>
                <span className="font-bold text-white">{t.aiAnalysisLabel}: </span>
                {match.ai_analysis}
              </div>
            </div>
          </div>
        ))}

        {report.matches.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl text-gray-500">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
            <p>{t.noMatchText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FullScreenCenter({
  children,
  textColor = "text-gray-900",
}: {
  children: ReactNode;
  textColor?: string;
}) {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${textColor}`}>
      {children}
    </div>
  );
}
