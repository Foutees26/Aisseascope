import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type VesselRow = {
  mmsi: string
  vessel_name: string | null
  timestamp: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()

  if (!q) {
    return NextResponse.json({ suggestions: [] })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Missing Supabase environment variables.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase
    .from('vessel_positions')
    .select('mmsi, vessel_name, timestamp')
    .order('timestamp', { ascending: false })
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as VesselRow[]
  const seen = new Set<string>()
  const suggestions: Array<{ mmsi: string; vessel_name: string | null }> = []

  for (const row of rows) {
    if (seen.has(row.mmsi)) continue

    const name = (row.vessel_name ?? '').toLowerCase()
    if (!row.mmsi.toLowerCase().includes(q) && !name.includes(q)) {
      continue
    }

    seen.add(row.mmsi)
    suggestions.push({ mmsi: row.mmsi, vessel_name: row.vessel_name })

    if (suggestions.length >= 5) {
      break
    }
  }

  return NextResponse.json({ suggestions })
}
