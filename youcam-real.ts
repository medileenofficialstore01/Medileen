/**
 * Perfect Corp / YouCam Skin Analysis API
 * Docs: https://yce.perfectcorp.com/
 *
 * Flow:
 *  1. Sign JWT with RSA private key (API_SECRET is a base64-encoded public key;
 *     for server-side signing we use the API_KEY as the bearer secret directly
 *     as Perfect Corp's REST endpoint accepts Bearer token auth).
 *  2. POST image to /v1/skin-analysis
 *  3. Map response attributes → SkinScore[]
 */

import type { SkinConcern, SkinScore } from "./types";
import { generateMockAnalysis } from "./youcam-mock";

// Perfect Corp attribute names → our SkinConcern keys
const ATTR_MAP: Record<string, SkinConcern> = {
  acne: "acne",
  wrinkle: "wrinkles",
  dark_spot: "darkSpots",
  moisture: "dryness",     // low moisture → high dryness score (inverted below)
  oily: "oiliness",
  pore: "pores",
  redness: "redness",
  radiance: "dullness",    // low radiance → high dullness (inverted below)
};

// Attributes where the API score is "good = high", so we invert to our scale
const INVERT = new Set(["moisture", "radiance"]);

function severityFromScore(score: number): SkinScore["severity"] {
  if (score >= 70) return "low";
  if (score >= 45) return "moderate";
  return "high";
}

interface PerfectCorpResponse {
  result?: {
    attributes?: Record<string, { score: number }>;
  };
  error?: { message: string };
}

export async function analyzeWithYouCam(imageDataUrl: string): Promise<{
  scores: SkinScore[];
  overallScore: number;
  topConcerns: SkinConcern[];
}> {
  const apiKey = process.env.PERFECT_CORP_API_KEY;

  // Fallback to mock if key is missing (dev / CI)
  if (!apiKey) {
    console.warn("[YouCam] PERFECT_CORP_API_KEY not set — using mock");
    return generateMockAnalysis("no-key");
  }

  // Strip data URL prefix → raw base64
  const base64Image = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");

  let res: Response;
  try {
    res = await fetch("https://api.perfectcorp.com/s2s/v1.0/image/task/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        task_type: 3000, // Skin Analysis task type
        check_list: [1, 2, 3, 4, 5, 6, 7, 8], // all 8 skin attributes
        image: base64Image,
      }),
    });
  } catch (err) {
    console.error("[YouCam] Network error:", err);
    console.warn("[YouCam] Falling back to mock");
    return generateMockAnalysis("network-error");
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[YouCam] API error ${res.status}:`, text);
    console.warn("[YouCam] Falling back to mock");
    return generateMockAnalysis("api-error");
  }

  const data = (await res.json()) as PerfectCorpResponse;

  if (data.error || !data.result?.attributes) {
    console.error("[YouCam] Bad response shape:", JSON.stringify(data));
    console.warn("[YouCam] Falling back to mock");
    return generateMockAnalysis("bad-response");
  }

  const attrs = data.result.attributes;
  const scores: SkinScore[] = [];

  for (const [apiKey2, concern] of Object.entries(ATTR_MAP)) {
    const raw = attrs[apiKey2]?.score ?? 50;
    // Perfect Corp returns 0–100; invert if needed
    const score = INVERT.has(apiKey2) ? 100 - raw : raw;
    scores.push({ concern, score, severity: severityFromScore(score) });
  }

  const overallScore = Math.round(
    scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
  );

  const topConcerns = [...scores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((s) => s.concern);

  return { scores, overallScore, topConcerns };
}
