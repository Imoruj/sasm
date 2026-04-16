import { NextResponse } from "next/server";
import { err } from "@/types/api";

// This endpoint has been superseded by POST /api/uploads (FormData-based server-side upload).
export async function POST() {
  return NextResponse.json(
    err("GONE", "This endpoint is deprecated. Use POST /api/uploads with FormData instead."),
    { status: 410 },
  );
}
