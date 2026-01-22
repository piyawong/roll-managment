import { NextResponse } from "next/server";

export async function POST() {
  try {
    const res = await fetch("http://localhost:9064/scan", {
      method: "POST",
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ success: true }));
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: "Scan failed" }, { status: res.status });
    }
  } catch {
    return NextResponse.json({ error: "Scanner not available" }, { status: 503 });
  }
}
