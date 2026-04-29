"use client";

import { Bebas_Neue, Inter, Playfair_Display, Syne, Unbounded } from "next/font/google";
import { useEffect, useMemo, useState } from "react";

type CarouselSlide = { h: string; p: string; tag: string };
type GeneratedPayload = {
  carousel: CarouselSlide[];
  reels: string;
  telegram: string;
  threads: string;
};
type TabKey = "carousel" | "reels" | "telegram" | "threads";
type CardStyle = "editorial" | "poster" | "photo" | "split" | "numbers" | "minimal";

const inter = Inter({ subsets: ["latin", "cyrillic"] });
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"] });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });
const syne = Syne({ subsets: ["latin", "cyrillic"] });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400" });

const fonts = [
  { id: "inter", label: "Inter", className: inter.className },
  { id: "playfair", label: "Playfair Display", className: playfair.className },
  { id: "unbounded", label: "Unbounded", className: unbounded.className },
  { id: "syne", label: "Syne", className: syne.className },
  { id: "bebas", label: "Bebas Neue", className: bebas.className },
] as const;

const palettes = [
  { id: "white", label: "Белый", color: "#ffffff" },
  { id: "black", label: "Чёрный", color: "#1A1A1A" },
  { id: "orange", label: "Оранжевый", color: "#FF5C00" },
  { id: "cream", label: "Крем", color: "#F5ECD7" },
  { id: "teal", label: "Тил", color: "#0D4E4A" },
  { id: "stone", label: "Стоун", color: "#292524" },
  { id: "merlot", label: "Мерло", color: "#4A0E1F" },
  { id: "sand", label: "Песок", color: "#EDE3D0" },
  { id: "night", label: "Ночь", color: "#0F172A" },
  { id: "blush", label: "Блаш", color: "#FFF1F3" },
];

const cardStyles: Array<{ id: CardStyle; label: string }> = [
  { id: "editorial", label: "Editorial" },
  { id: "poster", label: "Плакат" },
  { id: "photo", label: "Фото" },
  { id: "split", label: "Сплит" },
  { id: "numbers", label: "Цифры" },
  { id: "minimal", label: "Минимал" },
];

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "carousel", label: "Карусель" },
  { key: "reels", label: "Reels" },
  { key: "telegram", label: "Telegram" },
  { key: "threads", label: "Threads" },
];

function detectTelegramId() {
  if (typeof window === "undefined") {
    return "guest";
  }

  const tg = (
    window as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } };
    }
  ).Telegram;
  const id = tg?.WebApp?.initDataUnsafe?.user?.id;
  return id ? String(id) : "guest";
}

function getTextColor(hex: string) {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#121212" : "#FFFFFF";
}

