import { NextResponse } from "next/server";
import { analyzeWithYouCam } from "@/lib/youcam-real";
import { recommendProducts } from "@/lib/recommender";
import { saveResult, getQuotaStatus } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import type { SkinAnalysisResult } from "@/lib/types";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const quota = getQuotaStatus(user.lineUserId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        nextAvailableAt: quota.nextAvailableAt?.toISOString(),
        daysRemaining: quota.daysRemaining,
      },
      { status: 429 },
    );
  }

  const body = (await request.json()) as { imageDataUrl?: string };
  if (!body.imageDataUrl) {
    return NextResponse.json({ error: "Missing imageDataUrl" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const { scores, overallScore, topConcerns } = await analyzeWithYouCam(body.imageDataUrl);
  const recommendedProducts = recommendProducts(scores, 3);

  const result: SkinAnalysisResult = {
    id,
    lineUserId: user.lineUserId,
    createdAt: new Date().toISOString(),
    imageDataUrl: body.imageDataUrl,
    overallScore,
    scores,
    topConcerns,
    recommendedProductIds: recommendedProducts.map((p) => p.id),
  };

  saveResult(result);

  return NextResponse.json({ id });
}
