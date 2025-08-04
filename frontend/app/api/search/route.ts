// Next.js API route to proxy search requests to the backend
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:5248/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({
        watches: [],
        brands: [],
        collections: [],
        totalResults: 0,
        suggestions: []
      });
    }
    
    const backendUrl = `${BACKEND_URL}/search?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search service unavailable' },
      { status: 500 }
    );
  }
} 