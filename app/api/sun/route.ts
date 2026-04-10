import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 })
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=sunrise,sunset&timezone=auto&forecast_days=1`
  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    return NextResponse.json({ error: 'Sun data provider unavailable' }, { status: 502 })
  }

  const data = await res.json()
  const sunrise = data?.daily?.sunrise?.[0] ?? null
  const sunset = data?.daily?.sunset?.[0] ?? null

  return NextResponse.json({ sunrise, sunset })
}