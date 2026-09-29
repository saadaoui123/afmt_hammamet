import { NextResponse } from "next/server";
import { loadDb } from "@/server/load";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadDb();
  if (!data) return NextResponse.json({ empty: true });
  return NextResponse.json(data);
}
