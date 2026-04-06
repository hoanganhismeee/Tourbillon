// Catch-all reverse proxy — forwards /api/backend/* to the .NET backend.
// Allows the entire app to be shared via a single ngrok tunnel on port 3000;
// all backend traffic is relayed server-side so visitors never need direct access to port 5248.
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:5248/api';

// Headers that must not be forwarded to the upstream backend
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'proxy-authorization',
  'proxy-authenticate',
  'upgrade',
  'content-length', // recalculated by fetch
]);

function buildUpstreamHeaders(req: NextRequest): HeadersInit {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers[key] = value;
    }
  });
  return headers;
}

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const upstream = `${BACKEND}/${path.join('/')}${req.nextUrl.search}`;

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  const upstreamRes = await fetch(upstream, {
    method: req.method,
    headers: buildUpstreamHeaders(req),
    body: hasBody ? req.body : undefined,
    // Required for streaming request bodies in Node.js fetch
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);

  // Forward the response — preserve status, headers (including Set-Cookie for auth), and body
  const resHeaders = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      resHeaders.append(key, value);
    }
  });

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
