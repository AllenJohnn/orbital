import type { System } from '~/types/atlas'

// Physical values are a checked snapshot from NASA Exoplanet Archive's
// Planetary Systems Composite Parameters table. Diagram positions are editorial.
export const kepler186: System = {
  slug: 'kepler-186',
  name: 'KEPLER-186',
  missionNo: 1,
  starType: 'M DWARF',
  starColor: '#e5a35c',
  starRadiusSolar: 0.52,
  distanceLY: 579.3,
  discoveredYear: 2014,
  habitableZone: null,
  status: 'SURVEYED',
  atlasPosition: { x: 0, y: 0, z: 0 },
  intro: 'A quiet red dwarf system. One world has a completed visual survey.',
  planets: [
    {
      id: 'b', name: 'Kepler-186b', radiusEarth: 1.07, massEarth: 1.24,
      periodDays: 3.8867907, distanceAU: 0.0343, equilibriumTempK: 571,
      worldType: 'UNKNOWN', inHabitableZone: false, surveyed: false,
      blurb: 'A compact inner orbit around the system’s red dwarf. Surface conditions remain unknown.',
      nasaUrl: 'https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-186%20b',
      diagramRadius: 0.23, diagramAngle: -2.45, markerColor: '#a6b7c8'
    },
    {
      id: 'c', name: 'Kepler-186c', radiusEarth: 1.25, massEarth: 2.1,
      periodDays: 7.267302, distanceAU: 0.0451, equilibriumTempK: 464,
      worldType: 'UNKNOWN', inHabitableZone: false, surveyed: false,
      blurb: 'A close-in world with a short year. Surface conditions remain unknown.',
      nasaUrl: 'https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-186%20c',
      diagramRadius: 0.37, diagramAngle: -0.95, markerColor: '#80a9be'
    },
    {
      id: 'd', name: 'Kepler-186d', radiusEarth: 1.4, massEarth: 2.54,
      periodDays: 13.342996, distanceAU: 0.0781, equilibriumTempK: 379,
      worldType: 'UNKNOWN', inHabitableZone: false, surveyed: false,
      blurb: 'One of five known planets in the Kepler-186 system. Surface conditions remain unknown.',
      nasaUrl: 'https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-186%20d',
      diagramRadius: 0.51, diagramAngle: 0.2, markerColor: '#cf8969'
    },
    {
      id: 'e', name: 'Kepler-186e', radiusEarth: 1.27, massEarth: 2.15,
      periodDays: 22.407704, distanceAU: 0.11, equilibriumTempK: 319,
      worldType: 'UNKNOWN', inHabitableZone: false, surveyed: false,
      blurb: 'A farther orbit in the inner planetary system. Surface conditions remain unknown.',
      nasaUrl: 'https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-186%20e',
      diagramRadius: 0.67, diagramAngle: 2.1, markerColor: '#d5b789'
    },
    {
      id: 'f', name: 'Kepler-186f', radiusEarth: 1.17, massEarth: 1.71,
      periodDays: 129.9441, distanceAU: 0.432, equilibriumTempK: 177,
      worldType: 'SUPER-EARTH', inHabitableZone: true, surveyed: true,
      blurb: 'The first surveyed world in the system, orbiting within its star’s habitable zone. This procedural artist’s impression does not represent known surface conditions.',
      nasaUrl: 'https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-186%20f',
      diagramRadius: 0.84, diagramAngle: 3.38, markerColor: '#f0bb75',
      visual: {
        palette: ['#172331', '#b28b61', '#d86e43'], oceanLevel: 0.48,
        cloudCover: 0.42, iceAmount: 0.12, atmosphereColor: '#6a9dff',
        atmosphereThickness: 1, cityLights: false, hasMoon: true,
        axialTiltDeg: 15, rotationSpeed: 1
      }
    }
  ]
}
