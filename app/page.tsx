"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackType = "interview" | "es" | "motivation";

/** 各軸のスコア + コメント（新形式） */
type FeedbackItem = { score: number; comment: string };

/** 面接 / ES の構造化フィードバック */
type StructuredFeedback = {
  clarity: FeedbackItem;
  specificity: FeedbackItem;
  learning: FeedbackItem;
  reproducibility: FeedbackItem;
  improvement: string[];
  overall: string;
};

/** 志望動機チェックの構造化フィードバック */
type MotivationFeedback = {
  understanding: FeedbackItem;
  alignment: FeedbackItem;
  uniqueness: FeedbackItem;
  improvement: string[];
  overall: string;
};

/** 旧形式との互換用スコア型 */
type Scores = {
  clarity: number;
  specificity: number;
  learning: number;
  reproducibility: number;
};

type MotivationScores = {
  understanding: number;
  alignment: number;
  uniqueness: number;
};

type HistoryItem = {
  id: string;
  type: FeedbackType;
  question: string;
  answer: string;
  supplement?: string;
  /** 旧形式のマークダウンフィードバック（後方互換用） */
  feedback: string;
  /** 新形式の構造化フィードバック */
  structuredFeedback?: StructuredFeedback | MotivationFeedback;
  scores: Scores | MotivationScores | null;
  createdAt: string;
};

type View = "form" | "history" | "history-detail";

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "shukatsu_history";
const ONBOARDING_KEY = "shukatsu_onboarding_dismissed";

const AXES: { key: keyof Scores; label: string; color: keyof typeof COLOR }[] = [
  { key: "clarity",         label: "結論の明確さ",         color: "blue"   },
  { key: "specificity",     label: "根拠の具体性",         color: "green"  },
  { key: "learning",        label: "学びの言語化",         color: "purple" },
  { key: "reproducibility", label: "再現性の伝わりやすさ", color: "orange" },
];

const MOTIVATION_AXES: { key: keyof MotivationScores; label: string; color: keyof typeof COLOR }[] = [
  { key: "understanding", label: "企業理解度", color: "blue"   },
  { key: "alignment",     label: "一致度",     color: "green"  },
  { key: "uniqueness",    label: "独自性",     color: "purple" },
];

