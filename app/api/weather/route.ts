import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 })
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&hourly=wind_speed_10m,wind_direction_10m&forecast_days=1`
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period,wave_direction,wind_wave_height&forecast_days=2`

  const [weatherRes, marineRes] = await Promise.all([
    fetch(weatherUrl, { cache: 'no-store' }),
    fetch(marineUrl, { cache: 'no-store' }),
  ])

  const [weather, marine] = await Promise.all([
    weatherRes.json(),
    marineRes.json(),
  ])

  return NextResponse.json({ weather, marine })
}
