'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import TopNav from '@/components/TopNav'

const WindMap = dynamic(() => import('@/components/WindMap'), { ssr: false })
const TideChart = dynamic(() => import('@/components/TideChart'), { ssr: false })

type WeatherCurrent = {
  temperature_2m: number
  wind_speed_10m: number
  wind_direction_10m: number
  surface_pressure: number
  weather_code: number
}

type MarineHourly = {
  wave_height?: number[]
  wave_period?: number[]
  wave_direction?: number[]
  wind_wave_height?: number[]
}

type MarineData = {
  hourly?: MarineHourly
}

type WeatherApiResponse = {
  weather?: {
    current?: WeatherCurrent
  }
  marine?: MarineData
}

type TideExtreme = {
  dt: number
  height: number
  type: string
}

type TidesData = {
  extremes?: TideExtreme[]
  error?: string
}

function DashboardContent() {
  const params = useSearchParams()
  const lat = params.get('lat') || '54.5'
  const lng = params.get('lng') || '-8.2'

  const [weather, setWeather] = useState<WeatherCurrent | null>(null)
  const [marine, setMarine] = useState<MarineData | null>(null)
  const [tides, setTides] = useState<TidesData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [wxRes, tideRes] = await Promise.all([
          fetch(`/api/weather?lat=${lat}&lng=${lng}`),
          fetch(`/api/tides?lat=${lat}&lng=${lng}`),
        ])

        const wxData = (await wxRes.json()) as WeatherApiResponse
        const tideData = (await tideRes.json()) as TidesData

        setWeather(wxData.weather?.current ?? null)
        setMarine(wxData.marine ?? null)
        setTides(tideData)
      } finally {
        setLoading(false)
      }
    }

    void fetchAll()
  }, [lat, lng])

  const wmoDescription = (code: number) => {
    if (code === 0) return 'Clear sky'
    if (code <= 3) return 'Partly cloudy'
    if (code <= 48) return 'Foggy'
    if (code <= 67) return 'Rain'
    if (code <= 77) return 'Snow'
    if (code <= 82) return 'Showers'
    if (code <= 99) return 'Thunderstorm'
    return 'Unknown'
  }

  const nowHour = useMemo(() => new Date().getHours(), [])
  const latNum = Number.parseFloat(lat)
  const lngNum = Number.parseFloat(lng)

  const latLabel = `${Math.abs(latNum).toFixed(3)}° ${latNum >= 0 ? 'N' : 'S'}`
  const lngLabel = `${Math.abs(lngNum).toFixed(3)}° ${lngNum >= 0 ? 'E' : 'W'}`

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      <TopNav />

      <div className="p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Marine Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">{latLabel}, {lngLabel}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">Loading conditions...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-800 p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-300">Current Conditions</h2>
            {weather ? (
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Temperature" value={`${weather.temperature_2m}°C`} />
                <Stat label="Conditions" value={wmoDescription(weather.weather_code)} />
                <Stat label="Wind Speed" value={`${weather.wind_speed_10m} km/h`} />
                <Stat label="Wind Direction" value={`${weather.wind_direction_10m}°`} />
                <Stat label="Pressure" value={`${weather.surface_pressure} hPa`} />
              </div>
            ) : (
              <p className="text-slate-400">No weather data available.</p>
            )}
          </div>

          <div className="rounded-2xl bg-slate-800 p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-300">Wave Conditions</h2>
            {marine?.hourly ? (
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Wave Height" value={`${marine.hourly.wave_height?.[nowHour] ?? '-'} m`} />
                <Stat label="Wave Period" value={`${marine.hourly.wave_period?.[nowHour] ?? '-'} s`} />
                <Stat label="Wave Direction" value={`${marine.hourly.wave_direction?.[nowHour] ?? '-'}°`} />
                <Stat label="Wind Wave Height" value={`${marine.hourly.wind_wave_height?.[nowHour] ?? '-'} m`} />
              </div>
            ) : (
              <p className="text-slate-400">No marine data available.</p>
            )}
          </div>

          <div className="rounded-2xl bg-slate-800 p-6 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-slate-300">Wind & Weather Map</h2>
            <WindMap lat={latNum} lng={lngNum} />
          </div>

          <div className="rounded-2xl bg-slate-800 p-6 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-slate-300">Tide Table (Next 24h)</h2>
            <TideChart tides={tides} />
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-700 p-4">
      <p className="mb-1 text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">Loading...</div>}
    >
      <DashboardContent />
    </Suspense>
  )
}
