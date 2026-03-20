// Proxies the ai-service /ready check so the frontend doesn't need to know the internal URL
import { NextResponse } from 'next/server';

const AI_SERVICE_URL = process.env.AI_SERVICE_INTERNAL_URL || 'http://localhost:5000';

export async function GET() {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/ready`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ready: false, message: 'AI service unreachable' }, { status: 503 });
  }
}
