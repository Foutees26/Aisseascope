'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import TopNav from '@/components/TopNav'
import { supabase } from '@/lib/supabase'

type VesselRecord = {
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
  source?: string | null
  source_type?: string | null
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-700 p-4">
      <p className="mb-1 text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  )
}

export default function VesselInfoPage() {
  const params = useParams<{ mmsi: string }>()
  const mmsi = params?.mmsi ?? ''

  const [records, setRecords] = useState<VesselRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVessel = async () => {
      if (!mmsi) return

      setLoading(true)
      const { data } = await supabase
        .from('vessel_positions')
        .select('mmsi, vessel_name, latitude, longitude, speed_over_ground, course_over_ground, true_heading, nav_status, ship_type, destination, timestamp')
        .eq('mmsi', mmsi)
        .order('timestamp', { ascending: false })
        .limit(25)

      const supabaseRecords = (data ?? []) as VesselRecord[]
      if (supabaseRecords.length > 0) {
        setRecords(supabaseRecords)
        setLoading(false)
        return
      }

      try {
        const fallbackRes = await fetch(`/api/location-source/latest?mmsi=${encodeURIComponent(mmsi)}`, { cache: 'no-store' })
        if (!fallbackRes.ok) {
          setRecords([])
          setLoading(false)
          return
        }

        const payload = (await fallbackRes.json()) as { location?: VesselRecord | null }
        if (payload.location) {
          setRecords([payload.location])
        } else {
          setRecords([])
        }
      } catch {
        setRecords([])
      }

      setLoading(false)
    }

    void fetchVessel()
  }, [mmsi])

  const latest = records[0]

  const formattedUpdated = latest?.timestamp
    ? new Date(latest.timestamp).toLocaleString('en-IE', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '-'

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      <TopNav />

      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/?q=${encodeURIComponent(mmsi)}`} className="text-sm text-slate-400 hover:text-white">
              ← Back to map
            </Link>
            <h1 className="mt-2 text-3xl font-bold">{latest?.vessel_name || 'Unknown Vessel'}</h1>
            <p className="text-slate-400">MMSI: {mmsi}</p>
          </div>
          <Link
            href={`/dashboard?lat=${latest?.latitude ?? 20}&lng=${latest?.longitude ?? 0}`}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Open Marine Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="rounded-xl bg-slate-800 p-6 text-slate-300">Loading vessel information...</div>
        ) : records.length === 0 ? (
          <div className="rounded-xl bg-slate-800 p-6 text-slate-300">No records found for this vessel yet.</div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Last Known Position" value={`${latest.latitude.toFixed(4)}, ${latest.longitude.toFixed(4)}`} />
              <StatCard label="Speed Over Ground" value={`${latest.speed_over_ground ?? '-'} kn`} />
              <StatCard label="Course / Heading" value={`${latest.course_over_ground ?? '-'}° / ${latest.true_heading ?? '-'}°`} />
              <StatCard label="Last Updated" value={formattedUpdated} />
              <StatCard label="Nav Status" value={latest.nav_status ?? '-'} />
              <StatCard label="Ship Type" value={latest.ship_type !== null ? String(latest.ship_type) : '-'} />
              <StatCard label="Destination" value={latest.destination ?? '-'} />
            </div>

            <div className="rounded-xl bg-slate-800 p-6">
              <h2 className="mb-4 text-xl font-semibold">Recent Position History</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Latitude</th>
                      <th className="px-3 py-2">Longitude</th>
                      <th className="px-3 py-2">SOG</th>
                      <th className="px-3 py-2">COG</th>
                      <th className="px-3 py-2">Heading</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row) => (
                      <tr key={`${row.mmsi}-${row.timestamp}`} className="border-t border-slate-700">
                        <td className="px-3 py-2 text-slate-300">
                          {new Date(row.timestamp).toLocaleString('en-IE', {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2">{row.latitude.toFixed(4)}</td>
                        <td className="px-3 py-2">{row.longitude.toFixed(4)}</td>
                        <td className="px-3 py-2">{row.speed_over_ground ?? '-'}</td>
                        <td className="px-3 py-2">{row.course_over_ground ?? '-'}</td>
                        <td className="px-3 py-2">{row.true_heading ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
