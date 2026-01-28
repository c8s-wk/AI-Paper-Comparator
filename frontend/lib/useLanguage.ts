"use client";

import { useEffect, useState } from "react";

export type Language = "zh" | "en";

export function useLanguage(initial: Language = "zh") {
  const [lang, setLang] = useState<Language>(initial);

  // Load preference on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("lang");
    if (saved === "zh" || saved === "en") {
      setLang(saved);
    }
  }, []);

  // Persist preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("lang", lang);
  }, [lang]);

  return { lang, setLang };
}