const COLOR = {
  blue:   { bg: "bg-blue-50",   text: "text-blue-700",   bar: "bg-blue-500",   stroke: "#3b82f6" },
  green:  { bg: "bg-green-50",  text: "text-green-700",  bar: "bg-green-500",  stroke: "#22c55e" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", bar: "bg-purple-500", stroke: "#a855f7" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-500", stroke: "#f97316" },
} as const;

const INTERVIEW_EXAMPLES = [
  "学生時代に最も力を入れたことを教えてください。",
  "あなたの強みと弱みを教えてください。",
  "志望動機を教えてください。",
  "困難を乗り越えた経験を教えてください。",
];

const ES_EXAMPLES = [
  "学生時代に力を入れたこと（ガクチカ）",
  "自己PR",
  "志望動機",
  "入社後にやりたいこと",
];

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function typeBadge(type: FeedbackType) {
  if (type === "interview") return { label: "面接",     className: "bg-blue-100 text-blue-700"   };
  if (type === "es")        return { label: "ES",       className: "bg-purple-100 text-purple-700" };
  return                           { label: "志望動機", className: "bg-teal-100 text-teal-700"   };
}

// ─── Components ───────────────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number; color: keyof typeof COLOR }) {
  const c = COLOR[color];
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${(score / 5) * 100}%` }} />
      </div>
      <span className={`text-sm font-bold w-6 text-right ${c.text}`}>{score}</span>
    </div>
  );
}

function ScoreCards({ scores }: { scores: Scores }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-5">
      {AXES.map(({ key, label, color }) => {
        const c = COLOR[color];
        return (
          <div key={key} className={`${c.bg} rounded-xl p-4`}>
            <p className={`text-xs font-medium ${c.text} mb-2`}>{label}</p>
            <div className="flex items-end gap-1">
              <span className={`text-2xl font-bold ${c.text}`}>{scores[key]}</span>
              <span className="text-xs text-gray-400 mb-0.5">/ 5</span>
            </div>
            <ScoreBar score={scores[key]} color={color} />
          </div>
        );
      })}
    </div>
  );
}

function MotivationScoreCards({ scores }: { scores: MotivationScores }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {MOTIVATION_AXES.map(({ key, label, color }) => {
        const c = COLOR[color];
        return (
          <div key={key} className={`${c.bg} rounded-xl p-4`}>
            <p className={`text-xs font-medium ${c.text} mb-2`}>{label}</p>
            <div className="flex items-end gap-1">
              <span className={`text-2xl font-bold ${c.text}`}>{scores[key]}</span>
              <span className="text-xs text-gray-400 mb-0.5">/ 5</span>
            </div>
            <ScoreBar score={scores[key]} color={color} />
          </div>
        );
      })}
    </div>
  );
}

function ImprovementList({ items }: { items: string[] }) {
  return (
    <div className="bg-amber-50 rounded-xl p-4">
      <p className="text-sm font-semibold text-amber-700 mb-3">改善提案</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
            <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OverallBox({ text }: { text: string }) {
  return (
    <div className="border-l-4 border-blue-400 pl-4 py-2 bg-blue-50 rounded-r-xl">
      <p className="text-xs font-semibold text-blue-600 mb-1">総評</p>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}

/** 新形式（構造化JSON）のフィードバック表示 */
function StructuredFeedbackView({
  feedback,
  isMotivation,
}: {
  feedback: StructuredFeedback | MotivationFeedback;
  isMotivation: boolean;
}) {
  if (isMotivation) {
    const mf = feedback as MotivationFeedback;
    const scores: MotivationScores = {
      understanding: mf.understanding.score,
      alignment: mf.alignment.score,
      uniqueness: mf.uniqueness.score,
    };
    return (
      <div className="space-y-4">
        <MotivationScoreCards scores={scores} />
        {MOTIVATION_AXES.map(({ key, label, color }) => {
          const c = COLOR[color];
          return (
            <div key={key} className={`${c.bg} rounded-xl p-4`}>
              <p className={`text-sm font-semibold ${c.text} mb-1.5`}>{label}</p>
              <p className="text-sm text-gray-700 leading-relaxed">{mf[key].comment}</p>
            </div>
          );
        })}
        <ImprovementList items={mf.improvement} />
        <OverallBox text={mf.overall} />
      </div>
    );
  }

  const sf = feedback as StructuredFeedback;
  const scores: Scores = {
    clarity: sf.clarity.score,
    specificity: sf.specificity.score,
    learning: sf.learning.score,
    reproducibility: sf.reproducibility.score,
  };
  return (
    <div className="space-y-4">
      <ScoreCards scores={scores} />
      {AXES.map(({ key, label, color }) => {
        const c = COLOR[color];
        return (
          <div key={key} className={`${c.bg} rounded-xl p-4`}>
            <p className={`text-sm font-semibold ${c.text} mb-1.5`}>{label}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{sf[key].comment}</p>
          </div>
        );
      })}
      <ImprovementList items={sf.improvement} />
      <OverallBox text={sf.overall} />
    </div>
  );
}

/** 旧形式（マークダウン）のフィードバック表示（後方互換） */
function FeedbackContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-6 mb-2 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold text-gray-800 mt-5 mb-2 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1 first:mt-0">{children}</h3>,
        p:  ({ children }) => <p className="text-gray-700 text-sm leading-relaxed mb-3">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-400 pl-4 py-1 bg-blue-50 rounded-r-lg text-blue-700 text-sm mb-3">{children}</blockquote>,
        code: ({ children }) => <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 100, H = 36, PAD = 4;
  if (values.length === 0) return null;
  if (values.length === 1) {
    const cy = PAD + (H - PAD * 2) * (1 - (values[0] - 1) / 4);
    return <svg width={W} height={H}><circle cx={W / 2} cy={cy} r="3" fill={color} /></svg>;
  }
  const xStep = (W - PAD * 2) / (values.length - 1);
  const yOf = (v: number) => PAD + (H - PAD * 2) * (1 - (v - 1) / 4);
  const points = values.map((v, i) => `${PAD + i * xStep},${yOf(v)}`).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      {values.map((v, i) => <circle key={i} cx={PAD + i * xStep} cy={yOf(v)} r="2.5" fill={color} />)}
    </svg>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView]         = useState<View>("form");
  const [activeTab, setActiveTab] = useState<"interview" | "es">("interview");
  const [esSubTab, setEsSubTab]   = useState<"question" | "motivation">("question");

  // 通常フォーム
  const [question, setQuestion] = useState("");
  const [answer, setAnswer]     = useState("");

  // 志望動機フォーム
  const [companyName, setCompanyName]       = useState("");
  const [motivationText, setMotivationText] = useState("");
  const [supplementText, setSupplementText] = useState("");

  // フィードバック結果
  const [structuredFeedback, setStructuredFeedback] = useState<StructuredFeedback | MotivationFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [history, setHistory]             = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem]   = useState<HistoryItem | null>(null);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"all" | FeedbackType>("all");
  const [historyQuestionFilter, setHistoryQuestionFilter] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem(ONBOARDING_KEY);
      if (!dismissed) setShowOnboarding(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_KEY, "1");
    }
  };

  const isMotivationMode = activeTab === "es" && esSubTab === "motivation";

  const handleSubmit = async () => {
    if (isMotivationMode) {
      if (!companyName.trim())    { setError("企業名を入力してください。"); return; }
      if (!motivationText.trim()) { setError("志望動機を入力してください。"); return; }
    } else {
      if (!answer.trim()) { setError("回答を入力してください。"); return; }
    }
    setError("");
    setStructuredFeedback(null);
    setLoading(true);

    try {
      const body = isMotivationMode
        ? { type: "motivation", companyName, motivation: motivationText, supplement: supplementText }
        : { type: activeTab, question, answer };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "エラーが発生しました");

      setStructuredFeedback(data);

      // HistoryItem に保存
      let scores: Scores | MotivationScores | null = null;
      let newItem: HistoryItem;

      if (isMotivationMode) {
        const mf = data as MotivationFeedback;
        scores = { understanding: mf.understanding.score, alignment: mf.alignment.score, uniqueness: mf.uniqueness.score };
        newItem = {
          id: crypto.randomUUID(),
          type: "motivation",
          question: companyName,
          answer: motivationText,
          supplement: supplementText || undefined,
          feedback: mf.overall,
          structuredFeedback: mf,
          scores,
          createdAt: new Date().toISOString(),
        };
      } else {
        const sf = data as StructuredFeedback;
        scores = { clarity: sf.clarity.score, specificity: sf.specificity.score, learning: sf.learning.score, reproducibility: sf.reproducibility.score };
        newItem = {
          id: crypto.randomUUID(),
          type: activeTab,
          question,
          answer,
          feedback: sf.overall,
          structuredFeedback: sf,
          scores,
          createdAt: new Date().toISOString(),
        };
      }

      const updated = [newItem, ...loadHistory()];
      saveHistory(updated);
      setHistory(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuestion(""); setAnswer("");
    setCompanyName(""); setMotivationText(""); setSupplementText("");
    setStructuredFeedback(null);
    setError("");
  };

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
    setHistory(updated);
    if (selectedItem?.id === id) { setSelectedItem(null); setView("history"); }
  };

  const handlePracticeAgain = (item: HistoryItem) => {
    handleReset();
    if (item.type === "motivation") {
      setActiveTab("es");
      setEsSubTab("motivation");
      setCompanyName(item.question);
    } else {
      setActiveTab(item.type as "interview" | "es");
      setEsSubTab("question");
      setQuestion(item.question);
    }
    setView("form");
  };

  const uniqueQuestions = Array.from(
    new Set(history.filter((h) => h.question).map((h) => h.question))
  ).filter(Boolean);

  const filteredHistory = history.filter((item) => {
    if (historyTypeFilter !== "all" && item.type !== historyTypeFilter) return false;
    if (historyQuestionFilter && item.question !== historyQuestionFilter) return false;
    return true;
  });

  const exampleQuestions = activeTab === "interview" ? INTERVIEW_EXAMPLES : ES_EXAMPLES;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">就活対策アプリ</h1>
            <p className="text-xs text-gray-500 mt-0.5">AIが面接・ESの回答にフィードバックします</p>
          </div>
          <button
            onClick={() => setView(view === "history" ? "form" : "history")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view !== "form" ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            履歴
            {history.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${view !== "form" ? "bg-white text-blue-600" : "bg-blue-100 text-blue-600"}`}>
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ═══ 履歴詳細 ═══ */}
        {view === "history-detail" && selectedItem && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => setView("history")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                履歴一覧に戻る
              </button>
              <button
                onClick={() => { handleReset(); setView("form"); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新しく練習する
              </button>
            </div>

            {/* メタ情報 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${typeBadge(selectedItem.type).className}`}>
                    {typeBadge(selectedItem.type).label}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(selectedItem.createdAt)}</span>
                </div>
                <button onClick={() => handleDeleteHistory(selectedItem.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
              </div>
              {selectedItem.type === "motivation" ? (
                <>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">企業名</p>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-4 py-3">{selectedItem.question}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">志望動機</p>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap leading-relaxed">{selectedItem.answer}</p>
                  </div>
                  {selectedItem.supplement && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">補足情報</p>
                      <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap leading-relaxed">{selectedItem.supplement}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {selectedItem.question && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">質問 / 設問</p>
                      <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-4 py-3">{selectedItem.question}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">回答内容</p>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap leading-relaxed">{selectedItem.answer}</p>
                  </div>
                </>
              )}
            </div>

            {/* フィードバック */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                AIフィードバック
              </h2>
              {selectedItem.structuredFeedback ? (
                <StructuredFeedbackView
                  feedback={selectedItem.structuredFeedback}
                  isMotivation={selectedItem.type === "motivation"}
                />
              ) : (
                /* 旧形式：スコア + マークダウン */
                <>
                  {selectedItem.scores && (
                    <div className="mb-5">
                      {selectedItem.type === "motivation"
                        ? <MotivationScoreCards scores={selectedItem.scores as MotivationScores} />
                        : <ScoreCards scores={selectedItem.scores as Scores} />
                      }
                    </div>
                  )}
                  <FeedbackContent text={selectedItem.feedback} />
                </>
              )}
            </div>
          </>
        )}

        {/* ═══ 履歴一覧 ═══ */}
        {view === "history" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">練習履歴・スコア推移</h2>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <button
                    onClick={() => { if (confirm("履歴をすべて削除しますか？")) { saveHistory([]); setHistory([]); } }}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    すべて削除
                  </button>
                )}
                <button
                  onClick={() => { handleReset(); setView("form"); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新しく練習する
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-400">まだ履歴がありません</p>
                <button onClick={() => setView("form")} className="mt-4 text-sm text-blue-600 hover:underline">
                  フィードバックを受ける →
                </button>
              </div>
            ) : (
              <>
                {/* フィルター */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">種別</p>
                    <div className="flex flex-wrap gap-2">
                      {(["all", "interview", "es", "motivation"] as const).map((t) => {
                        const labels: Record<string, string> = { all: "すべて", interview: "面接", es: "ES", motivation: "志望動機チェック" };
                        return (
                          <button
                            key={t}
                            onClick={() => setHistoryTypeFilter(t)}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                              historyTypeFilter === t
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {labels[t]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {uniqueQuestions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">設問</p>
                      <select
                        value={historyQuestionFilter}
                        onChange={(e) => setHistoryQuestionFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">すべての設問</option>
                        {uniqueQuestions.map((q) => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <StatsSection history={history} questionFilter={historyQuestionFilter} />

                {filteredHistory.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                    <p className="text-sm text-gray-400">条件に一致する履歴がありません</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map((item) => {
                      const badge = typeBadge(item.type);
                      return (
                        <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-blue-200 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <button className="flex-1 text-left" onClick={() => { setSelectedItem(item); setView("history-detail"); }}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                                <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                              </div>
                              {item.question && (
                                <p className="text-sm font-medium text-gray-700 mb-2 truncate">
                                  {item.type === "motivation" ? `企業：${item.question}` : item.question}
                                </p>
                              )}
                              {item.scores != null && (
                                <div className="flex gap-3 mb-2">
                                  {item.type === "motivation"
                                    ? MOTIVATION_AXES.map(({ key, label, color }) => (
                                        <span key={key} className={`text-xs font-medium ${COLOR[color].text}`}>
                                          {label.slice(0, 2)} {(item.scores as MotivationScores)[key]}
                                        </span>
                                      ))
                                    : AXES.map(({ key, label, color }) => (
                                        <span key={key} className={`text-xs font-medium ${COLOR[color].text}`}>
                                          {label.slice(0, 2)} {(item.scores as Scores)[key]}
                                        </span>
                                      ))
                                  }
                                </div>
                              )}
                              <p className="text-xs text-gray-400 line-clamp-1 leading-relaxed">{item.answer}</p>
                            </button>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <button
                                onClick={() => handlePracticeAgain(item)}
                                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium whitespace-nowrap"
                              >
                                同じ設問で再練習
                              </button>
                              <button onClick={() => handleDeleteHistory(item.id)} className="text-gray-300 hover:text-red-400 transition-colors" title="削除">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ フォーム ═══ */}
        {view === "form" && (
          <>
            {/* オンボーディングバナー */}
            {showOnboarding && history.length === 0 && (
              <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 shadow-sm p-6">
                {/* × ボタン */}
                <button
                  onClick={handleDismissOnboarding}
                  className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-white/70 transition-colors"
                  aria-label="閉じる"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">はじめての方へ</p>
                <h2 className="text-lg font-bold text-gray-900 mb-4">このアプリでできること</h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {/* 面接練習 */}
                  <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
                    <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">面接練習</p>
                    <p className="text-xs text-gray-500 leading-relaxed">AIが結論・根拠・再現性の観点でFBします</p>
                  </div>

                  {/* ES添削 */}
                  <div className="bg-white rounded-xl p-4 border border-purple-100 shadow-sm">
                    <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">ES添削</p>
                    <p className="text-xs text-gray-500 leading-relaxed">面接で深掘りされても崩れない文章に仕上げます</p>
                  </div>

                  {/* 成長の記録 */}
                  <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
                    <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">成長の記録</p>
                    <p className="text-xs text-gray-500 leading-relaxed">設問別にスコア推移を記録して成長を可視化します</p>
                  </div>
                </div>

                <button
                  onClick={handleDismissOnboarding}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
                >
                  さっそく練習する
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>
            )}

            {/* メインタブ */}
            <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100">
              {(["interview", "es"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); handleReset(); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab ? "bg-blue-600 text-white shadow" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "interview" ? "面接回答フィードバック" : "ESフィードバック"}
                </button>
              ))}
            </div>

            {/* ESサブタブ */}
            {activeTab === "es" && (
              <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1">
                {(["question", "motivation"] as const).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => { setEsSubTab(sub); handleReset(); }}
                    className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                      esSubTab === sub ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {sub === "question" ? "設問フィードバック" : "志望動機チェック"}
                  </button>
                ))}
              </div>
            )}

            {/* 入力フォーム */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
              {isMotivationMode ? (
                /* 志望動機チェックフォーム */
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      企業名 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="例：株式会社〇〇"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      志望動機 <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={motivationText}
                      onChange={(e) => setMotivationText(e.target.value)}
                      rows={7}
                      placeholder="御社を志望した理由を入力してください..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">{motivationText.length} 文字</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      補足情報{" "}
                      <span className="text-xs font-normal text-gray-400">（任意）</span>
                    </label>
                    <textarea
                      value={supplementText}
                      onChange={(e) => setSupplementText(e.target.value)}
                      rows={3}
                      placeholder="自分の強み・経験など、判断に使ってほしい情報があれば"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 resize-none"
                    />
                  </div>
                </>
              ) : (
                /* 通常フォーム */
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {activeTab === "interview" ? "質問（任意）" : "設問（任意）"}
                    </label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder={activeTab === "interview" ? "例：学生時代に最も力を入れたことを教えてください。" : "例：学生時代に力を入れたこと（ガクチカ）"}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {exampleQuestions.map((q) => (
                        <button key={q} onClick={() => setQuestion(q)} className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {activeTab === "interview" ? "回答内容 *" : "ES内容 *"}
                    </label>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={8}
                      placeholder={activeTab === "interview" ? "面接で話す内容を入力してください…" : "ESの文章をそのまま貼り付けてください…"}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">{answer.length} 文字</p>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 rounded-xl text-base font-bold hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      フィードバック生成中…
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {isMotivationMode ? "志望動機をチェックする" : "フィードバックを受ける"}
                    </>
                  )}
                </button>
                {(answer || motivationText || structuredFeedback) && (
                  <button onClick={handleReset} className="px-5 py-3 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    リセット
                  </button>
                )}
              </div>
            </div>

            {/* ローディング */}
            {loading && !structuredFeedback && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="space-y-3 animate-pulse">
                  {[80, 100, 60, 90].map((w, i) => (
                    <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            )}

            {/* フィードバック結果 */}
            {structuredFeedback && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  AIフィードバック
                </h2>
                <StructuredFeedbackView feedback={structuredFeedback} isMotivation={isMotivationMode} />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8">
        Powered by Claude Opus 4.6
      </footer>
    </div>
  );
}

// ─── StatsSection ────────────────────────────────────────────────────────────

function StatsSection({ history, questionFilter }: { history: HistoryItem[]; questionFilter: string }) {
  const scored = history.filter(
    (h) => h.scores != null && h.type !== "motivation"
  ) as (HistoryItem & { scores: Scores })[];

  const TREND_COUNT = 10;

  // 設問フィルターが有効なとき：設問別の詳細表示
  if (questionFilter) {
    const qScored = scored.filter((h) => h.question === questionFilter);
    const trendItems = [...qScored].reverse().slice(-TREND_COUNT);
    const prevItem   = trendItems.length >= 2 ? trendItems[trendItems.length - 2] : null;
    const latestItem = trendItems.length >= 1 ? trendItems[trendItems.length - 1] : null;

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{qScored.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">この設問での練習回数</p>
            </div>
            {qScored.length > 0 && (
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {(avg(AXES.map(({ key }) => avg(qScored.map((h) => h.scores[key]))))).toFixed(1)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">総合平均スコア</p>
              </div>
            )}
          </div>

          {qScored.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500">4軸の平均スコア</p>
              {AXES.map(({ key, label, color }) => {
                const average = avg(qScored.map((h) => h.scores[key]));
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</span>
                    <div className="flex-1">
                      <ScoreBar score={Math.round(average * 10) / 10} color={color} />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{average.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {prevItem && latestItem && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">前回からの変化</p>
              <div className="flex flex-wrap gap-3">
                {AXES.map(({ key, label, color }) => {
                  const diff = latestItem.scores[key] - prevItem.scores[key];
                  const sign = diff > 0 ? "+" : "";
                  const diffClass = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400";
                  return (
                    <span key={key} className={`text-xs font-medium ${diffClass}`}>
                      {label.slice(0, 2)} {sign}{diff.toFixed(1)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {trendItems.length >= 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-500 mb-4">スコア推移（直近{trendItems.length}回）</p>
            <div className="grid grid-cols-2 gap-4">
              {AXES.map(({ key, label, color }) => {
                const values = trendItems.map((h) => h.scores[key]);
                const c = COLOR[color];
                return (
                  <div key={key} className={`${c.bg} rounded-xl p-3`}>
                    <p className={`text-xs font-medium ${c.text} mb-2`}>{label}</p>
                    <Sparkline values={values} color={c.stroke} />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400">初回 {values[0]}</span>
                      <span className={`text-xs font-bold ${c.text}`}>最新 {values[values.length - 1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // デフォルト：全体の統計表示
  const trendItems = [...scored].reverse().slice(-TREND_COUNT);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-6 mb-5">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{history.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">総練習回数</p>
          </div>
          {scored.length > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {(avg(AXES.map(({ key }) => avg(scored.map((h) => h.scores[key]))))).toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">総合平均スコア</p>
            </div>
          )}
        </div>

        {scored.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500">4軸の平均スコア</p>
            {AXES.map(({ key, label, color }) => {
              const average = avg(scored.map((h) => h.scores[key]));
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</span>
                  <div className="flex-1">
                    <ScoreBar score={Math.round(average * 10) / 10} color={color} />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{average.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {trendItems.length >= 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-500 mb-4">スコア推移（直近{trendItems.length}回）</p>
          <div className="grid grid-cols-2 gap-4">
            {AXES.map(({ key, label, color }) => {
              const values = trendItems.map((h) => h.scores[key]);
              const c = COLOR[color];
              return (
                <div key={key} className={`${c.bg} rounded-xl p-3`}>
                  <p className={`text-xs font-medium ${c.text} mb-2`}>{label}</p>
                  <Sparkline values={values} color={c.stroke} />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400">初回 {values[0]}</span>
                    <span className={`text-xs font-bold ${c.text}`}>最新 {values[values.length - 1]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
