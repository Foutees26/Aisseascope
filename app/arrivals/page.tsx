'use client'

import { Suspense, useEffect, useState } from 'react'
import TopNav from '@/components/TopNav'

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

type ArrivalsResponse = {
  days: number
  generatedAt: string
  ports: {
    killybegs: { name: string; arrivals: Arrival[] }
    sligo: { name: string; arrivals: Arrival[] }
  }
}

function ArrivalTable({ arrivals }: { arrivals: Arrival[] }) {
  if (arrivals.length === 0) {
    return <p className="text-sm text-slate-400">No projected arrivals currently found in the next 7 days.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="px-3 py-2">Vessel</th>
            <th className="px-3 py-2">MMSI</th>
            <th className="px-3 py-2">ETA</th>
            <th className="px-3 py-2">Distance</th>
            <th className="px-3 py-2">Speed</th>
            <th className="px-3 py-2">Draught</th>
            <th className="px-3 py-2">LOA / Beam</th>
            <th className="px-3 py-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {arrivals.map((item) => (
            <tr key={`${item.mmsi}-${item.eta}`} className="border-t border-slate-700">
              <td className="px-3 py-2 text-slate-100">{item.vesselName}</td>
              <td className="px-3 py-2 text-slate-300">{item.mmsi}</td>
              <td className="px-3 py-2 text-slate-100">{new Date(item.eta).toLocaleString('en-IE')}</td>
              <td className="px-3 py-2 text-slate-300">{item.distanceNm} nm</td>
              <td className="px-3 py-2 text-slate-300">{item.speedKnots} kn</td>
              <td className="px-3 py-2 text-slate-300">{item.draught !== null ? `${item.draught} m` : '-'}</td>
              <td className="px-3 py-2 text-slate-300">{item.length !== null ? `${item.length} m` : '-'} / {item.beam !== null ? `${item.beam} m` : '-'}</td>
              <td className="px-3 py-2">
                <span className={item.confidence === 'high' ? 'rounded bg-emerald-700/60 px-2 py-0.5 text-emerald-100' : 'rounded bg-amber-700/60 px-2 py-0.5 text-amber-100'}>
                  {item.confidence}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ArrivalsPage() {
  const [data, setData] = useState<ArrivalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/arrivals?days=7', { cache: 'no-store' })
        if (!res.ok) {
          throw new Error('Failed to load arrivals')
        }
        const json = (await res.json()) as ArrivalsResponse
        setData(json)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load arrivals')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <Suspense fallback={<div className="h-14 border-b border-slate-800 bg-slate-900" />}>
        <TopNav />
      </Suspense>

      <section className="mx-auto w-full max-w-6xl p-6">
        <h1 className="text-2xl font-bold">Projected Arrivals (Next 7 Days)</h1>
        <p className="mt-1 text-sm text-slate-400">Ports: Killybegs and Sligo</p>

        {loading && <p className="mt-6 text-slate-300">Loading arrivals...</p>}
        {error && <p className="mt-6 text-red-300">{error}</p>}

        {!loading && !error && data && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">{data.ports.killybegs.name}</h2>
              <ArrivalTable arrivals={data.ports.killybegs.arrivals} />
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">{data.ports.sligo.name}</h2>
              <ArrivalTable arrivals={data.ports.sligo.arrivals} />
            </div>

            <p className="text-xs text-slate-500">Generated: {new Date(data.generatedAt).toLocaleString('en-IE')}</p>
          </div>
        )}
      </section>
    </main>
  )
}
