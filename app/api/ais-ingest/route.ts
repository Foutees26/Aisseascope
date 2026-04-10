import { createClient } from '@supabase/supabase-js'
import WS from 'ws'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DemoVessel = {
  mmsi: string
  vessel_name: string
  latitude: number
  longitude: number
  speed_over_ground: number
  course_over_ground: number
  true_heading: number
}

type IngestState = {
  ws: WS | null
  shouldRun: boolean
  running: boolean
  received: number
  inserted: number
  lastError: string | null
  noDataTimer: ReturnType<typeof setTimeout> | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  connectAttempts: number
  lastOpenAt: string | null
  lastMessageAt: string | null
  closeCode: number | null
  closeReason: string | null
  demoMode: boolean
  demoTimer: ReturnType<typeof setInterval> | null
  demoVessels: DemoVessel[]
}

const globalForIngest = globalThis as typeof globalThis & {
  __aisIngestState?: IngestState
}

const ingestState: IngestState =
  globalForIngest.__aisIngestState ?? {
    ws: null,
    shouldRun: false,
    running: false,
    received: 0,
    inserted: 0,
    lastError: null,
    noDataTimer: null,
    reconnectTimer: null,
    connectAttempts: 0,
    lastOpenAt: null,
    lastMessageAt: null,
    closeCode: null,
    closeReason: null,
    demoMode: false,
    demoTimer: null,
    demoVessels: [],
  }

if (typeof ingestState.demoMode === 'undefined') {
  ingestState.demoMode = false
}
if (typeof ingestState.demoTimer === 'undefined') {
  ingestState.demoTimer = null
}
if (typeof ingestState.shouldRun === 'undefined') {
  ingestState.shouldRun = false
}
if (typeof ingestState.reconnectTimer === 'undefined') {
  ingestState.reconnectTimer = null
}
if (typeof ingestState.connectAttempts === 'undefined') {
  ingestState.connectAttempts = 0
}
if (typeof ingestState.lastOpenAt === 'undefined') {
  ingestState.lastOpenAt = null
}
if (typeof ingestState.lastMessageAt === 'undefined') {
  ingestState.lastMessageAt = null
}
if (typeof ingestState.closeCode === 'undefined') {
  ingestState.closeCode = null
}
if (typeof ingestState.closeReason === 'undefined') {
  ingestState.closeReason = null
}
if (!Array.isArray(ingestState.demoVessels)) {
  ingestState.demoVessels = []
}

globalForIngest.__aisIngestState = ingestState

function createInitialDemoFleet(): DemoVessel[] {
  return [
    { mmsi: '901000000', vessel_name: 'DEMO KILLYBEGS PILOT', latitude: 55.16, longitude: -8.63, speed_over_ground: 8.6, course_over_ground: 140, true_heading: 140 },
    { mmsi: '901000001', vessel_name: 'DEMO PACIFIC STAR', latitude: 37.7749, longitude: -122.4194, speed_over_ground: 14.2, course_over_ground: 240, true_heading: 240 },
    { mmsi: '901000002', vessel_name: 'DEMO ATLANTIC RUNNER', latitude: 40.7128, longitude: -74.006, speed_over_ground: 12.1, course_over_ground: 120, true_heading: 120 },
    { mmsi: '901000003', vessel_name: 'DEMO MEDITERRANEAN WIND', latitude: 36.1408, longitude: -5.3536, speed_over_ground: 10.3, course_over_ground: 85, true_heading: 85 },
    { mmsi: '901000004', vessel_name: 'DEMO SUEZ TRANSIT', latitude: 30.0444, longitude: 32.5599, speed_over_ground: 11.5, course_over_ground: 160, true_heading: 160 },
    { mmsi: '901000005', vessel_name: 'DEMO INDIAN OCEAN', latitude: 12.9716, longitude: 80.0, speed_over_ground: 13.0, course_over_ground: 200, true_heading: 200 },
    { mmsi: '901000006', vessel_name: 'DEMO SINGAPORE LINK', latitude: 1.2644, longitude: 103.8223, speed_over_ground: 9.4, course_over_ground: 45, true_heading: 45 },
    { mmsi: '901000007', vessel_name: 'DEMO TOKYO EXPRESS', latitude: 35.6762, longitude: 139.6503, speed_over_ground: 15.2, course_over_ground: 210, true_heading: 210 },
    { mmsi: '901000008', vessel_name: 'DEMO CAPE ROUTE', latitude: -33.9249, longitude: 18.4241, speed_over_ground: 12.7, course_over_ground: 310, true_heading: 310 },
  ]
}

