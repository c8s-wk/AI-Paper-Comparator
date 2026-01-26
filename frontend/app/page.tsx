"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { UploadCloud, ArrowRight, CheckCircle } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // 通用的上传处理函数
  const handleUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    setType: (id: number) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await api.uploadFile(file);
      setType(res.id);
      alert(`${file.name} 上传成功，后台正在解析...`);
    } catch (err) {
      console.error(err);
      alert("上传失败");
    }
  };

  // 开始分析
  const handleAnalyze = async () => {
    if (!sourceId || !targetId) return;
    setLoading(true);
    try {
      const res = await api.startComparison(sourceId, targetId);
      // 跳转到报告页面 (带上 task_id)
      router.push(`/report/${res.task_id}`);
    } catch (err) {
      alert("启动分析失败");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">AI 论文查重系统</h1>
          <p className="mt-2 text-gray-600">
            Semantic Plagiarism Detection powered by Vector Database
          </p>
        </div>

        {/* 双栏上传区 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          {/* 左边：基准论文 */}
          <UploadCard
            title="基准论文 (Original)"
            isUploaded={!!sourceId}
            onChange={(e) => handleUpload(e, setSourceId)}
          />

          {/* 右边：待测论文 */}
          <UploadCard
            title="待测论文 (Suspect)"
            isUploaded={!!targetId}
            onChange={(e) => handleUpload(e, setTargetId)}
          />
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-center mt-8">
          <button
            onClick={handleAnalyze}
            disabled={!sourceId || !targetId || loading}
            className={`flex items-center gap-2 px-8 py-4 rounded-full text-lg font-semibold text-white transition-all
              ${
                !sourceId || !targetId
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 shadow-lg"
              }
            `}
          >
            {loading ? (
              "正在初始化..."
            ) : (
              <>
                开始深度分析 <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

// 简单的上传卡片组件
function UploadCard({
  title,
  isUploaded,
  onChange,
}: {
  title: string;
  isUploaded: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors
      ${
        isUploaded
          ? "border-green-500 bg-green-50"
          : "border-gray-300 hover:border-blue-400 bg-white"
      }
    `}
    >
      {isUploaded ? (
        <CheckCircle size={48} className="text-green-500 mb-4" />
      ) : (
        <UploadCloud size={48} className="text-gray-400 mb-4" />
      )}
      <h3 className="text-xl font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-500 mt-2 mb-6">支持 PDF 格式</p>

      {!isUploaded && (
        <label className="cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm">
          选择文件
          <input
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={onChange}
          />
        </label>
      )}
      {isUploaded && (
        <span className="text-green-600 font-medium">文件已就绪</span>
      )}
    </div>
  );
}
