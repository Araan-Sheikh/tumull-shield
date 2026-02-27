// Next.js API Route Example
// File: app/api/hello/route.ts

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Hello from a rate-limited API!',
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: Request) {
  const body = await request.json()

  return NextResponse.json({
    message: 'Received!',
    data: body,
    timestamp: new Date().toISOString(),
  })
}
