import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("http://localhost:9069/status", {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ status: "error" }, { status: res.status });
    }
  } catch {
    return NextResponse.json({ status: "offline" }, { status: 503 });
  }
}
