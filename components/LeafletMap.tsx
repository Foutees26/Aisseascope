'use client'

import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, Polyline, TileLayer } from 'react-leaflet'
import { useMapEvents } from 'react-leaflet'
import { useMap } from 'react-leaflet'
import { useRouter } from 'next/navigation'
import { divIcon } from 'leaflet'
import type { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getShipTypeCategory, getStatusLabel, getStatusCategory } from '@/lib/marine'

type Vessel = {
  mmsi: string
  vessel_name: string | null
  latitude: number
  longitude: number
  speed_over_ground: number | null
  course_over_ground: number | null
  true_heading?: number | null
  nav_status: string | null
  ship_type: number | null
  length?: number | null
  width?: number | null
}

type Props = {
  vessels: Vessel[]
  selectedQuery?: string
  selectedMmsi?: string | null
  selectedTrail?: Array<{ latitude: number; longitude: number }>
  fishingHotspots?: Array<{ latitude: number; longitude: number; intensity: number }>
  pilotBoardingMarkers?: Array<{ key: string; name: string; latitude: number; longitude: number }>
  watchlist: Set<string>
  measureMode: boolean
  onMeasureUpdate: (points: Array<{ lat: number; lng: number }>) => void
  onMapClick: (lat: number, lng: number) => void
  onPilotBoardingSelect?: (name: string, lat: number, lng: number) => void
  onPilotBoardingMove?: (key: string, lat: number, lng: number) => void
  onSelectVessel: (mmsi: string) => void
}

function MapClickHandler({
  measureMode,
  onMeasureUpdate,
  onMapClick,
}: {
  measureMode: boolean
  onMeasureUpdate: (points: Array<{ lat: number; lng: number }>) => void
  onMapClick: (lat: number, lng: number) => void
}) {
  const pointsRef = useRef<Array<{ lat: number; lng: number }>>([])

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      onMapClick(lat, lng)

      if (!measureMode) {
        return
      }

      if (pointsRef.current.length >= 2) {
        pointsRef.current = [{ lat, lng }]
      } else {
        pointsRef.current = [...pointsRef.current, { lat, lng }]
      }

      onMeasureUpdate(pointsRef.current)
    },
  })

  return null
}

function MapAutoFocus({
  vessels,
  selectedQuery,
  selectedMmsi,
}: {
  vessels: Vessel[]
  selectedQuery?: string
  selectedMmsi?: string | null
}) {
  const map = useMap()
  const lastFocusKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const q = (selectedQuery ?? '').toLowerCase()
    const exactMatch = q ? vessels.find((v) => v.mmsi.toLowerCase() === q) : null
    const selectedMatch = selectedMmsi ? vessels.find((v) => v.mmsi === selectedMmsi) : null
    const target = selectedMatch ?? exactMatch ?? (vessels.length === 1 ? vessels[0] : null)
    const focusKey = selectedMmsi ? `selected:${selectedMmsi}` : q ? `query:${q}` : vessels.length === 1 ? `single:${vessels[0]?.mmsi ?? ''}` : null

    if (!target || !focusKey) {
      return
    }

    // Avoid re-flying on each polling refresh when the selected/query target has not changed.
    if (lastFocusKeyRef.current === focusKey) {
      return
    }

    map.flyTo([target.latitude, target.longitude], 9, {
      animate: true,
      duration: 0.8,
    })

    lastFocusKeyRef.current = focusKey
  }, [map, selectedMmsi, selectedQuery, vessels])

  return null
}

function estimateLengthFromShipType(shipType: number | null): number {
  if (shipType === null || Number.isNaN(shipType)) return 80
  if (shipType >= 80 && shipType <= 89) return 220
  if (shipType >= 70 && shipType <= 79) return 170
  if (shipType >= 60 && shipType <= 69) return 140
  if (shipType === 30) return 35
  return 90
}

function getVesselColor(vessel: Vessel): string {
  const type = getShipTypeCategory(vessel.ship_type)
  if (type === 'cargo') return '#f59e0b'
  if (type === 'tanker') return '#ef4444'
  if (type === 'fishing') return '#8b5cf6'
  if (type === 'passenger') return '#0ea5e9'
  if (type === 'military') return '#334155'
  if (type === 'other') return '#22c55e'

  // AIS position reports often omit ship type; use nav status to keep markers distinguishable.
  const status = getStatusCategory(vessel.nav_status)
  if (status === 'underway') return '#22c55e'
  if (status === 'anchored') return '#f59e0b'
  if (status === 'moored') return '#0ea5e9'
  if (status === 'aground') return '#ef4444'
  return '#94a3b8'
}

function buildBoatIcon(vessel: Vessel, selected: boolean, watched: boolean) {
  const lengthMeters = vessel.length && vessel.length > 0 ? vessel.length : estimateLengthFromShipType(vessel.ship_type)
  const widthMeters = vessel.width && vessel.width > 0 ? vessel.width : Math.max(8, lengthMeters * 0.18)

  const pxLength = Math.max(16, Math.min(56, Math.round(Math.sqrt(lengthMeters) * 2.1)))
  const pxWidth = Math.max(8, Math.min(22, Math.round(Math.sqrt(widthMeters) * 2.4)))
  const heading = Number.isFinite(vessel.true_heading ?? NaN) ? vessel.true_heading ?? 0 : vessel.course_over_ground ?? 0

  const fill = getVesselColor(vessel)
  const stroke = watched ? '#fde047' : selected ? '#ffffff' : '#0f172a'
  const strokeWidth = watched || selected ? 2.6 : 1.6
  const glow = selected
    ? 'drop-shadow(0 0 6px rgba(255,255,255,0.9))'
    : watched
      ? 'drop-shadow(0 0 4px rgba(253,224,71,0.8))'
      : 'none'

  const html = `
    <div style="width:${pxLength}px;height:${pxLength}px;display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);filter:${glow};">
      <svg width="${pxWidth}" height="${pxLength}" viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="vessel">
        <path d="M50 6 L86 66 L74 188 L26 188 L14 66 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
        <path d="M50 24 L64 52 L36 52 Z" fill="#e2e8f0" opacity="0.42" />
      </svg>
    </div>
  `

  return divIcon({
    html,
    className: '',
    iconSize: [pxLength, pxLength],
    iconAnchor: [pxLength / 2, pxLength / 2],
    popupAnchor: [0, -pxLength / 2],
  })
}

