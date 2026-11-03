import { kepler186 } from './kepler-186'
import type { Planet, System } from '~/types/atlas'

export const systems: System[] = [kepler186]

export const getSystem = (slug: string): System | undefined =>
  systems.find((system) => system.slug === slug)

export const getPlanet = (slug: string, id: string): Planet | undefined =>
  getSystem(slug)?.planets.find((planet) => planet.id === id)