function formatAccentNumber(index: number) {
  const mock = ["82%", "40K", "19x", "120%", "7д", "3.6M"];
  return mock[index % mock.length];
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("carousel");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [telegramId, setTelegramId] = useState("guest");
  const [result, setResult] = useState<GeneratedPayload | null>(null);
  const [paletteId, setPaletteId] = useState("white");
  const [styleId, setStyleId] = useState<CardStyle>("editorial");
  const [fontId, setFontId] = useState("inter");
  const [progress, setProgress] = useState<Record<TabKey, number>>({
    carousel: 0,
    reels: 0,
    telegram: 0,
    threads: 0,
  });

  useEffect(() => {
    setTelegramId(detectTelegramId());
  }, []);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = setInterval(() => {
      setProgress((prev) => ({
        carousel: Math.min(prev.carousel + 14, 93),
        reels: Math.min(prev.reels + 11, 90),
        telegram: Math.min(prev.telegram + 10, 89),
        threads: Math.min(prev.threads + 9, 87),
      }));
    }, 260);

    return () => clearInterval(timer);
  }, [loading]);

  const currentPalette = useMemo(
    () => palettes.find((p) => p.id === paletteId) ?? palettes[0],
    [paletteId]
  );
  const fontClass = useMemo(
    () => fonts.find((f) => f.id === fontId)?.className ?? inter.className,
    [fontId]
  );
  const textColor = useMemo(() => getTextColor(currentPalette.color), [currentPalette.color]);

  async function handleGenerate() {
    if (!topic.trim() || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setProgress({ carousel: 4, reels: 3, telegram: 3, threads: 2 });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), telegramId: telegramId || "guest" }),
      });

      const data = (await response.json()) as GeneratedPayload & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Ошибка генерации");
      }

      setResult(data);
      setActiveTab("carousel");
      setProgress({ carousel: 100, reels: 100, telegram: 100, threads: 100 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации");
    } finally {
      setLoading(false);
    }
  }

  function updateSlide(index: number, field: keyof CarouselSlide, value: string) {
    setResult((prev) => {
      if (!prev) {
        return prev;
      }
      const slides = [...prev.carousel];
      slides[index] = { ...slides[index], [field]: value };
      return { ...prev, carousel: slides };
    });
  }

  function renderCard(slide: CarouselSlide, index: number) {
    const baseCard =
      "relative h-[375px] w-[300px] flex-shrink-0 overflow-hidden rounded-[18px] bg-white shadow-[0_12px_30px_rgba(20,20,20,0.08)]";
    const serif = playfair.className;

    if (styleId === "poster") {
      return (
        <article key={`${slide.h}-${index}`} className={baseCard} style={{ background: currentPalette.color, color: textColor }}>
          <div className={`h-full p-5 ${fontClass}`}>
            <p className="mb-4 text-[11px] uppercase tracking-[0.2em] opacity-80">{slide.tag}</p>
            <h3
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "h", e.currentTarget.textContent ?? "")}
              className="text-[44px] font-black leading-[0.92] outline-none"
            >
              {slide.h}
            </h3>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "p", e.currentTarget.textContent ?? "")}
              className="absolute bottom-5 left-5 right-5 text-sm leading-5 opacity-90 outline-none"
            >
              {slide.p}
            </p>
          </div>
        </article>
      );
    }

    if (styleId === "photo") {
      return (
        <article key={`${slide.h}-${index}`} className={baseCard}>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #5b3a29 0%, #2f3f59 45%, #14253a 100%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/10" />
          <div className={`absolute inset-x-0 bottom-0 p-5 text-white ${fontClass}`}>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "tag", e.currentTarget.textContent ?? "")}
              className="mb-2 text-xs uppercase tracking-[0.2em] outline-none"
            >
              {slide.tag}
            </p>
            <h3
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "h", e.currentTarget.textContent ?? "")}
              className="mb-2 text-2xl font-bold leading-tight outline-none"
            >
              {slide.h}
            </h3>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "p", e.currentTarget.textContent ?? "")}
              className="text-sm leading-5 text-white/90 outline-none"
            >
              {slide.p}
            </p>
          </div>
        </article>
      );
    }

    if (styleId === "split") {
      return (
        <article key={`${slide.h}-${index}`} className={baseCard}>
          <div className={`h-[44%] p-5 ${fontClass}`} style={{ background: currentPalette.color, color: textColor }}>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "tag", e.currentTarget.textContent ?? "")}
              className="text-xs uppercase tracking-[0.17em] outline-none"
            >
              {slide.tag}
            </p>
          </div>
          <div className={`h-[56%] p-5 ${fontClass}`}>
            <h3
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "h", e.currentTarget.textContent ?? "")}
              className="mb-3 text-2xl font-bold leading-tight outline-none"
            >
              {slide.h}
            </h3>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "p", e.currentTarget.textContent ?? "")}
              className="text-sm leading-6 text-zinc-600 outline-none"
            >
              {slide.p}
            </p>
          </div>
        </article>
      );
    }

    if (styleId === "numbers") {
      return (
        <article key={`${slide.h}-${index}`} className={baseCard} style={{ border: `1px solid ${currentPalette.color}` }}>
          <div className={`h-full p-5 ${fontClass}`}>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{slide.tag}</p>
            <p className="mt-4 text-7xl font-black leading-none" style={{ color: "#FF5C00" }}>
              {formatAccentNumber(index)}
            </p>
            <h3
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "h", e.currentTarget.textContent ?? "")}
              className="mt-5 text-2xl font-bold leading-tight outline-none"
            >
              {slide.h}
            </h3>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "p", e.currentTarget.textContent ?? "")}
              className="mt-4 text-sm leading-6 text-zinc-600 outline-none"
            >
              {slide.p}
            </p>
          </div>
        </article>
      );
    }

    if (styleId === "minimal") {
      return (
        <article key={`${slide.h}-${index}`} className={`${baseCard} ${serif}`}>
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "tag", e.currentTarget.textContent ?? "")}
              className="mb-8 text-xs uppercase tracking-[0.2em] text-zinc-400 outline-none"
            >
              {slide.tag}
            </p>
            <h3
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "h", e.currentTarget.textContent ?? "")}
              className="mb-5 text-4xl leading-tight outline-none"
            >
              {slide.h}
            </h3>
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateSlide(index, "p", e.currentTarget.textContent ?? "")}
              className="text-sm leading-7 text-zinc-500 outline-none"
            >
              {slide.p}
            </p>
          </div>
        </article>
      );
    }

    return (
      <article key={`${slide.h}-${index}`} className={baseCard} style={{ border: `1px solid ${currentPalette.color}` }}>
        <div className={`h-full p-5 ${fontClass}`}>
          <p
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateSlide(index, "tag", e.currentTarget.textContent ?? "")}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 outline-none"
          >
            {slide.tag}
          </p>
          <div className="my-4 h-1.5 w-14 rounded-full" style={{ backgroundColor: "#FF5C00" }} />
          <h3
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateSlide(index, "h", e.currentTarget.textContent ?? "")}
            className={`${playfair.className} mb-3 text-4xl leading-[1.05] outline-none`}
          >
            {slide.h}
          </h3>
          <p
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateSlide(index, "p", e.currentTarget.textContent ?? "")}
            className="text-sm leading-7 text-zinc-600 outline-none"
          >
            {slide.p}
          </p>
        </div>
      </article>
    );
  }

  return (
    <div className={`${inter.className} min-h-screen bg-[#F7F4F1] text-[#1A1A1A]`}>
      <header className="h-[54px] border-b border-black/5 bg-white">
        <div className="mx-auto flex h-full w-full max-w-[1320px] items-center px-4 sm:px-6">
          <p className="text-2xl font-extrabold lowercase tracking-tight text-[#FF5C00]">slato</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1320px] flex-col lg:flex-row">
        <section className="flex-1 px-4 py-5 sm:px-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Тема карусели..."
              className="h-12 w-full rounded-[10px] border border-transparent bg-[rgba(0,0,0,0.06)] px-4 text-sm outline-none focus:border-[#FF5C00]/40"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!topic.trim() || loading}
              className="h-12 rounded-[14px] px-7 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto w-full"
              style={{ backgroundColor: "#FF5C00" }}
            >
              {loading ? "Создаём..." : "Создать"}
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-zinc-600">
              Палитра
              <select
                value={paletteId}
                onChange={(e) => setPaletteId(e.target.value)}
                className="mt-1 h-10 w-full rounded-[10px] border border-black/10 bg-white px-2 text-sm text-zinc-800"
              >
                {palettes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-600">
              Стиль карточек
              <select
                value={styleId}
                onChange={(e) => setStyleId(e.target.value as CardStyle)}
                className="mt-1 h-10 w-full rounded-[10px] border border-black/10 bg-white px-2 text-sm text-zinc-800"
              >
                {cardStyles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-600">
              Шрифт
              <select
                value={fontId}
                onChange={(e) => setFontId(e.target.value)}
                className="mt-1 h-10 w-full rounded-[10px] border border-black/10 bg-white px-2 text-sm text-zinc-800"
              >
                {fonts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading && (
            <div className="mb-4 rounded-[14px] bg-white p-4 shadow-[0_10px_20px_rgba(0,0,0,0.04)]">
              <p className="mb-2 text-sm font-medium text-zinc-700">Генерируем контент...</p>
              <div className="space-y-2.5">
                {tabs.map((item) => (
                  <div key={item.key}>
                    <div className="mb-1 flex justify-between text-xs text-zinc-500">
                      <span>{item.label}</span>
                      <span>{progress[item.key]}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${progress[item.key]}%`,
                          background:
                            "linear-gradient(90deg, #FF5C00 0%, #FF7A2F 50%, #FF9A5A 100%)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="mb-4 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mb-3 flex gap-5 border-b border-black/10">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="pb-2 text-sm font-medium transition"
                style={{
                  color: activeTab === tab.key ? "#1A1A1A" : "#666",
                  borderBottom: activeTab === tab.key ? "2px solid #FF5C00" : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {result && activeTab === "carousel" && (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {result.carousel.map((slide, index) => renderCard(slide, index))}
            </div>
          )}

          {result && activeTab !== "carousel" && (
            <div
              contentEditable
              suppressContentEditableWarning
              className="min-h-[220px] rounded-[18px] bg-white p-5 text-sm leading-7 shadow-[0_10px_20px_rgba(0,0,0,0.06)] outline-none"
            >
              {result[activeTab]}
            </div>
          )}
        </section>

        <aside className="w-full bg-white px-4 py-5 lg:w-[320px] lg:border-l lg:border-l-black/10 lg:px-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-zinc-800">Панель справа</p>
            <p className="mt-1 text-xs text-zinc-500">telegramId: {telegramId || "guest"}</p>
          </div>
          <div className="rounded-[14px] bg-[#F7F4F1] p-3 text-xs text-zinc-600">
            <p className="mb-2 font-medium text-zinc-700">Текущие настройки</p>
            <p>Палитра: {currentPalette.label}</p>
            <p>Стиль: {cardStyles.find((s) => s.id === styleId)?.label}</p>
            <p>Шрифт: {fonts.find((f) => f.id === fontId)?.label}</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
