"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { UploadCloud, ArrowRight, CheckCircle } from "lucide-react";
import { useLanguage, type Language } from "@/lib/useLanguage";
import { LanguageToggle } from "@/components/LanguageToggle";

const TEXT: Record<
  Language,
  {
    languageLabel: string;
    title: string;
    subtitle: string;
    originalTitle: string;
    suspectTitle: string;
    pdfHint: string;
    chooseFile: string;
    uploaded: string;
    start: string;
    starting: string;
    uploadSuccess: (name: string) => string;
    uploadFail: string;
    startFail: string;
  }
> = {
  zh: {
    languageLabel: "语言",
    title: "AI 论文查重系统",
    subtitle: "基于向量数据库的语义级查重",
    originalTitle: "基准文档（Original）",
    suspectTitle: "待查文档（Suspect）",
    pdfHint: "支持 PDF 格式",
    chooseFile: "选择文件",
    uploaded: "文件已就绪",
    start: "开始语义分析",
    starting: "正在初始化...",
    uploadSuccess: (name) => `${name} 上传成功，后端正在解析...`,
    uploadFail: "上传失败",
    startFail: "启动分析失败",
  },
  en: {
    languageLabel: "Language",
    title: "AI Paper Comparator",
    subtitle: "Semantic plagiarism detection powered by a vector database",
    originalTitle: "Reference document (Original)",
    suspectTitle: "Document to check (Suspect)",
    pdfHint: "PDF only",
    chooseFile: "Choose file",
    uploaded: "File ready",
    start: "Start similarity analysis",
    starting: "Initializing...",
    uploadSuccess: (name) => `${name} uploaded. Backend is parsing...`,
    uploadFail: "Upload failed",
    startFail: "Failed to start analysis",
  },
};

export default function Home() {
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  const t = TEXT[lang];

  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    setType: (id: number) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await api.uploadFile(file);
      setType(res.id);
      alert(t.uploadSuccess(file.name));
    } catch (err) {
      console.error(err);
      alert(t.uploadFail);
    }
  };

  const handleAnalyze = async () => {
    if (!sourceId || !targetId) return;
    setLoading(true);
    try {
      const res = await api.startComparison(sourceId, targetId);
      router.push(`/report/${res.task_id}`);
    } catch (err) {
      alert(t.startFail);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="flex justify-end">
          <LanguageToggle lang={lang} onChange={setLang} label={t.languageLabel} />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          <UploadCard
            title={t.originalTitle}
            pdfHint={t.pdfHint}
            chooseFile={t.chooseFile}
            uploadedText={t.uploaded}
            isUploaded={!!sourceId}
            onChange={(e) => handleUpload(e, setSourceId)}
          />

          <UploadCard
            title={t.suspectTitle}
            pdfHint={t.pdfHint}
            chooseFile={t.chooseFile}
            uploadedText={t.uploaded}
            isUploaded={!!targetId}
            onChange={(e) => handleUpload(e, setTargetId)}
          />
        </div>

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
              t.starting
            ) : (
              <>
                {t.start} <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

function UploadCard({
  title,
  pdfHint,
  chooseFile,
  uploadedText,
  isUploaded,
  onChange,
}: {
  title: string;
  pdfHint: string;
  chooseFile: string;
  uploadedText: string;
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
      <h3 className="text-xl font-semibold text-gray-700 text-center">{title}</h3>
      <p className="text-sm text-gray-500 mt-2 mb-6">{pdfHint}</p>

      {!isUploaded && (
        <label className="cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm">
          {chooseFile}
          <input
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={onChange}
          />
        </label>
      )}
      {isUploaded && (
        <span className="text-green-600 font-medium">{uploadedText}</span>
      )}
    </div>
  );
}
