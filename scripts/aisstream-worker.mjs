import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import WebSocket from 'ws'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const aisApiKey = process.env.AISSTREAM_API_KEY

if (!supabaseUrl || !supabaseAnonKey || !aisApiKey) {
  console.error('[AIS Worker] Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or AISSTREAM_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

let ws = null
let reconnectTimer = null
let received = 0
let inserted = 0

function connect() {
  if (ws) {
    return
  }

  ws = new WebSocket('wss://stream.aisstream.io/v0/stream')

  ws.on('open', () => {
    console.log('[AIS Worker] Connected to AISStream')

    ws.send(
      JSON.stringify({
        APIKey: aisApiKey,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
      })
    )
  })

  ws.on('message', async (raw) => {
    received += 1

    try {
      const msg = JSON.parse(raw.toString())
      const meta = msg.MetaData
      const pos = msg.Message?.PositionReport ?? msg.Message?.StandardClassBPositionReport ?? msg.Message?.ExtendedClassBPositionReport

      if (!meta || !pos) {
        return
      }

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
        console.error('[AIS Worker] Insert error:', error.message)
        return
      }

      inserted += 1
      if (inserted % 25 === 0) {
        console.log(`[AIS Worker] received=${received} inserted=${inserted}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse/insert error'
      console.error('[AIS Worker] Message handling error:', message)
    }
  })

  ws.on('error', (err) => {
    console.error('[AIS Worker] WebSocket error:', err.message)
  })

  ws.on('close', (code, reason) => {
    console.warn(`[AIS Worker] Closed code=${code} reason=${reason.toString()}`)
    ws = null

    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, 2000)
    }
  })
}

connect()
