"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type FeedbackType = "interview" | "es";

type HistoryItem = {
  id: string;
  type: FeedbackType;
  question: string;
  answer: string;
  feedback: string;
  createdAt: string; // ISO string
};

const STORAGE_KEY = "shukatsu_history";

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

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

type View = "form" | "history" | "history-detail";

export default function Home() {
  const [view, setView] = useState<View>("form");
  const [activeTab, setActiveTab] = useState<FeedbackType>("interview");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleSubmit = async () => {
    if (!answer.trim()) {
      setError("回答を入力してください。");
      return;
    }
    setError("");
    setFeedback("");
    setLoading(true);

    let fullFeedback = "";

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
        const chunk = decoder.decode(value, { stream: true });
        fullFeedback += chunk;
        setFeedback((prev) => prev + chunk);
        feedbackRef.current?.scrollIntoView({ behavior: "smooth" });
      }

      // 履歴に保存
      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        type: activeTab,
        question,
        answer,
        feedback: fullFeedback,
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
    setFeedback("");
    setError("");
  };

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
    setHistory(updated);
    if (selectedItem?.id === id) {
      setSelectedItem(null);
      setView("history");
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setSelectedItem(item);
    setView("history-detail");
  };

  const exampleQuestions =
    activeTab === "interview" ? INTERVIEW_EXAMPLES : ES_EXAMPLES;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">就活対策アプリ</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              AIが面接・ESの回答にフィードバックします
            </p>
          </div>
          <button
            onClick={() => setView(view === "history" ? "form" : "history")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view !== "form"
                ? "bg-blue-600 text-white"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
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

        {/* ===== 履歴詳細 ===== */}
        {view === "history-detail" && selectedItem && (
          <>
            <button
              onClick={() => setView("history")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              履歴一覧に戻る
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selectedItem.type === "interview" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {selectedItem.type === "interview" ? "面接" : "ES"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(selectedItem.createdAt)}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteHistory(selectedItem.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                AIフィードバック
              </h2>
              <FeedbackContent text={selectedItem.feedback} />
            </div>
          </>
        )}

        {/* ===== 履歴一覧 ===== */}
        {view === "history" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">フィードバック履歴</h2>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("履歴をすべて削除しますか？")) {
                      saveHistory([]);
                      setHistory([]);
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  すべて削除
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-400">まだ履歴がありません</p>
                <button
                  onClick={() => setView("form")}
                  className="mt-4 text-sm text-blue-600 hover:underline"
                >
                  フィードバックを受ける →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="flex-1 text-left"
                        onClick={() => handleSelectHistory(item)}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${item.type === "interview" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {item.type === "interview" ? "面接" : "ES"}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                        </div>
                        {item.question && (
                          <p className="text-sm font-medium text-gray-700 mb-1 truncate">{item.question}</p>
                        )}
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{item.answer}</p>
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
            )}
          </>
        )}

        {/* ===== フォーム ===== */}
        {view === "form" && (
          <>
            {/* Tab */}
            <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100">
              {(["interview", "es"] as FeedbackType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    handleReset();
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "interview" ? "面接回答フィードバック" : "ESフィードバック"}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {activeTab === "interview" ? "質問（任意）" : "設問（任意）"}
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={
                    activeTab === "interview"
                      ? "例：学生時代に最も力を入れたことを教えてください。"
                      : "例：学生時代に力を入れたこと（ガクチカ）"
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {exampleQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuestion(q)}
                      className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                    >
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
                  placeholder={
                    activeTab === "interview"
                      ? "面接で話す内容を入力してください…"
                      : "ESの文章をそのまま貼り付けてください…"
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{answer.length} 文字</p>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      フィードバック生成中…
                    </>
                  ) : (
                    "フィードバックを受ける"
                  )}
                </button>
                {(answer || feedback) && (
                  <button
                    onClick={handleReset}
                    className="px-5 py-3 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    リセット
                  </button>
                )}
              </div>
            </div>

            {/* Feedback Output */}
            {(feedback || loading) && (
              <div
                ref={feedbackRef}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  AIフィードバック
                </h2>
                <div>
                  {feedback ? (
                    <FeedbackContent text={feedback} />
                  ) : (
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-4 bg-gray-100 rounded w-full" />
                      ))}
                    </div>
                  )}
                </div>
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function FeedbackContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-xl font-bold text-gray-900 mt-6 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold text-gray-800 mt-5 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-gray-700 text-sm leading-relaxed mb-3">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-gray-700">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-blue-400 pl-4 py-1 bg-blue-50 rounded-r-lg text-blue-700 text-sm mb-3">{children}</blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
