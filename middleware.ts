import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS = 60_000
const LIMIT = 10

type Bucket = {
  count: number
  resetAt: number
}

const requestsByIp = new Map<string, Bucket>()

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }

  return request.headers.get('x-real-ip') ?? 'unknown'
}

export function middleware(request: NextRequest) {
  const ip = getClientIp(request)
  const now = Date.now()
  const bucket = requestsByIp.get(ip)

  if (!bucket || now >= bucket.resetAt) {
    requestsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return NextResponse.next()
  }

  if (bucket.count >= LIMIT) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  bucket.count += 1
  requestsByIp.set(ip, bucket)

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/generate'],
}
