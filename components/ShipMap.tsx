'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  bearingBetween,
  getPilotPortByName,
  getShipTypeCategory,
  getShipTypeLabel,
  PILOT_PORTS,
  getStatusLabel,
  nearestPort,
  nauticalMilesBetween,
} from '@/lib/marine'

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), {
  ssr: false,
})

type Vessel = {
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
  eta?: string | null
  draught?: number | null
  flag?: string | null
  length?: number | null
  width?: number | null
}

type IngestDebugStatus = {
  status: 'running' | 'starting'
  received: number
  inserted: number
  lastError: string | null
  demoMode?: boolean
  demoCount?: number
  connectAttempts?: number
  lastOpenAt?: string | null
  lastMessageAt?: string | null
  closeCode?: number | null
  closeReason?: string | null
}

type TrailPoint = {
  latitude: number
  longitude: number
  timestamp: string
}

type SunData = {
  sunrise: string | null
  sunset: string | null
}

type TideData = {
  heights?: Array<{ dt: number; height: number }>
}

type MaritimeWarning = {
  id: string
  title: string
  severity: string
  area: string
  sent: string
  source: string
  url: string
}

type VesselPhoto = {
  imageUrl: string | null
  pageUrl: string | null
  source: string | null
}

type FishingHotspot = {
  latitude: number
  longitude: number
  intensity: number
  count: number
}

type PilotBoardingPoint = {
  key: string
  name: string
  latitude: number
  longitude: number
}

