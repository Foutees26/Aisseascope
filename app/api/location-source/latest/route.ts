import { NextRequest, NextResponse } from 'next/server'

type NormalizedLocation = {
  mmsi: string
  vessel_name: string | null
  latitude: number
  longitude: number
  speed_over_ground: number | null
  course_over_ground: number | null
  true_heading: number | null
  nav_status: string | null
  ship_type: number | null
  destination: string | null
  timestamp: string
  source: string | null
  source_type: string | null
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function toIsoTimestamp(value: unknown): string {
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString()
    }
  }

  const numeric = toNumber(value)
  if (numeric !== null) {
    const millis = numeric > 1e12 ? numeric : numeric * 1000
    const date = new Date(millis)
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString()
    }
  }

  return new Date().toISOString()
}

function normalizeLocation(payload: unknown, mmsi: string): NormalizedLocation | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const obj = payload as Record<string, unknown>
  const lat = toNumber(obj.latitude ?? obj.lat ?? obj.LAT)
  const lng = toNumber(obj.longitude ?? obj.lon ?? obj.lng ?? obj.LON)

  if (lat === null || lng === null) {
    return null
  }

  const speed = toNumber(obj.speed ?? obj.speed_over_ground ?? obj.SPEED)
  const course = toNumber(obj.course ?? obj.course_over_ground ?? obj.COURSE)
  const heading = toNumber(obj.true_heading ?? obj.heading ?? obj.HEADING)

  const vesselNameRaw = obj.vessel_name ?? obj.name ?? obj.SHIPNAME
  const vesselName = typeof vesselNameRaw === 'string' && vesselNameRaw.trim().length > 0 ? vesselNameRaw : null

  const destinationRaw = obj.destination ?? obj.DESTINATION
  const destination = typeof destinationRaw === 'string' && destinationRaw.trim().length > 0 ? destinationRaw : null

  const navStatusRaw = obj.nav_status
  const navStatus = navStatusRaw === null || navStatusRaw === undefined ? null : String(navStatusRaw)

  const shipType = toNumber(obj.ship_type ?? obj.type)

  const sourceRaw = obj.source
  const source = sourceRaw === null || sourceRaw === undefined ? null : String(sourceRaw)

  const sourceTypeRaw = obj.source_type
  const sourceType = sourceTypeRaw === null || sourceTypeRaw === undefined ? null : String(sourceTypeRaw)

  return {
    mmsi,
    vessel_name: vesselName,
    latitude: lat,
    longitude: lng,
    speed_over_ground: speed,
    course_over_ground: course,
    true_heading: heading,
    nav_status: navStatus,
    ship_type: shipType,
    destination,
    timestamp: toIsoTimestamp(obj.timestamp ?? obj.LAST_POS),
    source,
    source_type: sourceType,
  }
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const mmsi = (request.nextUrl.searchParams.get('mmsi') ?? '').trim()
  if (!mmsi) {
    return NextResponse.json({ error: 'Missing mmsi query parameter.' }, { status: 400 })
  }

  const baseUrl = (process.env.POSITION_API_BASE_URL ?? 'http://localhost:5000').replace(/\/+$/, '')
  const candidates = [
    `${baseUrl}/legacy/getLastPosition/${encodeURIComponent(mmsi)}`,
    `${baseUrl}/ais/mt/${encodeURIComponent(mmsi)}/location/latest`,
    `${baseUrl}/ais/vf/${encodeURIComponent(mmsi)}/location/latest`,
  ]

  for (const candidate of candidates) {
    const payload = await fetchJson(candidate)
    if (!payload) {
      continue
    }

    const normalized = normalizeLocation(payload, mmsi)
    if (normalized) {
      return NextResponse.json({ location: normalized })
    }
  }

  return NextResponse.json({ location: null }, { status: 404 })
}
