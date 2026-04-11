/**
 * Next.js API proxy — forwards all /api/* requests to the backend
 * This avoids the conflict between Next.js /api routes and nginx proxying
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3661';

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    return proxy(request, params.path, 'GET');
}

export async function POST(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    return proxy(request, params.path, 'POST');
}

async function proxy(
    request: NextRequest,
    pathSegments: string[],
    method: string
): Promise<NextResponse> {
    const path = pathSegments.join('/');
    const search = request.nextUrl.search || '';
    const url = `${BACKEND_URL}/${path}${search}`;

    try {
        const body = method === 'POST' ? await request.text() : undefined;
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body,
            // Don't cache — always fresh data
            cache: 'no-store',
        });

        const data = await res.text();
        return new NextResponse(data, {
            status: res.status,
            headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
        });
    } catch (err) {
        console.error(`[Proxy] ${method} /${path} failed:`, err);
        return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
    }
}
