import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 })
  }

  if (!process.env.WORLDTIDES_API_KEY) {
    return NextResponse.json({ error: 'Missing WORLDTIDES_API_KEY' }, { status: 500 })
  }

  const url = `https://www.worldtides.info/api/v3?heights&extremes&lat=${lat}&lon=${lng}&days=2&step=900&key=${process.env.WORLDTIDES_API_KEY}`

  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()

  return NextResponse.json(data)
}
