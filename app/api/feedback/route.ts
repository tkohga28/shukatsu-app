import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** ```json ... ``` のコードフェンスを剥がして JSON 文字列を返す */
function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type } = body;

  // ─── 志望動機チェック ───────────────────────────────────────────────────────
  if (type === "motivation") {
    const { companyName, motivation, supplement } = body;

    if (!companyName?.trim()) {
      return Response.json({ error: "企業名を入力してください" }, { status: 400 });
    }
    if (!motivation?.trim()) {
      return Response.json({ error: "志望動機を入力してください" }, { status: 400 });
    }

    const supplementSection = supplement?.trim()
      ? `\n補足情報：${supplement}`
      : "";

    const prompt = `あなたは就活のプロのキャリアアドバイザーです。
以下の志望動機を分析し、必ず下記のJSON形式のみで回答してください。
JSON以外のテキスト（前置き・説明・コードブロック記号）は一切出力しないでください。

企業名：${companyName}
志望動機：${motivation}${supplementSection}

出力するJSONの形式（キー名・構造を厳守してください）：
{
  "understanding": { "score": <1〜5の整数>, "comment": "<企業理解度のコメント（2〜3文）>" },
  "alignment":     { "score": <1〜5の整数>, "comment": "<一致度のコメント（2〜3文）>" },
  "uniqueness":    { "score": <1〜5の整数>, "comment": "<独自性のコメント（2〜3文）>" },
  "improvement":   ["<改善提案1>", "<改善提案2>", "<改善提案3>"],
  "overall":       "<総評（2〜3文）>"
}

採点基準：
- understanding（企業理解度）：志望動機から読み取れる企業研究の深さ
- alignment（一致度）：企業の理念・社風と志望動機の方向性の合致度
- uniqueness（独自性）：「なぜ他社ではなくこの企業か」が伝わるか

scoreは必ず1〜5の整数。出力はJSONオブジェクトのみ。`;

    try {
      const message = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = message.content.find((b) => b.type === "text")?.text ?? "";
      const parsed = JSON.parse(stripFences(raw));

      for (const key of ["understanding", "alignment", "uniqueness"] as const) {
        if (typeof parsed[key]?.score !== "number" || typeof parsed[key]?.comment !== "string") {
          throw new Error("invalid field: " + key);
        }
      }
      if (!Array.isArray(parsed.improvement) || typeof parsed.overall !== "string") {
        throw new Error("invalid improvement/overall");
      }

      return Response.json(parsed);
    } catch (e) {
      console.error("motivation parse error:", e);
      return Response.json(
        { error: "フィードバックの生成に失敗しました。もう一度お試しください。" },
        { status: 500 }
      );
    }
  }

  // ─── 面接 / ES フィードバック ─────────────────────────────────────────────
  const { question, answer } = body;

  if (!answer?.trim()) {
    return Response.json({ error: "回答を入力してください" }, { status: 400 });
  }

  const typeLabel = type === "interview" ? "面接回答" : "エントリーシート（ES）";
  const questionSection = question?.trim() ? `\n設問：${question}` : "";

  const prompt = `あなたは就職活動のプロのキャリアアドバイザーです。
以下の${typeLabel}を分析し、必ず下記のJSON形式のみで回答してください。
JSON以外のテキスト（前置き・説明・コードブロック記号）は一切出力しないでください。
${questionSection}
回答：${answer}

出力するJSONの形式（キー名・構造を厳守してください）：
{
  "clarity":         { "score": <1〜5の整数>, "comment": "<結論の明確さのコメント（2〜3文）>" },
  "specificity":     { "score": <1〜5の整数>, "comment": "<根拠の具体性のコメント（2〜3文）>" },
  "learning":        { "score": <1〜5の整数>, "comment": "<学びの言語化のコメント（2〜3文）>" },
  "reproducibility": { "score": <1〜5の整数>, "comment": "<再現性の伝わりやすさのコメント（2〜3文）>" },
  "improvement":     ["<改善提案1>", "<改善提案2>"],
  "overall":         "<総評（2〜3文）>"
}

採点基準：
- clarity（結論の明確さ）：結論が冒頭に明確に述べられているか
- specificity（根拠の具体性）：具体的な経験・数字・エピソードが含まれているか
- learning（学びの言語化）：経験から何を学んだかが自分の言葉で表現されているか
- reproducibility（再現性）：その経験が将来の仕事でも活かせると伝わるか

scoreは必ず1〜5の整数。出力はJSONオブジェクトのみ。`;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(stripFences(raw));

    for (const key of ["clarity", "specificity", "learning", "reproducibility"] as const) {
      if (typeof parsed[key]?.score !== "number" || typeof parsed[key]?.comment !== "string") {
        throw new Error("invalid field: " + key);
      }
    }
    if (!Array.isArray(parsed.improvement) || typeof parsed.overall !== "string") {
      throw new Error("invalid improvement/overall");
    }

    return Response.json(parsed);
  } catch (e) {
    console.error("feedback parse error:", e);
    return Response.json(
      { error: "フィードバックの生成に失敗しました。もう一度お試しください。" },
      { status: 500 }
    );
  }
}
