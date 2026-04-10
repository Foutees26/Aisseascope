import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { nauticalMilesBetween, bearingBetween } from '@/lib/marine'

type VesselRow = {
  mmsi: string
  vessel_name: string | null
  latitude: number
  longitude: number
  speed_over_ground: number | null
  course_over_ground: number | null
  destination: string | null
  draught: number | null
  length: number | null
  width: number | null
  timestamp: string
}

type PortTarget = {
  key: 'killybegs' | 'sligo'
  name: string
  latitude: number
  longitude: number
  keywords: string[]
}

type Arrival = {
  mmsi: string
  vesselName: string
  destination: string | null
  eta: string
  speedKnots: number
  distanceNm: number
  draught: number | null
  length: number | null
  beam: number | null
  confidence: 'high' | 'medium'
  sourceTimestamp: string
}

const PORTS: PortTarget[] = [
  {
    key: 'killybegs',
    name: 'Killybegs',
    latitude: 54.633,
    longitude: -8.449,
    keywords: ['killybegs', 'ie killybegs', 'iekbg', 'ie kbg'],
  },
  {
    key: 'sligo',
    name: 'Sligo',
    latitude: 54.267,
    longitude: -8.47,
    keywords: ['sligo', 'ie sligo', 'iesxl', 'ie sxl'],
  },
]

function headingDifference(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function estimateArrival(row: VesselRow, port: PortTarget): { eta: Date; distanceNm: number; confidence: 'high' | 'medium' } | null {
  const speed = Math.max(0, row.speed_over_ground ?? 0)
  const distanceNm = nauticalMilesBetween(row.latitude, row.longitude, port.latitude, port.longitude)
  const destinationText = (row.destination ?? '').toLowerCase()
  const destinationMatch = port.keywords.some((k) => destinationText.includes(k))

  const bearingToPort = bearingBetween(row.latitude, row.longitude, port.latitude, port.longitude)
  const course = row.course_over_ground ?? bearingToPort
  const headingTowardPort = headingDifference(course, bearingToPort) <= 100

  if (!destinationMatch && !(distanceNm <= 60 && headingTowardPort && speed >= 1)) {
    return null
  }

  if (speed < 0.5 && distanceNm > 5) {
    return null
  }

  const now = new Date()
  const hours = speed > 0.5 ? distanceNm / speed : 6
  const eta = new Date(now.getTime() + hours * 60 * 60 * 1000)

  return {
    eta,
    distanceNm,
    confidence: destinationMatch ? 'high' : 'medium',
  }
}

export async function GET(req: NextRequest) {
  const daysParam = Number(req.nextUrl.searchParams.get('days') ?? '7')
  const days = Number.isFinite(daysParam) ? Math.max(7, Math.min(14, daysParam)) : 7

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  let data: unknown[] | null = null
  let error: { message: string } | null = null

  const fullSelect = await supabase
    .from('vessel_positions')
    .select('mmsi, vessel_name, latitude, longitude, speed_over_ground, course_over_ground, destination, draught, length, width, timestamp')
    .order('timestamp', { ascending: false })
    .limit(5000)

  data = (fullSelect.data as unknown[] | null) ?? null
  error = fullSelect.error ? { message: fullSelect.error.message } : null

  // Some deployments may not have optional vessel dimension columns yet.
  if (error && /column .* does not exist/i.test(error.message)) {
    const fallback = await supabase
      .from('vessel_positions')
      .select('mmsi, vessel_name, latitude, longitude, speed_over_ground, course_over_ground, destination, timestamp')
      .order('timestamp', { ascending: false })
      .limit(5000)

    data = (fallback.data as unknown[] | null) ?? null
    error = fallback.error ? { message: fallback.error.message } : null
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as VesselRow[]
  const latestByMmsi = new Map<string, VesselRow>()

  for (const row of rows) {
    if (!latestByMmsi.has(row.mmsi)) {
      latestByMmsi.set(row.mmsi, row)
    }
  }

  const windowEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const byPort: Record<string, Arrival[]> = {
    killybegs: [],
    sligo: [],
  }

  for (const row of latestByMmsi.values()) {
    for (const port of PORTS) {
      const estimate = estimateArrival(row, port)
      if (!estimate) continue
      if (estimate.eta > windowEnd) continue

      byPort[port.key].push({
        mmsi: row.mmsi,
        vesselName: row.vessel_name?.trim() || 'Unknown Vessel',
        destination: row.destination,
        eta: estimate.eta.toISOString(),
        speedKnots: Number((row.speed_over_ground ?? 0).toFixed(1)),
        distanceNm: Number(estimate.distanceNm.toFixed(1)),
        draught: row.draught,
        length: row.length,
        beam: row.width,
        confidence: estimate.confidence,
        sourceTimestamp: row.timestamp,
      })
    }
  }

  byPort.killybegs.sort((a, b) => a.eta.localeCompare(b.eta))
  byPort.sligo.sort((a, b) => a.eta.localeCompare(b.eta))

  return NextResponse.json({
    days,
    generatedAt: new Date().toISOString(),
    ports: {
      killybegs: {
        name: 'Killybegs',
        arrivals: byPort.killybegs,
      },
      sligo: {
        name: 'Sligo',
        arrivals: byPort.sligo,
      },
    },
  })
}
