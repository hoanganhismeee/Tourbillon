import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: Request) {
    const results: string[] = [];

    try {
        const url = `${process.env.BACKEND_INTERNAL_URL || 'http://localhost:5248/api'}/watch`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
        const data = await res.json();
        
        const gfWatches = Array.isArray(data) ? data.filter(w => w.brandId === 8) : [];
        
        results.push(`Found ${gfWatches.length} GF watches.`);
        return NextResponse.json({ success: true, results, watches: gfWatches });
    } catch (e: unknown) {
        results.push('Error: ' + (e instanceof Error ? e.message : String(e)));
        return NextResponse.json({ success: false, results });
    }
}
