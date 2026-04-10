'use client'

type TideExtreme = {
  dt: number
  date?: string
  height: number
  type: string
}

type TidesResponse = {
  extremes?: TideExtreme[]
}

export default function TideChart({ tides }: { tides: TidesResponse | null }) {
  if (!tides?.extremes || tides.extremes.length === 0) {
    return <p className="text-slate-400">No tide data available for this location.</p>
  }

  const now = tides.extremes[0].dt * 1000
  const oneDayMs = 24 * 60 * 60 * 1000
  const upcoming24h = tides.extremes.filter((e) => {
    const t = e.dt * 1000
    return t >= now && t <= now + oneDayMs
  })

  const extremes = (upcoming24h.length > 0 ? upcoming24h : tides.extremes).slice(0, 8)

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {extremes.map((e) => {
          const date = new Date(e.dt * 1000)
          const isHigh = e.type === 'High'
          return (
            <div key={`${e.dt}-${e.type}`} className={`rounded-xl p-4 text-center ${isHigh ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <p className="mb-1 text-xs text-slate-300">{isHigh ? '▲ High Tide' : '▼ Low Tide'}</p>
              <p className="text-2xl font-bold">{e.height.toFixed(2)}m</p>
              <p className="mt-1 text-sm text-slate-300">
                {date.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              <p className="text-sm font-semibold">
                {date.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">Tide predictions from WorldTides. All times local.</p>
    </div>
  )
}