export default function LeafletMap({
  vessels,
  selectedQuery,
  selectedMmsi,
  selectedTrail,
  fishingHotspots,
  pilotBoardingMarkers,
  watchlist,
  measureMode,
  onMeasureUpdate,
  onMapClick,
  onPilotBoardingSelect,
  onPilotBoardingMove,
  onSelectVessel,
}: Props) {
  const router = useRouter()
  const pendingTapRef = useRef<string | null>(null)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [measureLine, setMeasureLine] = useState<Array<{ lat: number; lng: number }>>([])

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current)
      }
    }
  }, [])

  const openVesselPage = (mmsi: string) => {
    router.push(`/vessel/${mmsi}`)
  }

  const handleMarkerTap = (mmsi: string) => {
    onSelectVessel(mmsi)

    if (pendingTapRef.current === mmsi && tapTimerRef.current) {
      clearTimeout(tapTimerRef.current)
      tapTimerRef.current = null
      pendingTapRef.current = null
      openVesselPage(mmsi)
      return
    }

    pendingTapRef.current = mmsi
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current)
    }
    tapTimerRef.current = setTimeout(() => {
      pendingTapRef.current = null
      tapTimerRef.current = null
    }, 450)
  }

  const updateMeasureLine = (points: Array<{ lat: number; lng: number }>) => {
    setMeasureLine(points)
    onMeasureUpdate(points)
  }

  const trailPositions: LatLngExpression[] = (selectedTrail ?? []).map((p) => [p.latitude, p.longitude])
  const measurePositions: LatLngExpression[] = measureLine.map((p) => [p.lat, p.lng])

  return (
    <MapContainer center={[55.1, -9.7]} zoom={7} style={{ height: '100%', width: '100%' }}>
      <MapClickHandler measureMode={measureMode} onMeasureUpdate={updateMeasureLine} onMapClick={onMapClick} />
      <MapAutoFocus vessels={vessels} selectedQuery={selectedQuery} selectedMmsi={selectedMmsi} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {trailPositions.length > 1 && <Polyline positions={trailPositions} pathOptions={{ color: '#06b6d4', weight: 3 }} />}

      {measurePositions.length > 1 && <Polyline positions={measurePositions} pathOptions={{ color: '#f97316', weight: 3, dashArray: '6 6' }} />}

      {(fishingHotspots ?? []).map((spot, index) => (
        <CircleMarker
          key={`hotspot-${index}-${spot.latitude}-${spot.longitude}`}
          center={[spot.latitude, spot.longitude]}
          radius={6 + spot.intensity * 12}
          pathOptions={{
            color: '#f97316',
            weight: 1,
            fillColor: '#f97316',
            fillOpacity: 0.12 + spot.intensity * 0.35,
          }}
          interactive={false}
        />
      ))}

      {(pilotBoardingMarkers ?? []).map((marker) => (
        <Marker
          key={`pilot-${marker.key}`}
          position={[marker.latitude, marker.longitude]}
          draggable
          eventHandlers={{
            click: () => onPilotBoardingSelect?.(marker.name, marker.latitude, marker.longitude),
            dragend: (event) => {
              const next = event.target.getLatLng()
              onPilotBoardingMove?.(marker.key, next.lat, next.lng)
            },
          }}
          icon={divIcon({
            html: '<div style="width:14px;height:14px;border-radius:9999px;background:#38bdf8;border:2px solid #1d4ed8;box-shadow:0 0 0 2px rgba(255,255,255,0.8);"></div>',
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
            popupAnchor: [0, -8],
          })}
        >
          <Popup>
            <strong>{marker.name} Pilot Boarding</strong>
            <br />
            Drag marker to move and save.
            <br />
            Lat/Lng: {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
          </Popup>
        </Marker>
      ))}

      {vessels.map((v) => (
        <Marker
          key={v.mmsi}
          position={[v.latitude, v.longitude]}
          icon={buildBoatIcon(v, selectedMmsi === v.mmsi, watchlist.has(v.mmsi))}
          eventHandlers={{
            click: () => handleMarkerTap(v.mmsi),
            dblclick: () => openVesselPage(v.mmsi),
          }}
        >
          <Popup>
            <strong>{v.vessel_name || 'Unknown Vessel'}</strong>
            <br />
            MMSI: {v.mmsi}
            <br />
            Speed: {v.speed_over_ground ?? '-'} kn
            <br />
            Course: {v.course_over_ground ?? '-'}°
            <br />
            Status: {getStatusLabel(v.nav_status)}
            <br />
            Watchlist: {watchlist.has(v.mmsi) ? 'Yes' : 'No'}
            <br />
            Alert: {v.speed_over_ground !== null && v.speed_over_ground > 35 ? 'Unusually fast' : getStatusCategory(v.nav_status) === 'underway' && (v.speed_over_ground ?? 0) < 0.5 ? 'Unexpectedly stopped' : 'None'}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
