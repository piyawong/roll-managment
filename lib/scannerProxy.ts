import { NextResponse } from "next/server";

export async function handleScan(scannerId: number) {
  const port = 9060 + scannerId;

  try {
    const res = await fetch(`http://localhost:${port}/scan`, {
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

export async function handleHealth(scannerId: number) {
  const port = 9060 + scannerId;

  try {
    const res = await fetch(`http://localhost:${port}/status`, {
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
