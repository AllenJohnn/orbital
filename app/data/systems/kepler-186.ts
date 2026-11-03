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
  habitableZone: { innerAU: 0.36, outerAU: 0.53, diagramInnerRadius: 0.74, diagramOuterRadius: 0.94 },
  status: 'SURVEYED',
  atlasPosition: { x: 0, y: 0, z: 0 },
  intro: 'A quiet red dwarf system. One world has a completed visual survey.',
  planets: [
    {
      id: 'f', name: 'Kepler-186f', radiusEarth: 1.17, massEarth: 1.71,
      periodDays: 129.9441, distanceAU: 0.432, equilibriumTempK: 177,
      worldType: 'SUPER-EARTH', inHabitableZone: true, surveyed: true,
      blurb: 'The first surveyed world in the system, orbiting within its star’s habitable zone. This procedural artist’s impression does not represent known surface conditions.',
      nasaUrl: 'https://exoplanetarchive.ipac.caltech.edu/overview/Kepler-186%20f',
      diagramRadius: 0.84, diagramAngle: 3.38, markerColor: '#f0bb75',
      visual: {
        palette: ['#1a1714', '#998059', '#732e1a'],
        oceanLevel: 0.55,
        cloudCover: 0.55,
        iceAmount: 0.35,
        atmosphereColor: '#6a9dff',
        atmosphereThickness: 1,
        cityLights: false,
        hasMoon: true,
        axialTiltDeg: 15,
        rotationSpeed: 1
      }
    }
  ]
}
