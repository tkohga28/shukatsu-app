import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { type, question, answer } = await req.json();

  if (!answer?.trim()) {
    return Response.json({ error: "回答を入力してください" }, { status: 400 });
  }

  const typeLabel = type === "interview" ? "面接回答" : "エントリーシート（ES）";
  const questionSection = question?.trim()
    ? `【設問・質問】\n${question}\n\n`
    : "";

  const prompt = `あなたは就職活動のプロのキャリアアドバイザーです。
以下の${typeLabel}に対して、下記のフォーマットで具体的なフィードバックを行ってください。

${questionSection}【${typeLabel}の内容】
${answer}

---
以下のフォーマットで必ず出力してください：

## 結論の明確さ
（結論が冒頭に明確に述べられているかを評価）

## 根拠の具体性
（具体的な経験・数字・エピソードが含まれているかを評価）

## 学びの言語化
（経験から何を学んだかが自分の言葉で表現されているかを評価）

## 再現性の伝わりやすさ
（その経験が将来の仕事でも活かせると伝わるかを評価）

## 改善アドバイス
（具体的な改善提案を1〜2つ、「〇〇という表現に変えると△△が伝わりやすくなります」の形式で記載）

---
フィードバックの最後に、上記4軸を1〜5の整数で採点し、必ず以下の形式のみで出力してください（余分な文言は不要）：
<SCORE>{"clarity":結論の明確さのスコア,"specificity":根拠の具体性のスコア,"learning":学びの言語化のスコア,"reproducibility":再現性の伝わりやすさのスコア}</SCORE>`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = client.messages.stream({
          model: "claude-opus-4-6",
          max_tokens: 2048,
          thinking: { type: "adaptive" },
          messages: [{ role: "user", content: prompt }],
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          controller.error(
            new Error(`APIエラー (${error.status}): ${error.message}`)
          );
        } else {
          controller.error(error);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
