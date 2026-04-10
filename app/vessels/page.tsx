'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import TopNav from '@/components/TopNav'
import { supabase } from '@/lib/supabase'

type VesselRow = {
  mmsi: string
  vessel_name: string | null
  latitude: number
  longitude: number
  speed_over_ground: number | null
  nav_status: string | null
  timestamp: string
}

export default function VesselsPage() {
  const [watchlist] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const raw = localStorage.getItem('watchlist-mmsi')
      if (!raw) return []
      const parsed = JSON.parse(raw) as string[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [rows, setRows] = useState<VesselRow[]>([])
  const [loading, setLoading] = useState(watchlist.length > 0)

  useEffect(() => {
    const loadWatchlistVessels = async () => {
      if (watchlist.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      setLoading(true)

      const { data } = await supabase
        .from('vessel_positions')
        .select('mmsi, vessel_name, latitude, longitude, speed_over_ground, nav_status, timestamp')
        .in('mmsi', watchlist)
        .order('timestamp', { ascending: false })
        .limit(1000)

      if (!data) {
        setRows([])
        setLoading(false)
        return
      }

      const seen = new Set<string>()
      const latestOnly = (data as VesselRow[]).filter((row) => {
        if (seen.has(row.mmsi)) return false
        seen.add(row.mmsi)
        return true
      })

      setRows(latestOnly)
      setLoading(false)
    }

    void loadWatchlistVessels()
  }, [watchlist])

  const missingMmsi = useMemo(() => {
    const present = new Set(rows.map((r) => r.mmsi))
    return watchlist.filter((m) => !present.has(m))
  }, [rows, watchlist])

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <TopNav />

      <section className="mx-auto w-full max-w-6xl p-6">
        <h1 className="text-2xl font-bold">Watchlist Vessels</h1>
        <p className="mt-1 text-sm text-slate-400">Your favourited vessels from the map watchlist.</p>

        {loading && <p className="mt-6 text-slate-300">Loading watchlist...</p>}

        {!loading && watchlist.length === 0 && (
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-300">
            No watchlisted vessels yet. Add vessels from the map detail panel.
          </div>
        )}

        {!loading && watchlist.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">Tracked ({rows.length})</h2>

              {rows.length === 0 ? (
                <p className="text-sm text-slate-400">No recent position records yet for watchlisted MMSIs.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Vessel</th>
                        <th className="px-3 py-2">MMSI</th>
                        <th className="px-3 py-2">Position</th>
                        <th className="px-3 py-2">Speed</th>
                        <th className="px-3 py-2">Updated</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.mmsi} className="border-t border-slate-700">
                          <td className="px-3 py-2 text-slate-100">{row.vessel_name?.trim() || 'Unknown Vessel'}</td>
                          <td className="px-3 py-2 text-slate-300">{row.mmsi}</td>
                          <td className="px-3 py-2 text-slate-300">{row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}</td>
                          <td className="px-3 py-2 text-slate-300">{row.speed_over_ground ?? '-'} kn</td>
                          <td className="px-3 py-2 text-slate-300">{new Date(row.timestamp).toLocaleString('en-IE')}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <Link href={`/?q=${encodeURIComponent(row.mmsi)}`} className="rounded bg-cyan-700 px-2 py-1 text-xs font-semibold text-white hover:bg-cyan-600">
                                Show on Map
                              </Link>
                              <Link href={`/vessel/${row.mmsi}`} className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-600">
                                Profile
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {missingMmsi.length > 0 && (
              <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-amber-100">
                <p className="font-medium">Watchlisted but no recent records:</p>
                <p className="mt-1 text-sm">{missingMmsi.join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
