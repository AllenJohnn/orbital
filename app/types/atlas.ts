export type StarType = 'M DWARF' | 'K DWARF' | 'G DWARF' | 'F STAR' | 'ULTRACOOL DWARF'

export type WorldType =
  | 'ROCKY'
  | 'SUPER-EARTH'
  | 'OCEAN'
  | 'DESERT'
  | 'ICE'
  | 'LAVA'
  | 'GAS GIANT'
  | 'HOT JUPITER'
  | 'MINI-NEPTUNE'
  | 'UNKNOWN'

export interface PlanetVisual {
  palette: [string, string, string]
  oceanLevel: number
  cloudCover: number
  iceAmount: number
  atmosphereColor: string
  atmosphereThickness: number
  cityLights: boolean
  hasMoon: boolean
  axialTiltDeg: number
  rotationSpeed: number
  tidallyLocked?: boolean
  lavaGlow?: number
  ringSystem?: boolean
}

export interface Planet {
  id: string
  name: string
  radiusEarth: number | null
  massEarth: number | null
  periodDays: number | null
  distanceAU: number | null
  equilibriumTempK: number | null
  worldType: WorldType
  inHabitableZone: boolean
  surveyed: boolean
  blurb: string
  nasaUrl?: string
  diagramRadius: number
  diagramAngle: number
  markerColor: string
  visual?: PlanetVisual
}

export interface System {
  slug: string
  name: string
  missionNo: number
  starType: StarType
  starColor: string
  starRadiusSolar: number | null
  distanceLY: number | null
  discoveredYear?: number
  habitableZone: {
    innerAU: number
    outerAU: number
    diagramInnerRadius?: number
    diagramOuterRadius?: number
  } | null
  planets: Planet[]
  status: 'SURVEYED' | 'SIGNAL IDENTIFIED' | 'LOCKED'
  atlasPosition: { x: number; y: number; z: number }
  intro: string
}
