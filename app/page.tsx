"use client";

import { useState, useRef } from "react";

type FeedbackType = "interview" | "es";

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<FeedbackType>("interview");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    if (!answer.trim()) {
      setError("回答を入力してください。");
      return;
    }
    setError("");
    setFeedback("");
    setLoading(true);

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
        setFeedback((prev) => prev + decoder.decode(value, { stream: true }));
        feedbackRef.current?.scrollIntoView({ behavior: "smooth" });
      }
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

  const exampleQuestions =
    activeTab === "interview" ? INTERVIEW_EXAMPLES : ES_EXAMPLES;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-gray-900">就活対策アプリ</h1>
          <p className="text-sm text-gray-500 mt-1">
            AIが面接・ESの回答にフィードバックします
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
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
          {/* Question */}
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
            {/* Example chips */}
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

          {/* Answer */}
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
            <p className="text-xs text-gray-400 mt-1 text-right">
              {answer.length} 文字
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-lg">
              {error}
            </p>
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
      </main>

      <footer className="text-center text-xs text-gray-400 py-8">
        Powered by Claude Opus 4.6
      </footer>
    </div>
  );
}

function FeedbackContent({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (/^【.+】/.test(line)) {
          return (
            <p key={i} className="font-semibold text-gray-800 mt-4 first:mt-0">
              {line}
            </p>
          );
        }
        if (line.startsWith("→")) {
          return (
            <p
              key={i}
              className="text-blue-700 bg-blue-50 rounded-lg px-4 py-3 mt-3 text-sm"
            >
              {line}
            </p>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="text-gray-700 text-sm leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}
