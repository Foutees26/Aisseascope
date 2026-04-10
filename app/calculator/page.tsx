'use client'

import { useEffect, useMemo, useState } from 'react'
import TopNav from '@/components/TopNav'
import { PILOT_PORTS } from '@/lib/marine'

type WeatherPayload = {
  weather?: {
    current?: {
      temperature_2m?: number
      wind_speed_10m?: number
      wind_direction_10m?: number
      surface_pressure?: number
    }
  }
}

type TidePayload = {
  heights?: Array<{ dt: number; height: number }>
}

export default function CalculatorPage() {
  const [portKey, setPortKey] = useState<'killybegs' | 'sligo'>('killybegs')
  const [depth, setDepth] = useState('')
  const [draught, setDraught] = useState('')
  const [weather, setWeather] = useState<WeatherPayload | null>(null)
  const [tides, setTides] = useState<TidePayload | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedPort = useMemo(
    () => PILOT_PORTS.find((p) => p.key === portKey) ?? PILOT_PORTS[0],
    [portKey]
  )

  useEffect(() => {
    setDepth(selectedPort.chartedDepthMeters.toFixed(1))
  }, [selectedPort])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [wxRes, tideRes] = await Promise.all([
          fetch(`/api/weather?lat=${selectedPort.boardingLatitude}&lng=${selectedPort.boardingLongitude}`),
          fetch(`/api/tides?lat=${selectedPort.boardingLatitude}&lng=${selectedPort.boardingLongitude}`),
        ])

        const wx = (await wxRes.json()) as WeatherPayload
        const tide = (await tideRes.json()) as TidePayload

        setWeather(wx)
        setTides(tide)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [selectedPort])

  const tideNow = useMemo(() => {
    const first = tides?.heights?.[0]
    return typeof first?.height === 'number' ? first.height : null
  }, [tides])

  const ukc = useMemo(() => {
    const d = Number(depth)
    const dr = Number(draught)
    if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(dr) || dr <= 0) {
      return null
    }
    return d + (tideNow ?? 0) - dr
  }, [depth, draught, tideNow])

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <TopNav />

      <section className="mx-auto w-full max-w-5xl p-6">
        <h1 className="text-2xl font-bold">Under Keel Clearance Calculator</h1>
        <p className="mt-1 text-sm text-slate-400">Pilotage planning with live tide and weather at pilot boarding positions.</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-semibold">Inputs</h2>

            <label className="mb-1 block text-sm text-slate-300">Port</label>
            <select
              value={portKey}
              onChange={(e) => setPortKey(e.target.value as 'killybegs' | 'sligo')}
              className="mb-3 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            >
              {PILOT_PORTS.map((port) => (
                <option key={port.key} value={port.key}>{port.name}</option>
              ))}
            </select>

            <p className="mb-3 text-xs text-slate-400">
              Boarding position: {selectedPort.boardingLatitude.toFixed(4)}, {selectedPort.boardingLongitude.toFixed(4)}
            </p>

            <label className="mb-1 block text-sm text-slate-300">Port charted depth (m)</label>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              className="mb-3 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-sm text-slate-300">Vessel draught (m)</label>
            <input
              type="number"
              value={draught}
              onChange={(e) => setDraught(e.target.value)}
              placeholder="Enter vessel draught"
              className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-semibold">Conditions</h2>
            {loading ? (
              <p className="text-slate-400">Loading tide and weather...</p>
            ) : (
              <>
                <p className="text-sm">Tidal height now: {tideNow !== null ? `${tideNow.toFixed(2)} m` : 'n/a'}</p>
                <p className="mt-1 text-sm">Wind: {weather?.weather?.current?.wind_speed_10m ?? '-'} km/h @ {weather?.weather?.current?.wind_direction_10m ?? '-'}°</p>
                <p className="mt-1 text-sm">Pressure: {weather?.weather?.current?.surface_pressure ?? '-'} hPa</p>
                <p className="mt-1 text-sm">Air temp: {weather?.weather?.current?.temperature_2m ?? '-'} C</p>

                <div className="mt-4 rounded border border-slate-600 bg-slate-950 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Result</p>
                  <p className={`mt-1 text-xl font-bold ${ukc !== null && ukc < 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                    UKC: {ukc !== null ? `${ukc.toFixed(2)} m` : 'Enter depth and draught'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