function wrapLongitude(longitude: number): number {
  if (longitude > 180) return longitude - 360
  if (longitude < -180) return longitude + 360
  return longitude
}

function clampLatitude(latitude: number): number {
  if (latitude > 85) return 85
  if (latitude < -85) return -85
  return latitude
}

function advanceDemoFleet() {
  ingestState.demoVessels = ingestState.demoVessels.map((vessel) => {
    const distanceDegrees = vessel.speed_over_ground * 0.003
    const radians = (vessel.course_over_ground * Math.PI) / 180
    const nextLatitude = clampLatitude(vessel.latitude + Math.cos(radians) * distanceDegrees)
    const nextLongitude = wrapLongitude(vessel.longitude + Math.sin(radians) * distanceDegrees)

    return {
      ...vessel,
      latitude: Number(nextLatitude.toFixed(6)),
      longitude: Number(nextLongitude.toFixed(6)),
    }
  })
}

async function insertDemoFleet() {
  const rows = ingestState.demoVessels.map((vessel) => ({
    mmsi: vessel.mmsi,
    vessel_name: vessel.vessel_name,
    latitude: vessel.latitude,
    longitude: vessel.longitude,
    speed_over_ground: vessel.speed_over_ground,
    course_over_ground: vessel.course_over_ground,
    true_heading: vessel.true_heading,
    nav_status: '0',
    ship_type: null,
    destination: 'DEMO MODE',
  }))

  const { error } = await supabase.from('vessel_positions').insert(rows)
  if (error) {
    ingestState.lastError = `Demo insert failed: ${error.message}`
    console.error('Demo insert error:', error)
    return
  }

  ingestState.inserted += rows.length
}

function startDemoTraffic() {
  if (ingestState.demoTimer) {
    return
  }

  if (ingestState.demoVessels.length === 0) {
    ingestState.demoVessels = createInitialDemoFleet()
  }

  ingestState.demoMode = true
  void insertDemoFleet()

  ingestState.demoTimer = setInterval(() => {
    advanceDemoFleet()
    void insertDemoFleet()
  }, 5000)
}

