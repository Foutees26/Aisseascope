import { NextRequest, NextResponse } from 'next/server'

type AlertFeature = {
  id: string
  properties?: {
    event?: string
    severity?: string
    areaDesc?: string
    sent?: string
    senderName?: string
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 })
  }

  const url = `https://api.weather.gov/alerts/active?point=${lat},${lng}`

  const res = await fetch(url, {
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'seascope/0.1',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ warnings: [] })
  }

  const data = (await res.json()) as { features?: AlertFeature[] }
  const features = data.features ?? []

  const warnings = features.slice(0, 8).map((f) => ({
    id: f.id,
    title: f.properties?.event ?? 'Marine warning',
    severity: f.properties?.severity ?? 'Unknown',
    area: f.properties?.areaDesc ?? 'Unknown area',
    sent: f.properties?.sent ?? '',
    source: f.properties?.senderName ?? 'NOAA/NWS',
    url: `https://api.weather.gov/alerts/${f.id}`,
  }))

  return NextResponse.json({ warnings })
}
