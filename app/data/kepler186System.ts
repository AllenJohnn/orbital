export type KeplerWorld = {
  id: 'b' | 'c' | 'd' | 'e' | 'f'
  diagramRadius: number
  diagramAngle: number
  markerColor: string
  surveyed: boolean
}

// Diagram radii are for legibility and are not to scale.
export const kepler186System = {
  name: 'KEPLER-186',
  starType: 'M DWARF',
  worlds: [
    { id: 'b', diagramRadius: 0.23, diagramAngle: -2.45, markerColor: '#a6b7c8', surveyed: false },
    { id: 'c', diagramRadius: 0.37, diagramAngle: -0.95, markerColor: '#80a9be', surveyed: false },
    { id: 'd', diagramRadius: 0.51, diagramAngle: 0.2, markerColor: '#cf8969', surveyed: false },
    { id: 'e', diagramRadius: 0.67, diagramAngle: 2.1, markerColor: '#d5b789', surveyed: false },
    { id: 'f', diagramRadius: 0.84, diagramAngle: 3.38, markerColor: '#f0bb75', surveyed: true }
  ] satisfies KeplerWorld[]
}
