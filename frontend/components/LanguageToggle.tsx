"use client";

import type { Language } from "@/lib/useLanguage";

type Props = {
  lang: Language;
  onChange: (lang: Language) => void;
  label?: string;
};

export function LanguageToggle({ lang, onChange, label = "Language" }: Props) {
  const options: { value: Language; text: string }[] = [
    { value: "zh", text: "中文" },
    { value: "en", text: "English" },
  ];

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span className="text-gray-500">{label}</span>
      <div className="flex rounded-full border border-gray-200 overflow-hidden shadow-sm bg-white">
        {options.map((option) => {
          const active = option.value === lang;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`px-3 py-1 transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