export default function ShipMap() {
  const searchParams = useSearchParams()
  const [isMobile, setIsMobile] = useState(false)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [ingestStatus, setIngestStatus] = useState<IngestDebugStatus | null>(null)
  const [selectedMmsi, setSelectedMmsi] = useState<string | null>(null)
  const [trail, setTrail] = useState<TrailPoint[]>([])
  const [watchlist, setWatchlist] = useState<string[]>(() => {
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
  const [shipTypeFilter, setShipTypeFilter] = useState('all')
  const [speedMin, setSpeedMin] = useState(0)
  const [speedMax, setSpeedMax] = useState(60)
  const [alertsOnly, setAlertsOnly] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [showFishingHeatmap, setShowFishingHeatmap] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<Array<{ lat: number; lng: number }>>([])
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [sunData, setSunData] = useState<SunData | null>(null)
  const [tideData, setTideData] = useState<TideData | null>(null)
  const [warnings, setWarnings] = useState<MaritimeWarning[]>([])
  const [vesselPhoto, setVesselPhoto] = useState<VesselPhoto | null>(null)
  const [fishingHotspots, setFishingHotspots] = useState<FishingHotspot[]>([])
  const [pilotBoardingPoints, setPilotBoardingPoints] = useState<PilotBoardingPoint[]>(() => {
    if (typeof window === 'undefined') {
      return PILOT_PORTS.map((p) => ({ key: p.key, name: p.name, latitude: p.boardingLatitude, longitude: p.boardingLongitude }))
    }

    try {
      const raw = localStorage.getItem('pilot-boarding-points')
      if (!raw) {
        return PILOT_PORTS.map((p) => ({ key: p.key, name: p.name, latitude: p.boardingLatitude, longitude: p.boardingLongitude }))
      }
      const parsed = JSON.parse(raw) as PilotBoardingPoint[]
      if (!Array.isArray(parsed)) {
        return PILOT_PORTS.map((p) => ({ key: p.key, name: p.name, latitude: p.boardingLatitude, longitude: p.boardingLongitude }))
      }
      return parsed
    } catch {
      return PILOT_PORTS.map((p) => ({ key: p.key, name: p.name, latitude: p.boardingLatitude, longitude: p.boardingLongitude }))
    }
  })
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [showVesselPanel, setShowVesselPanel] = useState(false)
  const [showLocationPanel, setShowLocationPanel] = useState(false)
  const [portDepthInput, setPortDepthInput] = useState('')
  const [vesselDraughtInput, setVesselDraughtInput] = useState('')
  const wasMobileRef = useRef<boolean | null>(null)

  const vesselQuery = (searchParams.get('q') ?? '').trim().toLowerCase()

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)

      if (wasMobileRef.current === null) {
        if (mobile) {
          setShowFiltersPanel(false)
          setShowDebugPanel(false)
        } else {
          setShowFiltersPanel(true)
          setShowDebugPanel(true)
        }
        wasMobileRef.current = mobile
        return
      }

      if (mobile !== wasMobileRef.current) {
        if (mobile) {
          setShowFiltersPanel(false)
          setShowDebugPanel(false)
        } else {
          setShowFiltersPanel(true)
          setShowDebugPanel(true)
          setShowVesselPanel(true)
          setShowLocationPanel(true)
        }
        wasMobileRef.current = mobile
      }
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    localStorage.setItem('watchlist-mmsi', JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    localStorage.setItem('pilot-boarding-points', JSON.stringify(pilotBoardingPoints))
  }, [pilotBoardingPoints])

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist])

  const isSpeedAlert = (v: Vessel): boolean => {
    const sog = v.speed_over_ground ?? 0
    const unexpectedlyStopped = (v.nav_status === '0' || v.nav_status === '8') && sog < 0.5
    const unusuallyFast = sog > 35
    return unexpectedlyStopped || unusuallyFast
  }

  const filteredVessels = useMemo(() => {
    return vessels.filter((v) => {
      const name = (v.vessel_name ?? '').toLowerCase()
      const mmsi = v.mmsi.toLowerCase()
      const qMatch = !vesselQuery || name.includes(vesselQuery) || mmsi.includes(vesselQuery)

      const type = getShipTypeCategory(v.ship_type)
      const typeMatch = shipTypeFilter === 'all' || shipTypeFilter === type

      const sog = v.speed_over_ground ?? 0
      const speedMatch = sog >= speedMin && sog <= speedMax

      const alertMatch = !alertsOnly || isSpeedAlert(v)

      return qMatch && typeMatch && speedMatch && alertMatch
    })
  }, [alertsOnly, shipTypeFilter, speedMax, speedMin, vesselQuery, vessels])

  const noQueryMatch = vesselQuery.length > 0 && filteredVessels.length === 0
  const baseMapVessels = noQueryMatch ? vessels : filteredVessels
  const mapVessels = useMemo(() => {
    if (!selectedMmsi) {
      return baseMapVessels
    }

    const alreadyVisible = baseMapVessels.some((v) => v.mmsi === selectedMmsi)
    if (alreadyVisible) {
      return baseMapVessels
    }

    const selectedFromAll = vessels.find((v) => v.mmsi === selectedMmsi)
    if (!selectedFromAll) {
      return baseMapVessels
    }

    // Keep selected vessel visible even if live updates temporarily move it outside active filters.
    return [selectedFromAll, ...baseMapVessels]
  }, [baseMapVessels, selectedMmsi, vessels])
  const hasLiveMessages = (ingestStatus?.received ?? 0) > 0 && !ingestStatus?.demoMode
  const sourceBadgeLabel = ingestStatus?.demoMode ? 'Demo Feed' : hasLiveMessages ? 'Live AIS' : 'Connecting'
  const sourceBadgeClassName = ingestStatus?.demoMode
    ? 'border-amber-300 bg-amber-100 text-amber-900'
    : hasLiveMessages
      ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
      : 'border-slate-300 bg-slate-100 text-slate-800'

  const selectedVessel = useMemo(() => {
    if (!selectedMmsi) return null
    return vessels.find((v) => v.mmsi === selectedMmsi) ?? null
  }, [selectedMmsi, vessels])

  const nearest = useMemo(() => {
    if (!clickedLocation) return null
    return nearestPort(clickedLocation.lat, clickedLocation.lng)
  }, [clickedLocation])

  const nearestPilotPort = useMemo(() => {
    if (!nearest) return null
    return getPilotPortByName(nearest.port.name)
  }, [nearest])

  const portTrafficCount = useMemo(() => {
    if (!nearest) return 0
    return mapVessels.filter((v) => nauticalMilesBetween(v.latitude, v.longitude, nearest.port.latitude, nearest.port.longitude) <= 8).length
  }, [mapVessels, nearest])

  const measureSummary = useMemo(() => {
    if (measurePoints.length < 2) return null
    const a = measurePoints[0]
    const b = measurePoints[1]
    return {
      nm: nauticalMilesBetween(a.lat, a.lng, b.lat, b.lng),
      bearing: bearingBetween(a.lat, a.lng, b.lat, b.lng),
    }
  }, [measurePoints])

  const toggleWatchlist = (mmsi: string) => {
    setWatchlist((prev) => (prev.includes(mmsi) ? prev.filter((m) => m !== mmsi) : [...prev, mmsi]))
  }

  useEffect(() => {
    const fetchVessels = async () => {
      const OPTIONAL_SELECT = 'mmsi, vessel_name, latitude, longitude, speed_over_ground, course_over_ground, true_heading, nav_status, ship_type, destination, timestamp, eta, draught, flag, length, width'
      const CORE_SELECT = 'mmsi, vessel_name, latitude, longitude, speed_over_ground, course_over_ground, true_heading, nav_status, ship_type, destination, timestamp'
      const IRELAND_BOUNDS = {
        minLat: 51,
        maxLat: 56.8,
        minLng: -11,
        maxLng: -5,
      }

      const fetchSlice = async ({
        limit,
        irelandOnly,
      }: {
        limit: number
        irelandOnly: boolean
      }): Promise<Vessel[] | null> => {
        const full = irelandOnly
          ? await supabase
              .from('vessel_positions')
              .select(OPTIONAL_SELECT)
              .gte('latitude', IRELAND_BOUNDS.minLat)
              .lte('latitude', IRELAND_BOUNDS.maxLat)
              .gte('longitude', IRELAND_BOUNDS.minLng)
              .lte('longitude', IRELAND_BOUNDS.maxLng)
              .order('timestamp', { ascending: false })
              .limit(limit)
          : await supabase
              .from('vessel_positions')
              .select(OPTIONAL_SELECT)
              .order('timestamp', { ascending: false })
              .limit(limit)

        if (full.error && /column .* does not exist/i.test(full.error.message)) {
          const fallback = irelandOnly
            ? await supabase
                .from('vessel_positions')
                .select(CORE_SELECT)
                .gte('latitude', IRELAND_BOUNDS.minLat)
                .lte('latitude', IRELAND_BOUNDS.maxLat)
                .gte('longitude', IRELAND_BOUNDS.minLng)
                .lte('longitude', IRELAND_BOUNDS.maxLng)
                .order('timestamp', { ascending: false })
                .limit(limit)
            : await supabase
                .from('vessel_positions')
                .select(CORE_SELECT)
                .order('timestamp', { ascending: false })
                .limit(limit)

          if (fallback.error) {
            return null
          }

          return (fallback.data as Vessel[] | null) ?? null
        }

        if (full.error) {
          return null
        }

        return (full.data as Vessel[] | null) ?? null
      }

      let data: Vessel[] | null = null

      try {
        const [irelandRows, globalRows] = await Promise.all([
          fetchSlice({ limit: 450, irelandOnly: true }),
          fetchSlice({ limit: 550, irelandOnly: false }),
        ])

        if (!irelandRows && !globalRows) {
          return
        }

        data = [...(irelandRows ?? []), ...(globalRows ?? [])]
      } catch {
        // Keep existing markers on transient client/network errors instead of blanking the map.
        return
      }

      let unique: Vessel[] = []
      if (data) {
        const seen = new Set<string>()
        unique = data.filter((v: Vessel) => {
          if (seen.has(v.mmsi)) return false
          seen.add(v.mmsi)
          return true
        })

        unique = unique.slice(0, 700)
      }

      const queryLooksLikeMmsi = /^\d{7,10}$/.test(vesselQuery)
      const existsInSupabase = unique.some((v) => v.mmsi === vesselQuery)

      if (queryLooksLikeMmsi && !existsInSupabase) {
        try {
          const res = await fetch(`/api/location-source/latest?mmsi=${encodeURIComponent(vesselQuery)}`, { cache: 'no-store' })
          if (res.ok) {
            const payload = (await res.json()) as { location?: Vessel | null }
            const fallback = payload.location ?? null
            if (fallback) {
              unique = [fallback, ...unique]
            }
          }
        } catch {
          // Keep Supabase-only list when fallback source is unavailable.
        }
      }

      setVessels(unique)
    }

    fetchVessels()
    const interval = setInterval(fetchVessels, 10000)
    return () => clearInterval(interval)
  }, [vesselQuery])

  useEffect(() => {
    const fetchFishingHotspots = async () => {
      const { data } = await supabase
        .from('vessel_positions')
        .select('latitude, longitude, ship_type, nav_status, timestamp')
        .or('ship_type.eq.30,nav_status.eq.7')
        .order('timestamp', { ascending: false })
        .limit(3000)

      if (!data || data.length === 0) {
        setFishingHotspots([])
        return
      }

      const grid = new Map<string, { latitude: number; longitude: number; count: number }>()

      for (const row of data) {
        const lat = Number(row.latitude)
        const lng = Number(row.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          continue
        }

        const cellLat = Math.round(lat * 2) / 2
        const cellLng = Math.round(lng * 2) / 2
        const key = `${cellLat}:${cellLng}`
        const existing = grid.get(key)

        if (existing) {
          existing.count += 1
        } else {
          grid.set(key, { latitude: cellLat, longitude: cellLng, count: 1 })
        }
      }

      const maxCount = Math.max(...Array.from(grid.values()).map((v) => v.count), 1)
      const hotspots = Array.from(grid.values())
        .filter((v) => v.count >= 3)
        .map((v) => ({
          latitude: v.latitude,
          longitude: v.longitude,
          count: v.count,
          intensity: Math.min(1, v.count / maxCount),
        }))

      setFishingHotspots(hotspots)
    }

    void fetchFishingHotspots()
    const interval = setInterval(fetchFishingHotspots, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const pollIngestStatus = async () => {
      try {
        const response = await fetch('/api/ais-ingest')
        if (!response.ok) return

        const data = (await response.json()) as IngestDebugStatus
        setIngestStatus(data)
      } catch {
        // Ignore transient network errors while polling debug status.
      }
    }

    pollIngestStatus()
    const interval = setInterval(pollIngestStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchTrail = async () => {
      if (!selectedMmsi) {
        setTrail([])
        return
      }

      const { data } = await supabase
        .from('vessel_positions')
        .select('latitude, longitude, timestamp')
        .eq('mmsi', selectedMmsi)
        .order('timestamp', { ascending: false })
        .limit(80)

      if (!data) {
        setTrail([])
        return
      }

      setTrail([...data].reverse() as TrailPoint[])
    }

    void fetchTrail()
  }, [selectedMmsi, ingestStatus?.inserted])

  useEffect(() => {
    const fetchSunData = async () => {
      if (!clickedLocation) {
        setSunData(null)
        return
      }

      try {
        const response = await fetch(`/api/sun?lat=${clickedLocation.lat}&lng=${clickedLocation.lng}`)
        if (!response.ok) {
          setSunData(null)
          return
        }
        const data = (await response.json()) as SunData
        setSunData(data)
      } catch {
        setSunData(null)
      }
    }

    void fetchSunData()
  }, [clickedLocation])

  useEffect(() => {
    const fetchTideData = async () => {
      if (!clickedLocation) {
        setTideData(null)
        return
      }

      try {
        const response = await fetch(`/api/tides?lat=${clickedLocation.lat}&lng=${clickedLocation.lng}`)
        if (!response.ok) {
          setTideData(null)
          return
        }

        const data = (await response.json()) as TideData
        setTideData(data)
      } catch {
        setTideData(null)
      }
    }

    void fetchTideData()
  }, [clickedLocation])

  useEffect(() => {
    const fetchWarnings = async () => {
      if (!clickedLocation) {
        setWarnings([])
        return
      }

      try {
        const response = await fetch(`/api/navtex?lat=${clickedLocation.lat}&lng=${clickedLocation.lng}`)
        if (!response.ok) {
          setWarnings([])
          return
        }
        const data = (await response.json()) as { warnings?: MaritimeWarning[] }
        setWarnings(data.warnings ?? [])
      } catch {
        setWarnings([])
      }
    }

    void fetchWarnings()
  }, [clickedLocation])

  useEffect(() => {
    const fetchPhoto = async () => {
      const vesselName = selectedVessel?.vessel_name?.trim()
      if (!vesselName) {
        setVesselPhoto(null)
        return
      }

      try {
        const response = await fetch(`/api/vessel-photo?name=${encodeURIComponent(vesselName)}&mmsi=${selectedVessel?.mmsi ?? ''}`)
        if (!response.ok) {
          setVesselPhoto(null)
          return
        }
        const data = (await response.json()) as VesselPhoto
        setVesselPhoto(data)
      } catch {
        setVesselPhoto(null)
      }
    }

    void fetchPhoto()
  }, [selectedVessel?.mmsi, selectedVessel?.vessel_name])

  const selectedEta = selectedVessel?.eta ?? null
  const selectedDraught = selectedVessel?.draught ?? null
  const selectedFlag = selectedVessel?.flag ?? null
  const selectedLength = selectedVessel?.length ?? null
  const selectedWidth = selectedVessel?.width ?? null

  const currentTideHeight = useMemo(() => {
    const heights = tideData?.heights ?? []
    if (heights.length === 0) return null

    // WorldTides heights are returned in chronological order; first sample is effectively current.
    return heights[0].height
  }, [tideData])

  const effectivePortDepth = useMemo(() => {
    const manual = Number(portDepthInput)
    if (Number.isFinite(manual) && manual > 0) return manual
    if (nearestPilotPort) return nearestPilotPort.chartedDepthMeters
    return null
  }, [nearestPilotPort, portDepthInput])

  const effectiveDraught = useMemo(() => {
    const manual = Number(vesselDraughtInput)
    if (Number.isFinite(manual) && manual > 0) return manual
    if (selectedDraught && selectedDraught > 0) return selectedDraught
    return null
  }, [selectedDraught, vesselDraughtInput])

  const underKeelClearance = useMemo(() => {
    if (effectivePortDepth === null || effectiveDraught === null) {
      return null
    }

    const tide = currentTideHeight ?? 0
    return effectivePortDepth + tide - effectiveDraught
  }, [currentTideHeight, effectiveDraught, effectivePortDepth])

  const handleMapClick = (lat: number, lng: number) => {
    setClickedLocation({ lat, lng })
    setShowLocationPanel(true)
  }

  const handleSelectVessel = (mmsi: string) => {
    setSelectedMmsi(mmsi)
    if (isMobile) {
      setShowVesselPanel(true)
    }
  }

  const handlePilotBoardingSelect = (_name: string, lat: number, lng: number) => {
    setClickedLocation({ lat, lng })
    setShowLocationPanel(true)
  }

  const handlePilotBoardingMove = (key: string, lat: number, lng: number) => {
    setPilotBoardingPoints((prev) =>
      prev.map((point) =>
        point.key === key
          ? {
              ...point,
              latitude: Number(lat.toFixed(6)),
              longitude: Number(lng.toFixed(6)),
            }
          : point
      )
    )
    setClickedLocation({ lat, lng })
    setShowLocationPanel(true)
  }

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute left-1/2 top-2 z-[1000] -translate-x-1/2 md:top-4">
        <div className={`rounded-full border px-3 py-1 text-xs font-semibold shadow ${sourceBadgeClassName}`}>
          Source: {sourceBadgeLabel}
        </div>
      </div>

      {!showFiltersPanel && (
        <button
          type="button"
          onClick={() => setShowFiltersPanel(true)}
          className="absolute right-2 top-2 z-[1000] rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow"
        >
          Filters
        </button>
      )}

      {showFiltersPanel && (
      <div className="absolute right-2 top-2 z-[1000] w-72 max-w-[calc(100vw-1rem)] rounded-md border border-slate-400 bg-white p-3 text-xs text-slate-900 shadow-lg md:right-4 md:top-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold text-slate-950">Map Filters</p>
          <button
            type="button"
            onClick={() => setShowFiltersPanel(false)}
            className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Minimize
          </button>
        </div>

        <label className="mb-1 block font-medium">Ship type</label>
        <select
          value={shipTypeFilter}
          onChange={(e) => setShipTypeFilter(e.target.value)}
          className="mb-2 w-full rounded border border-slate-400 bg-white px-2 py-1 text-slate-900"
        >
          <option value="all">All</option>
          <option value="cargo">Cargo</option>
          <option value="tanker">Tanker</option>
          <option value="fishing">Fishing</option>
          <option value="passenger">Passenger</option>
          <option value="military">Military</option>
          <option value="other">Other</option>
          <option value="unknown">Unknown</option>
        </select>

        <label className="mb-1 block font-medium">Speed min/max (kn)</label>
        <div className="mb-2 flex items-center gap-2">
          <input
            type="number"
            value={speedMin}
            onChange={(e) => setSpeedMin(Number(e.target.value))}
            className="w-full rounded border border-slate-400 px-2 py-1 text-slate-900"
          />
          <input
            type="number"
            value={speedMax}
            onChange={(e) => setSpeedMax(Number(e.target.value))}
            className="w-full rounded border border-slate-400 px-2 py-1 text-slate-900"
          />
        </div>

        <label className="mb-2 flex items-center gap-2">
          <input type="checkbox" checked={alertsOnly} onChange={(e) => setAlertsOnly(e.target.checked)} />
          <span>Show speed alerts only</span>
        </label>

        <label className="mb-2 flex items-center gap-2">
          <input type="checkbox" checked={showFishingHeatmap} onChange={(e) => setShowFishingHeatmap(e.target.checked)} />
          <span>Fishing activity heatmap</span>
        </label>

        <button
          type="button"
          onClick={() => setMeasureMode((v) => !v)}
          className="w-full rounded bg-slate-800 px-3 py-1.5 font-medium text-white"
        >
          Distance Tool: {measureMode ? 'On' : 'Off'}
        </button>

        {measureSummary && (
          <p className="mt-2 rounded border border-amber-200 bg-amber-100 p-2 font-medium text-amber-950">
            Distance: {measureSummary.nm.toFixed(2)} nm<br />
            Bearing: {measureSummary.bearing.toFixed(1)}°
          </p>
        )}
      </div>
      )}

      <LeafletMap
        vessels={mapVessels}
        selectedQuery={vesselQuery}
        selectedMmsi={selectedMmsi}
        selectedTrail={trail}
        fishingHotspots={showFishingHeatmap ? fishingHotspots : []}
        pilotBoardingMarkers={pilotBoardingPoints}
        watchlist={watchlistSet}
        measureMode={measureMode}
        onMeasureUpdate={setMeasurePoints}
        onMapClick={handleMapClick}
        onPilotBoardingSelect={handlePilotBoardingSelect}
        onPilotBoardingMove={handlePilotBoardingMove}
        onSelectVessel={handleSelectVessel}
      />

      {selectedVessel && !showVesselPanel && (
        <button
          type="button"
          onClick={() => setShowVesselPanel(true)}
          className="absolute bottom-4 left-2 z-[1000] rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow md:left-4"
        >
          Vessel
        </button>
      )}

      {selectedVessel && showVesselPanel && (
        <div className="absolute bottom-4 left-2 z-[1000] max-w-[calc(100vw-1rem)] rounded-md border border-slate-400 bg-white p-3 text-sm text-slate-900 shadow-lg md:left-4 md:max-w-sm">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-slate-700">Vessel detail panel</p>
            <button
              type="button"
              onClick={() => setShowVesselPanel(false)}
              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Minimize
            </button>
          </div>
          <p className="font-semibold">{selectedVessel.vessel_name || 'Unknown Vessel'}</p>
          <p>MMSI: {selectedVessel.mmsi}</p>
          <p>Status: {getStatusLabel(selectedVessel.nav_status)}</p>
          <p>Ship type: {getShipTypeLabel(selectedVessel.ship_type)}</p>
          <p>Destination: {selectedVessel.destination ?? 'Unknown'}</p>
          <p>ETA: {selectedEta ?? 'Unknown'}</p>
          <p>Flag: {selectedFlag ?? 'Unknown'}</p>
          <div className="mt-1 rounded border border-slate-300 bg-slate-50 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Ship dimensions</p>
            <p>LOA: {selectedLength ?? '-'} m</p>
            <p>Beam: {selectedWidth ?? '-'} m</p>
            <p>Draught: {selectedDraught ?? '-'} m</p>
          </div>
          <p>
            Dimensions: {selectedLength ?? '-'} m x {selectedWidth ?? '-'} m
          </p>
          <p>Draught: {selectedDraught ?? '-'} m</p>
          <p>Trail points: {trail.length}</p>
          {vesselPhoto?.imageUrl && (
            <div className="mt-2 overflow-hidden rounded border border-slate-200">
              <Image
                src={vesselPhoto.imageUrl}
                alt={`${selectedVessel.vessel_name ?? 'Vessel'} photo`}
                width={800}
                height={320}
                className="h-28 w-full object-cover"
              />
            </div>
          )}
          {vesselPhoto?.pageUrl && (
            <a href={vesselPhoto.pageUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-cyan-800 hover:underline">
              Photo source: {vesselPhoto.source ?? 'External'}
            </a>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => toggleWatchlist(selectedVessel.mmsi)}
              className="rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-slate-900"
            >
              {watchlistSet.has(selectedVessel.mmsi) ? 'Remove Watchlist' : 'Add Watchlist'}
            </button>
            <Link
              href={`/vessel/${selectedVessel.mmsi}`}
              className="rounded bg-cyan-600 px-2 py-1 text-xs font-semibold text-white"
            >
              Open Profile
            </Link>
          </div>
        </div>
      )}

      {clickedLocation && nearest && !showLocationPanel && (
        <button
          type="button"
          onClick={() => setShowLocationPanel(true)}
          className="absolute bottom-4 right-2 z-[1000] rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow md:right-4"
        >
          Location
        </button>
      )}

      {clickedLocation && nearest && showLocationPanel && (
        <div className="absolute bottom-4 right-2 z-[1000] max-w-[calc(100vw-1rem)] rounded-md border border-slate-400 bg-white p-3 text-sm text-slate-900 shadow-lg md:right-4 md:max-w-sm">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-slate-700">Location insights</p>
            <button
              type="button"
              onClick={() => setShowLocationPanel(false)}
              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Minimize
            </button>
          </div>
          <p>
            Clicked: {clickedLocation.lat.toFixed(4)}, {clickedLocation.lng.toFixed(4)}
          </p>
          <p>
            Nearest port: {nearest.port.name} ({nearest.port.country})
          </p>
          {nearestPilotPort && (
            <p>
              Pilot boarding: {nearestPilotPort.boardingLatitude.toFixed(4)}, {nearestPilotPort.boardingLongitude.toFixed(4)}
            </p>
          )}
          <p>Distance to port: {nearest.distanceNm.toFixed(1)} nm</p>
          <p>Port traffic (8nm): {portTrafficCount} vessels</p>
          <p>
            Sunrise: {sunData?.sunrise ? new Date(sunData.sunrise).toLocaleTimeString() : 'n/a'} | Sunset:{' '}
            {sunData?.sunset ? new Date(sunData.sunset).toLocaleTimeString() : 'n/a'}
          </p>
          <p>
            Golden hour approx: {sunData?.sunrise ? new Date(new Date(sunData.sunrise).getTime() + 60 * 60 * 1000).toLocaleTimeString() : 'n/a'} /{' '}
            {sunData?.sunset ? new Date(new Date(sunData.sunset).getTime() - 60 * 60 * 1000).toLocaleTimeString() : 'n/a'}
          </p>
          <div className="mt-2 rounded border border-slate-300 bg-slate-50 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Under keel clearance</p>
            <label className="mt-1 block text-xs text-slate-700">Port charted depth (m)</label>
            <input
              type="number"
              value={portDepthInput}
              onChange={(e) => setPortDepthInput(e.target.value)}
              placeholder={nearestPilotPort ? String(nearestPilotPort.chartedDepthMeters) : 'Enter depth'}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <label className="mt-1 block text-xs text-slate-700">Vessel draught (m)</label>
            <input
              type="number"
              value={vesselDraughtInput}
              onChange={(e) => setVesselDraughtInput(e.target.value)}
              placeholder={selectedDraught !== null ? String(selectedDraught) : 'Enter draught'}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <p className="mt-1 text-xs">Tidal height now: {currentTideHeight !== null ? `${currentTideHeight.toFixed(2)} m` : 'n/a'}</p>
            <p className={`mt-1 text-xs font-semibold ${underKeelClearance !== null && underKeelClearance < 1 ? 'text-red-700' : 'text-emerald-700'}`}>
              UKC: {underKeelClearance !== null ? `${underKeelClearance.toFixed(2)} m` : 'Enter depth and draught'}
            </p>
          </div>
          <p className="mt-1 font-medium">Maritime warnings: {warnings.length}</p>
          {warnings.slice(0, 2).map((warning) => (
            <p key={warning.id} className="text-xs font-medium text-amber-950">
              {warning.severity}: {warning.title}
            </p>
          ))}
          <Link
            href={`/dashboard?lat=${clickedLocation.lat.toFixed(4)}&lng=${clickedLocation.lng.toFixed(4)}`}
            className="mt-2 inline-block rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white"
          >
            Open Marine Dashboard
          </Link>
        </div>
      )}

      {!showDebugPanel && (
        <button
          type="button"
          onClick={() => setShowDebugPanel(true)}
          className="absolute left-2 top-2 z-[1000] rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow md:left-4 md:top-4"
        >
          Debug
        </button>
      )}

      {showDebugPanel && (
      <div className="absolute left-2 top-2 z-[1000] max-w-[calc(100vw-1rem)] rounded-md border border-slate-400 bg-white p-3 text-sm text-slate-900 shadow-lg md:left-4 md:top-4 md:max-w-xs">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-semibold text-slate-950">AIS Ingest Debug</p>
          <button
            type="button"
            onClick={() => setShowDebugPanel(false)}
            className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Minimize
          </button>
        </div>
        <p>Map vessels: {mapVessels.length}</p>
        <p>Fishing hotspots: {fishingHotspots.length}</p>
        <p>Watchlist vessels: {watchlist.length}</p>
        {vesselQuery && <p>Search: {searchParams.get('q')}</p>}
        {noQueryMatch && <p className="text-amber-800">No query matches. Showing all vessels.</p>}
        <p>Source: {sourceBadgeLabel}</p>
        <p>Status: {ingestStatus?.status ?? 'unknown'}</p>
        <p>Messages received: {ingestStatus?.received ?? 0}</p>
        <p>Rows inserted: {ingestStatus?.inserted ?? 0}</p>
        <p>Demo mode: {ingestStatus?.demoMode ? 'on' : 'off'}</p>
        <p>Demo fleet: {ingestStatus?.demoCount ?? 0}</p>
        <p className="break-words text-red-700">Last error: {ingestStatus?.lastError ?? 'none'}</p>
      </div>
      )}
    </div>
  )
}
