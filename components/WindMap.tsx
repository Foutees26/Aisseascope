'use client'

import { useState } from 'react'

type OverlayType = 'wind' | 'waves' | 'pressure'

export default function WindMap({ lat, lng }: { lat: number; lng: number }) {
  const [overlay, setOverlay] = useState<OverlayType>('wind')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          className={`rounded-lg px-3 py-1.5 text-sm ${overlay === 'wind' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-200'}`}
          onClick={() => setOverlay('wind')}
          type="button"
        >
          Wind
        </button>
        <button
          className={`rounded-lg px-3 py-1.5 text-sm ${overlay === 'waves' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-200'}`}
          onClick={() => setOverlay('waves')}
          type="button"
        >
          Waves
        </button>
        <button
          className={`rounded-lg px-3 py-1.5 text-sm ${overlay === 'pressure' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-200'}`}
          onClick={() => setOverlay('pressure')}
          type="button"
        >
          Pressure
        </button>
      </div>

      <iframe
        src={`https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}&width=650&height=450&zoom=7&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=true&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`}
        width="100%"
        height="450"
        style={{ borderRadius: 12, border: 'none' }}
        allowFullScreen
      />
    </div>
  )
}
