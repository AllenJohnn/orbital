import { kepler186 } from './kepler-186'
import { trappist1 } from './trappist-1'
import type { Planet, System } from '~/types/atlas'

export const systems: System[] = [kepler186, trappist1]

export const getSystem = (slug: string): System | undefined =>
  systems.find((system) => system.slug === slug)

export const getPlanet = (slug: string, id: string): Planet | undefined =>
  getSystem(slug)?.planets.find((planet) => planet.id === id)

export const nextSystem = (slug: string): System | undefined => {
  const index = systems.findIndex((system) => system.slug === slug)
  return index >= 0 && index < systems.length - 1 ? systems[index + 1] : undefined
}

export const prevSystem = (slug: string): System | undefined => {
  const index = systems.findIndex((system) => system.slug === slug)
  return index > 0 ? systems[index - 1] : undefined
}
