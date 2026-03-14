"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackType = "interview" | "es";

type Scores = {
  clarity: number;        // 結論の明確さ
  specificity: number;    // 根拠の具体性
  learning: number;       // 学びの言語化
  reproducibility: number; // 再現性の伝わりやすさ
};

type HistoryItem = {
  id: string;
  type: FeedbackType;
  question: string;
  answer: string;
  feedback: string;
  scores: Scores | null;
  createdAt: string;
};

type View = "form" | "history" | "history-detail";

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "shukatsu_history";
const SCORE_MARKER = "<SCORE>";
const SCORE_END_MARKER = "</SCORE>";

const AXES: { key: keyof Scores; label: string; color: keyof typeof COLOR }[] = [
  { key: "clarity",        label: "結論の明確さ",         color: "blue"   },
  { key: "specificity",    label: "根拠の具体性",         color: "green"  },
  { key: "learning",       label: "学びの言語化",         color: "purple" },
  { key: "reproducibility", label: "再現性の伝わりやすさ", color: "orange" },
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

// ─── Score parsing ────────────────────────────────────────────────────────────

function parseScores(raw: string): { feedbackText: string; scores: Scores | null } {
  const start = raw.indexOf(SCORE_MARKER);
  if (start === -1) return { feedbackText: raw, scores: null };

  const feedbackText = raw.slice(0, start).trim();
  const end = raw.indexOf(SCORE_END_MARKER, start);
  if (end === -1) return { feedbackText, scores: null };

  try {
    const json = raw.slice(start + SCORE_MARKER.length, end);
    const scores = JSON.parse(json) as Scores;
    if (
      typeof scores.clarity === "number" &&
      typeof scores.specificity === "number" &&
      typeof scores.learning === "number" &&
      typeof scores.reproducibility === "number"
    ) {
      return { feedbackText, scores };
    }
    return { feedbackText, scores: null };
  } catch {
    return { feedbackText, scores: null };
  }
}

/** ストリーミング中の表示用：<SCORE>以降は非表示 */
function getDisplayText(raw: string): string {
  const idx = raw.indexOf(SCORE_MARKER);
  return idx === -1 ? raw : raw.slice(0, idx).trim();
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

// ─── Components ───────────────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number; color: keyof typeof COLOR }) {
  const c = COLOR[color];
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${c.bar}`}
          style={{ width: `${(score / 5) * 100}%` }}
        />
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

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 100, H = 36, PAD = 4;
  if (values.length === 0) return null;
  if (values.length === 1) {
    const cy = PAD + (H - PAD * 2) * (1 - (values[0] - 1) / 4);
    return (
      <svg width={W} height={H}>
        <circle cx={W / 2} cy={cy} r="3" fill={color} />
      </svg>
    );
  }
  const xStep = (W - PAD * 2) / (values.length - 1);
  const yOf = (v: number) => PAD + (H - PAD * 2) * (1 - (v - 1) / 4);
  const points = values.map((v, i) => `${PAD + i * xStep},${yOf(v)}`).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {values.map((v, i) => (
        <circle key={i} cx={PAD + i * xStep} cy={yOf(v)} r="2.5" fill={color} />
      ))}
    </svg>
  );
}

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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView]             = useState<View>("form");
  const [activeTab, setActiveTab]   = useState<FeedbackType>("interview");
  const [question, setQuestion]     = useState("");
  const [answer, setAnswer]         = useState("");
  const [rawFeedback, setRawFeedback] = useState(""); // full streamed text incl. <SCORE>
  const [scores, setScores]         = useState<Scores | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [history, setHistory]       = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const handleSubmit = async () => {
    if (!answer.trim()) { setError("回答を入力してください。"); return; }
    setError("");
    setRawFeedback("");
    setScores(null);
    setLoading(true);

    let accumulated = "";

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeTab, question, answer }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "エラーが発生しました");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("ストリームの取得に失敗しました");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setRawFeedback(accumulated);
      }

      // ストリーム完了後にスコアを抽出して保存
      const { feedbackText, scores: parsedScores } = parseScores(accumulated);
      setScores(parsedScores);

      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        type: activeTab,
        question,
        answer,
        feedback: feedbackText,
        scores: parsedScores,
        createdAt: new Date().toISOString(),
      };
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
    setQuestion("");
    setAnswer("");
    setRawFeedback("");
    setScores(null);
    setError("");
  };

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
    setHistory(updated);
    if (selectedItem?.id === id) { setSelectedItem(null); setView("history"); }
  };

  const exampleQuestions = activeTab === "interview" ? INTERVIEW_EXAMPLES : ES_EXAMPLES;
  const displayFeedback = getDisplayText(rawFeedback);

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
              <button
                onClick={() => setView("history")}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
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
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selectedItem.type === "interview" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {selectedItem.type === "interview" ? "面接" : "ES"}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(selectedItem.createdAt)}</span>
                </div>
                <button onClick={() => handleDeleteHistory(selectedItem.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  削除
                </button>
              </div>
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
            </div>

            {/* スコア */}
            {selectedItem.scores && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">採点結果</h2>
                <ScoreCards scores={selectedItem.scores} />
              </div>
            )}

            {/* フィードバック */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                AIフィードバック
              </h2>
              <FeedbackContent text={selectedItem.feedback} />
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
                {/* 統計サマリー */}
                <StatsSection history={history} />

                {/* 履歴リスト */}
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button className="flex-1 text-left" onClick={() => { setSelectedItem(item); setView("history-detail"); }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${item.type === "interview" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                              {item.type === "interview" ? "面接" : "ES"}
                            </span>
                            <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                          </div>
                          {item.question && <p className="text-sm font-medium text-gray-700 mb-2 truncate">{item.question}</p>}
                          {item.scores && (
                            <div className="flex gap-3 mb-2">
                              {AXES.map(({ key, label, color }) => (
                                <span key={key} className={`text-xs font-medium ${COLOR[color].text}`}>
                                  {label.slice(0, 2)} {item.scores![key]}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-400 line-clamp-1 leading-relaxed">{item.answer}</p>
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(item.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-1"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ フォーム ═══ */}
        {view === "form" && (
          <>
            {/* タブ */}
            <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100">
              {(["interview", "es"] as FeedbackType[]).map((tab) => (
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

            {/* 入力フォーム */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {activeTab === "interview" ? "質問（任意）" : "設問（任意）"}
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={activeTab === "interview" ? "例：学生時代に最も力を入れたことを教えてください。" : "例：学生時代に力を入れたこと（ガクチカ）"}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{answer.length} 文字</p>
              </div>

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
                      フィードバックを受ける
                    </>
                  )}
                </button>
                {(answer || rawFeedback) && (
                  <button onClick={handleReset} className="px-5 py-3 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    リセット
                  </button>
                )}
              </div>
            </div>

            {/* フィードバック結果 */}
            {(rawFeedback || loading) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  AIフィードバック
                </h2>

                {/* スコア（ストリーム完了後に表示） */}
                {scores && <ScoreCards scores={scores} />}

                {displayFeedback ? (
                  <FeedbackContent text={displayFeedback} />
                ) : (
                  <div className="space-y-3 animate-pulse">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="h-4 bg-gray-100 rounded w-full" />)}
                  </div>
                )}
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

function StatsSection({ history }: { history: HistoryItem[] }) {
  const scored = history.filter((h) => h.scores !== null);
  const TREND_COUNT = 10;
  // 時系列順（古い→新しい）で最大10件
  const trendItems = [...scored].reverse().slice(-TREND_COUNT);

  return (
    <div className="space-y-4">
      {/* サマリーカード */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-6 mb-5">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{history.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">総練習回数</p>
          </div>
          {scored.length > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {(avg(AXES.map(({ key }) => avg(scored.map((h) => h.scores![key])))) ).toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">総合平均スコア</p>
            </div>
          )}
        </div>

        {scored.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500">4軸の平均スコア</p>
            {AXES.map(({ key, label, color }) => {
              const average = avg(scored.map((h) => h.scores![key]));
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

      {/* スコア推移 */}
      {trendItems.length >= 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-500 mb-4">スコア推移（直近{trendItems.length}回）</p>
          <div className="grid grid-cols-2 gap-4">
            {AXES.map(({ key, label, color }) => {
              const values = trendItems.map((h) => h.scores![key]);
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
