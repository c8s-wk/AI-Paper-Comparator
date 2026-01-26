"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

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

export default function ReportPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [status, setStatus] = useState<"loading" | "completed" | "failed">(
    "loading"
  );
  const [report, setReport] = useState<Report | null>(null);

  // 轮询获取任务状态与结果
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
        <h2 className="text-xl font-semibold">AI 正在深度比对文档...</h2>
        <p className="text-gray-500 mt-2">向量检索与语义分析进行中</p>
      </FullScreenCenter>
    );
  }

  if (status === "failed") {
    return (
      <FullScreenCenter textColor="text-red-600">
        <AlertTriangle className="mb-4" size={48} />
        <h2 className="text-xl font-semibold">任务失败</h2>
        <p className="text-gray-500 mt-2">请返回重新发起对比任务。</p>
      </FullScreenCenter>
    );
  }

  if (!report) return null;

  const score = report.summary.total_score;
  const scoreColor =
    score > 50 ? "text-red-600" : score > 20 ? "text-yellow-600" : "text-green-600";
  const verdict = report.summary.verdict || (score > 20 ? "High Risk" : "Low Risk");
  const suspicious = report.summary.suspicious_chunks ?? 0;
  const totalChunks = report.summary.total_chunks ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* 顶部概览栏 */}
      <div className="max-w-6xl mx-auto grid gap-4 md:grid-cols-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">总体相似度</p>
            <p className={`text-4xl font-extrabold ${scoreColor}`}>{score}%</p>
            <p className="text-xs text-gray-500 mt-1">Task ID: {taskId}</p>
          </div>
          <span className="mt-2 inline-block text-sm font-semibold text-gray-800">
            判定：{verdict}
          </span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">命中统计</p>
          <p className="text-3xl font-bold text-gray-900">{suspicious}</p>
          <p className="text-sm text-gray-500">
            可疑片段 / 总片段：{suspicious} / {totalChunks || "?"}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">掩码鲁棒性</p>
          {report.mask_check ? (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {report.mask_check.avg_masked_score}%
              </p>
              <p className="text-sm text-gray-500">
                稳健命中 {report.mask_check.robust_hits}/{report.mask_check.total_hits} ·
                ratio {Math.round(report.mask_check.ratio * 100)}% · runs {report.mask_check.runs}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">未启用掩码检测</p>
          )}
        </div>
      </div>

      {/* 宏观框架对比 + 最终判决 */}
      <div className="max-w-6xl mx-auto mb-6 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">宏观框架对比（摘要/引言）</h3>
          {report.macro_analysis ? (
            <>
              <p className="text-sm text-gray-600 mb-2">
                结论：<span className="font-semibold text-gray-800">{report.macro_analysis.verdict}</span>
              </p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {report.macro_analysis.details}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">暂无宏观分析结果。</p>
          )}
        </div>

        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-2">AI 最终判决</h3>
          <p className="text-sm text-slate-100 leading-relaxed">
            {report.final_opinion || "后台尚未生成判决，请稍后刷新。"}
          </p>
        </div>

        {report.mask_check && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">掩码鲁棒性检测</h3>
            <p className="text-sm text-gray-700">
              运行次数: {report.mask_check.runs}，掩码比例: {Math.round(report.mask_check.ratio * 100)}%
            </p>
            <p className="text-sm text-gray-700">
              平均掩码后相似度: {report.mask_check.avg_masked_score}% ，
              稳健命中: {report.mask_check.robust_hits}/{report.mask_check.total_hits}
            </p>
          </div>
        )}
      </div>

      {/* 微观命中列表 */}
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="text-yellow-500" /> 检测到的疑似片段 ({report.matches.length})
        </h2>

        {report.matches.map((match, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* 头部信息 */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
              <span
                className={`text-xs font-bold px-2 py-1 rounded uppercase 
                ${
                  match.score > 80
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {match.type} (相似度: {match.score}%)
              </span>
              <span className="text-xs text-gray-400">Match ID: #{index + 1}</span>
            </div>

            {/* 对比正文 */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {/* 左侧：待测文本 */}
              <div className="p-6">
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                  待测论文 (Page {match.target_page})
                </p>
                <div className="bg-red-50 text-gray-800 p-4 rounded-lg text-sm leading-relaxed border border-red-100">
                  {match.target_text}
                </div>
              </div>

              {/* 右侧：来源文本 */}
              <div className="p-6">
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                  疑似来源 (Page {match.source_page})
                </p>
                <div className="bg-blue-50 text-gray-800 p-4 rounded-lg text-sm leading-relaxed border border-blue-100">
                  {match.source_text}
                </div>
              </div>
            </div>

            {/* AI 分析评语 */}
            <div className="bg-gray-900 text-gray-200 px-6 py-4 text-sm flex gap-3">
              <div className="min-w-[24px]">🤖</div>
              <div>
                <span className="font-bold text-white">AI 分析: </span>
                {match.ai_analysis}
              </div>
            </div>
          </div>
        ))}

        {report.matches.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl text-gray-500">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
            <p>未发现明显的抄袭痕迹。</p>
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
