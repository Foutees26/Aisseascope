export type StatusCategory =
  | 'underway'
  | 'anchored'
  | 'moored'
  | 'fishing'
  | 'not_under_command'
  | 'other'

export type ShipTypeCategory =
  | 'cargo'
  | 'tanker'
  | 'fishing'
  | 'passenger'
  | 'military'
  | 'other'
  | 'unknown'

export type Port = {
  name: string
  country: string
  latitude: number
  longitude: number
}

export type PilotPort = {
  key: 'killybegs' | 'sligo'
  name: string
  latitude: number
  longitude: number
  chartedDepthMeters: number
  boardingLatitude: number
  boardingLongitude: number
}

export const PORTS: Port[] = [
  { name: 'Killybegs Harbour', country: 'IE', latitude: 54.633, longitude: -8.449 },
  { name: 'Sligo Harbour', country: 'IE', latitude: 54.267, longitude: -8.47 },
  { name: 'Galway Harbour', country: 'IE', latitude: 53.2714, longitude: -9.0489 },
  { name: 'Dublin Port', country: 'IE', latitude: 53.3462, longitude: -6.1952 },
  { name: 'Port of Cork', country: 'IE', latitude: 51.8985, longitude: -8.4654 },
  { name: 'Shannon Foynes Port', country: 'IE', latitude: 52.6136, longitude: -9.1093 },
  { name: 'Belfast Harbour', country: 'UK', latitude: 54.617, longitude: -5.888 },
  { name: 'Port of Los Angeles', country: 'US', latitude: 33.7361, longitude: -118.2626 },
  { name: 'Port of Long Beach', country: 'US', latitude: 33.7542, longitude: -118.2167 },
  { name: 'Port of New York and New Jersey', country: 'US', latitude: 40.684, longitude: -74.043 },
  { name: 'Port of Rotterdam', country: 'NL', latitude: 51.9475, longitude: 4.1427 },
  { name: 'Port of Singapore', country: 'SG', latitude: 1.2644, longitude: 103.8407 },
  { name: 'Port of Shanghai', country: 'CN', latitude: 31.2304, longitude: 121.4916 },
  { name: 'Port of Busan', country: 'KR', latitude: 35.1028, longitude: 129.0403 },
  { name: 'Port of Hamburg', country: 'DE', latitude: 53.5461, longitude: 9.9661 },
  { name: 'Port of Antwerp', country: 'BE', latitude: 51.2637, longitude: 4.4003 },
  { name: 'Port of Algeciras', country: 'ES', latitude: 36.13, longitude: -5.45 },
  { name: 'Port of Piraeus', country: 'GR', latitude: 37.942, longitude: 23.6465 },
  { name: 'Port of Santos', country: 'BR', latitude: -23.9608, longitude: -46.3336 },
  { name: 'Port of Durban', country: 'ZA', latitude: -29.871, longitude: 31.026 },
  { name: 'Port of Cape Town', country: 'ZA', latitude: -33.9016, longitude: 18.4359 },
  { name: 'Port of Dubai (Jebel Ali)', country: 'AE', latitude: 25.0112, longitude: 55.0616 },
]

export const PILOT_PORTS: PilotPort[] = [
  {
    key: 'killybegs',
    name: 'Killybegs',
    latitude: 54.633,
    longitude: -8.449,
    chartedDepthMeters: 10.5,
    boardingLatitude: 54.6515,
    boardingLongitude: -8.399,
  },
  {
    key: 'sligo',
    name: 'Sligo',
    latitude: 54.267,
    longitude: -8.47,
    chartedDepthMeters: 6.2,
    boardingLatitude: 54.288,
    boardingLongitude: -8.536,
  },
]

export function getPilotPortByName(name: string): PilotPort | null {
  const normalized = name.toLowerCase()
  return PILOT_PORTS.find((p) => normalized.includes(p.name.toLowerCase())) ?? null
}

export function getStatusCategory(navStatus: string | null): StatusCategory {
  const code = Number(navStatus)

  if (code === 0 || code === 3 || code === 4 || code === 8) return 'underway'
  if (code === 1) return 'anchored'
  if (code === 5) return 'moored'
  if (code === 7) return 'fishing'
  if (code === 2 || code === 6) return 'not_under_command'
  return 'other'
}

export function getStatusLabel(navStatus: string | null): string {
  const code = Number(navStatus)
  const labels: Record<number, string> = {
    0: 'Underway using engine',
    1: 'At anchor',
    2: 'Not under command',
    3: 'Restricted manoeuvrability',
    4: 'Constrained by draught',
    5: 'Moored',
    6: 'Aground',
    7: 'Fishing',
    8: 'Underway sailing',
  }
  return Number.isFinite(code) && labels[code] ? labels[code] : 'Unknown'
}

export function getStatusColor(navStatus: string | null): string {
  const category = getStatusCategory(navStatus)
  if (category === 'underway') return '#22c55e'
  if (category === 'anchored') return '#0ea5e9'
  if (category === 'moored') return '#f59e0b'
  if (category === 'fishing') return '#a855f7'
  if (category === 'not_under_command') return '#ef4444'
  return '#94a3b8'
}

export function getShipTypeCategory(shipType: number | null): ShipTypeCategory {
  if (shipType === null || Number.isNaN(shipType)) return 'unknown'
  if (shipType >= 70 && shipType <= 79) return 'cargo'
  if (shipType >= 80 && shipType <= 89) return 'tanker'
  if (shipType === 30) return 'fishing'
  if (shipType >= 60 && shipType <= 69) return 'passenger'
  if (shipType === 35) return 'military'
  return 'other'
}

export function getShipTypeLabel(shipType: number | null): string {
  const category = getShipTypeCategory(shipType)
  if (category === 'cargo') return 'Cargo'
  if (category === 'tanker') return 'Tanker'
  if (category === 'fishing') return 'Fishing'
  if (category === 'passenger') return 'Passenger'
  if (category === 'military') return 'Military'
  if (category === 'other') return 'Other'
  return 'Unknown'
}

export function nauticalMilesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rKm = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const sLat = Math.sin(dLat / 2)
  const sLng = Math.sin(dLng / 2)
  const aa = sLat * sLat + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * sLng * sLng
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return (rKm * c) / 1.852
}

export function bearingBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const y = Math.sin(((bLng - aLng) * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180)
  const x =
    Math.cos((aLat * Math.PI) / 180) * Math.sin((bLat * Math.PI) / 180) -
    Math.sin((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.cos(((bLng - aLng) * Math.PI) / 180)
  const brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
}

export function nearestPort(latitude: number, longitude: number): { port: Port; distanceNm: number } {
  let nearest = PORTS[0]
  let bestDistance = nauticalMilesBetween(latitude, longitude, nearest.latitude, nearest.longitude)

  for (const port of PORTS) {
    const d = nauticalMilesBetween(latitude, longitude, port.latitude, port.longitude)
    if (d < bestDistance) {
      nearest = port
      bestDistance = d
    }
  }

  return { port: nearest, distanceNm: bestDistance }
}