function startIngest() {
  ingestState.shouldRun = true

  if (ingestState.running) {
    return
  }

  if (ingestState.reconnectTimer) {
    clearTimeout(ingestState.reconnectTimer)
    ingestState.reconnectTimer = null
  }

  const ws = new WS('wss://stream.aisstream.io/v0/stream')
  ingestState.ws = ws
  ingestState.running = true
  ingestState.lastError = null
  ingestState.connectAttempts += 1

  const receivedAtConnect = ingestState.received

  if (ingestState.noDataTimer) {
    clearTimeout(ingestState.noDataTimer)
    ingestState.noDataTimer = null
  }

  ws.on('open', () => {
    ingestState.lastOpenAt = new Date().toISOString()
    ingestState.closeCode = null
    ingestState.closeReason = null

    ws.send(JSON.stringify({
      APIKey: process.env.AISSTREAM_API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
    }))
  })

  ws.on('message', async (data) => {
    try {
      ingestState.received += 1
      ingestState.lastMessageAt = new Date().toISOString()

      if (ingestState.demoTimer) {
        clearInterval(ingestState.demoTimer)
        ingestState.demoTimer = null
      }
      ingestState.demoMode = false

      if (ingestState.noDataTimer) {
        clearTimeout(ingestState.noDataTimer)
        ingestState.noDataTimer = null
      }

      const msg = JSON.parse(data.toString())
      const meta = msg.MetaData
      const pos =
        msg.Message?.PositionReport ??
        msg.Message?.StandardClassBPositionReport ??
        msg.Message?.ExtendedClassBPositionReport

      if (!pos || !meta) return

      const latitude = meta.latitude ?? meta.Latitude ?? pos.Latitude ?? null
      const longitude = meta.longitude ?? meta.Longitude ?? pos.Longitude ?? null

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return
      }

      const { error } = await supabase.from('vessel_positions').insert({
        mmsi: String(meta.MMSI),
        vessel_name: meta.ShipName?.trim() || null,
        latitude,
        longitude,
        speed_over_ground: typeof pos.Sog === 'number' ? pos.Sog : null,
        course_over_ground: typeof pos.Cog === 'number' ? pos.Cog : null,
        true_heading: typeof pos.TrueHeading === 'number' ? pos.TrueHeading : null,
        nav_status: pos.NavigationalStatus !== undefined ? String(pos.NavigationalStatus) : null,
        ship_type: typeof meta.ShipType === 'number' ? meta.ShipType : null,
        destination: typeof meta.Destination === 'string' ? meta.Destination.trim() || null : null,
      })

      if (error) {
        ingestState.lastError = error.message
        console.error('AIS insert error:', error)
        return
      }

      ingestState.inserted += 1
    } catch (e) {
      ingestState.lastError = e instanceof Error ? e.message : 'Unknown parse error'
      console.error('AIS parse error:', e)
    }
  })

  // Start no-data timer after open
  ws.once('open', () => {
    ingestState.noDataTimer = setTimeout(() => {
      if (ingestState.received === receivedAtConnect) {
        ingestState.lastError = 'Connected to AISStream but received 0 messages after 20s. Check API key validity or AISStream account limits.'
        startDemoTraffic()
      }
    }, 20000)
  })

  ws.on('error', (err) => {
    ingestState.lastError = `WebSocket error: ${err.message}`
    console.error('WebSocket error:', err.message)
  })

  ws.on('close', (code, reason) => {
    if (ingestState.noDataTimer) {
      clearTimeout(ingestState.noDataTimer)
      ingestState.noDataTimer = null
    }

    ingestState.running = false
    ingestState.ws = null
    ingestState.closeCode = code
    ingestState.closeReason = reason.toString()

    if (ingestState.shouldRun && !ingestState.reconnectTimer) {
      ingestState.reconnectTimer = setTimeout(() => {
        ingestState.reconnectTimer = null
        startIngest()
      }, 2000)
    }
  })
}

export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.AISSTREAM_API_KEY) {
    return Response.json({ error: 'Missing environment variables for Supabase or AISStream.' }, { status: 500 })
  }

  const url = new URL(req.url)
  if (url.searchParams.get('demo') === 'off') {
    if (ingestState.demoTimer) {
      clearInterval(ingestState.demoTimer)
      ingestState.demoTimer = null
    }
    ingestState.demoMode = false
    ingestState.lastError = null
  }

  if (url.searchParams.get('demo') === 'on') {
    startDemoTraffic()
    ingestState.lastError = ingestState.lastError ?? 'Demo mode enabled manually.'
  }

  startIngest()

  return Response.json({
    status: ingestState.running ? 'running' : 'starting',
    received: ingestState.received,
    inserted: ingestState.inserted,
    lastError: ingestState.lastError,
    connectAttempts: ingestState.connectAttempts,
    lastOpenAt: ingestState.lastOpenAt,
    lastMessageAt: ingestState.lastMessageAt,
    closeCode: ingestState.closeCode,
    closeReason: ingestState.closeReason,
    demoMode: ingestState.demoMode,
    demoCount: ingestState.demoVessels.length,
  })
}
