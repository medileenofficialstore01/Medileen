import { NextResponse } from "next/server";
import { getResult } from "@/lib/store";
import { getProductById } from "@/lib/products";
import { dict, type Locale } from "@/lib/i18n";

function buildLineMessage(resultId: string, locale: Locale): string | null {
  const result = getResult(resultId);
  if (!result) return null;
  const t = dict[locale];

  const grade =
    result.overallScore >= 75
      ? t.result.grades.excellent
      : result.overallScore >= 60
        ? t.result.grades.moderate
        : t.result.grades.needsCare;

  const isTh = locale === "th";

  const lines: string[] = [
    "🌿 MEDILEEN — " + (isTh ? "ผลตรวจสภาพผิว" : "Skin Analysis Result"),
    "",
    (isTh ? "คะแนนรวม" : "Overall") + `: ${result.overallScore}/100 · ${grade}`,
    "",
    "📊 " + (isTh ? "รายละเอียด" : "Details") + ":",
  ];

  const worstFirst = [...result.scores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
  for (const s of worstFirst) {
    lines.push(
      `• ${t.concerns[s.concern]}: ${t.severity[s.severity]} (${s.score}/100)`,
    );
  }

  lines.push(
    "",
    "✨ " +
      (isTh ? "สินค้าแนะนำสำหรับคุณ" : "Recommended for you") +
      ":",
  );
  for (const pid of result.recommendedProductIds) {
    const p = getProductById(pid);
    if (p) lines.push(`• ${p.name} — ฿${p.price.toLocaleString()}\n  ${p.url}`);
  }

  lines.push(
    "",
    (isTh ? "ดูผลฉบับเต็ม" : "View full result") +
      ": https://medileen.com/result/" +
      resultId,
  );
  return lines.join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    resultId?: string;
    lineUserId?: string;
    locale?: Locale;
  };
  if (!body.resultId) {
    return NextResponse.json({ error: "Missing resultId" }, { status: 400 });
  }

  const locale: Locale = body.locale === "en" ? "en" : "th";
  const message = buildLineMessage(body.resultId, locale);
  if (!message) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn("[LINE] LINE_CHANNEL_ACCESS_TOKEN not set — skipping push");
    return NextResponse.json({ ok: true, preview: message, sent: false });
  }

  const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: body.lineUserId,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!lineRes.ok) {
    const err = await lineRes.text();
    console.error(`[LINE] Push failed ${lineRes.status}:`, err);
    return NextResponse.json(
      { error: "line_push_failed", detail: err },
      { status: 502 },
    );
  }

  console.log("[LINE] Push sent to", body.lineUserId);

  return NextResponse.json({ ok: true, preview: message });
}
