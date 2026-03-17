import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const results: string[] = [];
    
    try {
        const url = 'http://localhost:5248/api/watch';
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
        const data = await res.json();
        
        const gfWatches = Array.isArray(data) ? data.filter(w => w.brandId === 8) : [];
        
        results.push(`Found ${gfWatches.length} GF watches.`);
        return NextResponse.json({ success: true, results, watches: gfWatches });
    } catch (e: any) {
        results.push('Error: ' + e.message);
        return NextResponse.json({ success: false, results });
    }
}
