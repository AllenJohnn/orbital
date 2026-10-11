<template>
  <section
    class="system-scene"
    :aria-hidden="progress < 0.02"
    :inert="progress <= 0.55"
    :style="{
      opacity: progress,
      visibility: progress < 0.02 ? 'hidden' : 'visible',
      pointerEvents: progress > 0.55 ? 'auto' : 'none'
    }"
  >
    <!-- 1. Header: ORBITAL ATLAS / SYSTEM 00N on left, NEXT: <SYSTEM> → on right -->
    <header class="scene-header">
      <div class="header-eyebrow">
        ORBITAL ATLAS <span>／</span> SYSTEM 00{{ system.missionNo }}
      </div>
      <NuxtLink :to="nextLink" class="header-next-link">
        NEXT: {{ nextLabel }} →
      </NuxtLink>
    </header>

    <!-- 2. Orbit Scene: Large and Centered -->
    <div class="orbit-stage" aria-hidden="true">
      <div class="orbit-viewbox">
        <svg class="orbit-svg" viewBox="0 0 620 620">
          <defs>
            <!-- Habitable zone blur glow -->
            <filter id="hzBlur" x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            <!-- Central Star Glow -->
            <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" :stop-color="system.starColor" stop-opacity="0.6" />
              <stop offset="40%" :stop-color="system.starColor" stop-opacity="0.18" />
              <stop offset="100%" :stop-color="system.starColor" stop-opacity="0" />
            </radialGradient>
          </defs>

          <!-- Habitable Zone soft glowing band (no hard ring lines, no floating label) -->
          <path
            v-if="system.habitableZone"
            class="habitable-zone-glow"
            fill-rule="evenodd"
            :d="hzPathD"
            filter="url(#hzBlur)"
          />

          <!-- Thin orbit lines -->
          <ellipse
            v-for="world in system.planets"
            :key="`orbit-${world.id}`"
            class="orbit-track"
            cx="310"
            cy="310"
            :rx="world.diagramRadius * 280"
            :ry="world.diagramRadius * 280 * 0.72"
          />

          <!-- Central Star -->
          <circle
            class="star-glow-halo"
            cx="310"
            cy="310"
            r="32"
            fill="url(#starGlow)"
          />
          <circle
            class="star-core-dot"
            cx="310"
            cy="310"
            r="5.5"
            :style="{ fill: system.starColor }"
          />

          <!-- Planets: soft glowing orbs, orbiting slowly -->
          <g
            v-for="world in system.planets"
            :key="`planet-${world.id}`"
            class="planet-node"
            :class="{ selected: selectedWorldId === world.id }"
            role="button"
            tabindex="0"
            :aria-label="`${world.name}, ${world.worldType}`"
            :aria-pressed="selectedWorldId === world.id"
            @click="selectWorld(world.id)"
            @keydown.enter="selectWorld(world.id)"
            @keydown.space.prevent="selectWorld(world.id)"
          >
            <!-- Selected planet glow ring and letter label -->
            <template v-if="selectedWorldId === world.id">
              <circle
                :cx="getPlanetCoord(world).x"
                :cy="getPlanetCoord(world).y"
                :r="getPlanetRadius(world) + 11"
                class="selected-glow-outer"
              />
              <circle
                :cx="getPlanetCoord(world).x"
                :cy="getPlanetCoord(world).y"
                :r="getPlanetRadius(world) + 5"
                class="selected-glow-inner"
              />
              <text
                :x="getPlanetCoord(world).x + getPlanetRadius(world) + 7"
                :y="getPlanetCoord(world).y + 3.5"
                class="selected-planet-letter"
              >
                {{ world.id.toUpperCase() }}
              </text>
            </template>

            <!-- Planet Soft Halo -->
            <circle
              :cx="getPlanetCoord(world).x"
              :cy="getPlanetCoord(world).y"
              :r="getPlanetRadius(world) * (selectedWorldId === world.id ? 2.6 : 1.9)"
              class="planet-halo"
              :style="{
                fill: getPlanetColor(world),
                opacity: selectedWorldId === world.id ? 0.45 : 0.22
              }"
            />

            <!-- Planet Core Orb -->
            <circle
              :cx="getPlanetCoord(world).x"
              :cy="getPlanetCoord(world).y"
              :r="getPlanetRadius(world)"
              class="planet-core"
              :style="{
                fill: getPlanetColor(world),
                filter: selectedWorldId === world.id ? 'brightness(1.3)' : 'none'
              }"
            />
          </g>
        </svg>
      </div>

      <!-- Footnotes at the bottom of the scene -->
      <div class="scene-footnotes">
        <div v-if="system.habitableZone" class="footnote-hz">HABITABLE ZONE</div>
        <div class="footnote-diag">ORBITAL SPACING IS DIAGRAMMATIC</div>
      </div>
    </div>

    <!-- 3. Caption Block at Bottom-Left over the scene -->
    <aside class="scene-caption" aria-live="polite">
      <Transition name="caption-fade" mode="out-in">
        <div :key="selectedWorld.id" class="caption-card">
          <!-- Planet Name -->
          <h1 class="caption-title">
            {{ system.name }}<span>{{ selectedWorld.id.toUpperCase() }}</span>
          </h1>

          <!-- One line of facts as plain text (no boxes) -->
          <div class="caption-facts">
            {{ selectedWorld.worldType }} · {{ selectedWorld.periodDays ? selectedWorld.periodDays.toFixed(1) + ' d' : 'Period unconfirmed' }} · {{ selectedWorld.distanceAU ? selectedWorld.distanceAU.toFixed(3) + ' AU' : 'Distance unconfirmed' }}
          </div>

          <!-- Blurb -->
          <p class="caption-blurb">
            {{ selectedWorld.blurb }}
          </p>

          <!-- Primary Action Button or Chapter Chain Cue -->
          <div class="caption-action-row">
            <template v-if="isChapterChain">
              <button
                v-if="isFinalChapter"
                type="button"
                class="btn-return-start"
                @click="$emit('return-to-start')"
              >
                <span>End of survey. Return to start</span>
                <span class="btn-arrow">↖</span>
              </button>
              <div v-else class="scroll-continue-cue">
                <span class="cue-dot"></span>
                <span>Scroll to continue</span>
                <span class="cue-arrow">↓</span>
              </div>
            </template>
            <template v-else>
              <button
                v-if="selectedWorld.surveyed"
                type="button"
                class="btn-survey-primary"
                @click="handleBeginSurvey"
              >
                Begin survey →
              </button>
              <button
                v-else
                type="button"
                disabled
                class="btn-survey-disabled"
              >
                Survey pending
              </button>
            </template>
          </div>

          <!-- Return to this planet -->
          <button
            v-if="showReturnButton"
            type="button"
            class="btn-return-planet"
            @click="handleReturnToPlanet"
          >
            <span>↖</span> RETURN TO THIS PLANET
          </button>

          <!-- More data toggle -->
          <div class="more-data-container">
            <button
              type="button"
              class="more-data-btn"
              :aria-expanded="showMoreData"
              @click="showMoreData = !showMoreData"
            >
              {{ showMoreData ? '− Less data' : '+ More data' }}
            </button>

            <Transition name="more-data-slide">
              <div v-if="showMoreData" class="more-data-content">
                <div class="more-data-line">
                  Radius: {{ selectedWorld.radiusEarth ? selectedWorld.radiusEarth.toFixed(2) + ' R⊕' : '—' }} ·
                  Mass: {{ selectedWorld.massEarth ? selectedWorld.massEarth.toFixed(2) + ' M⊕' : '—' }} ·
                  Temp: {{ selectedWorld.equilibriumTempK ? selectedWorld.equilibriumTempK + ' K' : '—' }}
                </div>
                <a
                  v-if="selectedWorld.nasaUrl"
                  :href="selectedWorld.nasaUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="nasa-footnote-link"
                >
                  NASA Exoplanet Archive ↗
                </a>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </aside>

    <!-- 4. Planet Picker at Bottom-Right -->
    <nav class="scene-picker" aria-label="System planet selector">
      <div class="picker-count">{{ system.planets.length }} worlds · {{ surveyedCount }} surveyed</div>
      <div class="picker-letters" role="tablist">
        <div
          v-for="world in system.planets"
          :key="`picker-${world.id}`"
          class="picker-letter-wrap"
          @mouseenter="hoveredWorldId = world.id"
          @mouseleave="hoveredWorldId = null"
        >
          <!-- Tooltip on hover or focus -->
          <div
            v-if="hoveredWorldId === world.id || focusedWorldId === world.id"
            class="picker-tooltip"
            role="tooltip"
          >
            <span class="tooltip-title">{{ world.name }}</span>
            <span class="tooltip-detail">{{ world.worldType }} · {{ world.periodDays ? world.periodDays.toFixed(1) + ' d' : '—' }}</span>
          </div>

          <button
            type="button"
            role="tab"
            class="picker-letter-btn"
            :class="{ active: selectedWorldId === world.id, surveyed: world.surveyed }"
            :aria-selected="selectedWorldId === world.id"
            :aria-label="`Select planet ${world.id.toUpperCase()}`"
            @click="selectWorld(world.id)"
            @focus="focusedWorldId = world.id"
            @blur="focusedWorldId = null"
            @keydown.enter="selectWorld(world.id)"
            @keydown.space.prevent="selectWorld(world.id)"
          >
            {{ world.id }}
          </button>
        </div>
      </div>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { nextSystem } from '~/data/systems'
import type { Planet, System } from '~/types/atlas'

const props = withDefaults(
  defineProps<{
    system: System
    progress?: number
    initialWorldId?: string
    showReturnButton?: boolean
    isChapterChain?: boolean
    isFinalChapter?: boolean
  }>(),
  {
    progress: 1,
    initialWorldId: undefined,
    showReturnButton: true,
    isChapterChain: false,
    isFinalChapter: false
  }
)

const emit = defineEmits<{
  'return-to-kepler': []
  'return-to-planet': []
  'return-to-start': []
}>()

const router = useRouter()

// Selection state
const defaultWorldId = computed(() => {
  if (props.initialWorldId) {
    const found = props.system.planets.find((p) => p.id === props.initialWorldId)
    if (found) return found.id
  }
  const surveyed = props.system.planets.find((p) => p.surveyed)
  return surveyed ? surveyed.id : props.system.planets[0]?.id ?? 'b'
})

const selectedWorldId = ref(defaultWorldId.value)
const showMoreData = ref(false)
const hoveredWorldId = ref<string | null>(null)
const focusedWorldId = ref<string | null>(null)
const prefersReducedMotion = ref(false)

watch(
  () => props.initialWorldId,
  (newId) => {
    if (newId && props.system.planets.some((p) => p.id === newId)) {
      selectedWorldId.value = newId
    }
  }
)

const selectedWorld = computed(() => {
  return (
    props.system.planets.find((w) => w.id === selectedWorldId.value) ??
    props.system.planets.find((w) => w.surveyed) ??
    props.system.planets[0]!
  )
})

const surveyedCount = computed(() => props.system.planets.filter((p) => p.surveyed).length)

// Header Next Navigation
const nextSys = computed(() => nextSystem(props.system.slug))
const nextLink = computed(() => (nextSys.value ? `/system/${nextSys.value.slug}` : '/'))
const nextLabel = computed(() => (nextSys.value ? nextSys.value.name.toUpperCase() : 'KEPLER-186'))

// Slow orbital motion state
const orbitTime = ref(0)
let animFrameId: number | null = null
let lastTimestamp = 0

const animate = (timestamp: number) => {
  if (!lastTimestamp) lastTimestamp = timestamp
  const delta = (timestamp - lastTimestamp) / 1000
  lastTimestamp = timestamp

  if (!prefersReducedMotion.value) {
    orbitTime.value += delta
  }
  animFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!prefersReducedMotion.value) {
    animFrameId = requestAnimationFrame(animate)
  }
})

onBeforeUnmount(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
})

// Habitable zone calculations
const hzInnerR = computed(() => (props.system.habitableZone?.diagramInnerRadius ?? 0.74) * 280)
const hzOuterR = computed(() => (props.system.habitableZone?.diagramOuterRadius ?? 0.94) * 280)
const hzInnerRy = computed(() => hzInnerR.value * 0.72)
const hzOuterRy = computed(() => hzOuterR.value * 0.72)

const hzPathD = computed(() => {
  const rx1 = hzInnerR.value
  const ry1 = hzInnerRy.value
  const rx2 = hzOuterR.value
  const ry2 = hzOuterRy.value
  return `
    M 310,${310 - ry2}
    A ${rx2} ${ry2} 0 1 0 310,${310 + ry2}
    A ${rx2} ${ry2} 0 1 0 310,${310 - ry2}
    Z
    M 310,${310 - ry1}
    A ${rx1} ${ry1} 0 1 1 310,${310 + ry1}
    A ${rx1} ${ry1} 0 1 1 310,${310 - ry1}
    Z
  `
})

// Planet visual helpers
const getPlanetColor = (world: Planet): string => {
  if (world.visual?.palette && world.visual.palette.length > 0) {
    return world.visual.atmosphereColor ?? world.visual.palette[1] ?? world.visual.palette[0]
  }
  return world.markerColor ?? '#b7c7d7'
}

const getPlanetRadius = (world: Planet): number => {
  const r = world.radiusEarth ?? 1.0
  const clamped = Math.max(0.75, Math.min(1.4, r))
  return 5.2 * clamped
}

const getPlanetCoord = (world: Planet) => {
  const radius = world.diagramRadius * 280
  const speed = 0.016 / Math.sqrt(Math.max(0.15, world.diagramRadius))
  const angle = prefersReducedMotion.value
    ? world.diagramAngle
    : world.diagramAngle + orbitTime.value * speed
  const x = 310 + Math.cos(angle) * radius
  const y = 310 + Math.sin(angle) * radius * 0.72
  return { x, y }
}

const selectWorld = (id: string) => {
  selectedWorldId.value = id
  if (!props.isChapterChain) {
    void router.replace({ query: { ...router.currentRoute.value.query, planet: id } })
  }
}

const handleBeginSurvey = () => {
  if (props.system.slug === 'kepler-186') {
    void router.push({ path: '/', query: { planet: selectedWorld.value.id } })
    emit('return-to-planet')
    emit('return-to-kepler')
  } else {
    void router.push({ path: '/', query: { system: props.system.slug, planet: selectedWorld.value.id } })
    emit('return-to-planet')
  }
}

const handleReturnToPlanet = () => {
  emit('return-to-planet')
  emit('return-to-kepler')
}
</script>

<style scoped>
/* 100vh Full Viewport Shell — No Inner Scroll */
.system-scene {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 50%, rgb(16 24 34 / 85%), rgb(2 4 7 / 98%));
  color: #fff;
  font-family: Inter, system-ui, sans-serif;
  user-select: none;
  transition: opacity 160ms linear;
}

/* 1. Header */
.scene-header {
  position: absolute;
  top: 0;
  inset-x: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: clamp(1.2rem, 3vh, 2.2rem) clamp(1.5rem, 4vw, 3.5rem);
  pointer-events: auto;
}

.header-eyebrow {
  color: rgb(239 190 128 / 85%);
  font-size: 0.65rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.header-eyebrow span {
  color: rgb(239 190 128 / 40%);
}

.header-next-link {
  color: rgb(239 190 128 / 85%);
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 150ms ease;
}

.header-next-link:hover {
  color: #fff;
}

.header-next-link:focus-visible {
  outline: 1px solid rgb(239 190 128 / 90%);
  outline-offset: 4px;
}

/* 2. Large Centered Orbit Scene */
.orbit-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.orbit-viewbox {
  width: min(92vw, 76vh);
  height: min(92vw, 76vh);
  max-width: 820px;
  max-height: 820px;
  aspect-ratio: 1;
  position: relative;
  filter: drop-shadow(0 0 36px rgb(132 169 202 / 12%));
}

.orbit-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* Habitable Zone Soft Glow Band */
.habitable-zone-glow {
  fill: rgb(239 190 128 / 6.5%);
  pointer-events: none;
}

/* Thin Orbit Tracks */
.orbit-track {
  fill: none;
  stroke: rgb(183 201 215 / 16%);
  stroke-width: 0.7;
}

/* Central Star */
.star-glow-halo {
  filter: drop-shadow(0 0 16px rgb(255 192 112 / 60%));
}

.star-core-dot {
  filter: drop-shadow(0 0 8px rgb(255 210 140 / 95%));
}

/* Planet Interactive Nodes in SVG */
.planet-node {
  cursor: pointer;
  pointer-events: auto;
}

.planet-node:focus-visible {
  outline: none;
}

.planet-halo {
  transition: opacity 220ms ease;
  filter: blur(1.5px);
}

.planet-core {
  transition: filter 200ms ease;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
}

/* Selected Planet Highlights */
.selected-glow-outer {
  fill: none;
  stroke: rgb(239 190 128 / 25%);
  stroke-width: 1;
  animation: pulseOuter 3s ease-in-out infinite;
}

.selected-glow-inner {
  fill: none;
  stroke: rgb(239 190 128 / 75%);
  stroke-width: 1.2;
}

.selected-planet-letter {
  fill: rgb(248 208 152 / 100%);
  font-family: Georgia, serif;
  font-size: 8.5px;
  font-style: italic;
  font-weight: 500;
  text-anchor: start;
  pointer-events: none;
}

@keyframes pulseOuter {
  0%, 100% { stroke-opacity: 0.2; transform: scale(1); }
  50% { stroke-opacity: 0.45; }
}

/* Footnotes at Bottom of Scene */
.scene-footnotes {
  position: absolute;
  bottom: clamp(1rem, 2.5vh, 2rem);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  pointer-events: none;
  text-align: center;
  z-index: 5;
}

.footnote-hz {
  color: rgb(239 190 128 / 65%);
  font-size: 0.5rem;
  letter-spacing: 0.24em;
  font-weight: 500;
  text-transform: uppercase;
}

.footnote-diag {
  color: rgb(220 228 235 / 35%);
  font-size: 0.46rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

/* 3. Caption Block at Bottom-Left */
.scene-caption {
  position: absolute;
  left: clamp(1.5rem, 4vw, 3.5rem);
  bottom: clamp(1.5rem, 4vw, 3.5rem);
  max-width: min(440px, 92vw);
  z-index: 10;
  pointer-events: auto;
}

.caption-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.caption-title {
  margin: 0;
  color: rgb(248 247 244 / 96%);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(2.2rem, 3.8vw, 3.4rem);
  font-weight: 400;
  letter-spacing: -0.04em;
  line-height: 1;
}

.caption-title span {
  color: rgb(239 190 128 / 88%);
  font-style: italic;
  margin-left: 0.2rem;
}

.caption-facts {
  color: rgb(220 228 235 / 55%);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.caption-blurb {
  margin: 0;
  color: rgb(220 228 235 / 75%);
  font-size: clamp(0.82rem, 1.2vw, 0.92rem);
  line-height: 1.6;
  max-width: 400px;
}

.caption-action-row {
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.btn-survey-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.4rem;
  background: rgb(239 190 128 / 16%);
  border: 1px solid rgb(239 190 128 / 65%);
  color: rgb(255 244 224 / 96%);
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 160ms ease;
  border-radius: 2px;
  box-shadow: 0 0 16px rgb(239 190 128 / 15%);
}

.btn-survey-primary:hover {
  background: rgb(239 190 128 / 28%);
  border-color: rgb(239 190 128 / 95%);
  color: #fff;
  box-shadow: 0 0 24px rgb(239 190 128 / 32%);
}

.btn-survey-primary:focus-visible {
  outline: 2px solid rgb(239 190 128 / 90%);
  outline-offset: 3px;
}

.btn-survey-disabled {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.4rem;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 12%);
  color: rgb(220 228 235 / 40%);
  font-size: 0.64rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  border-radius: 2px;
  cursor: not-allowed;
}

/* Scroll To Continue Cue */
.scroll-continue-cue {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.65rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgb(239 190 128 / 85%);
  padding: 0.5rem 0;
}

.cue-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: rgb(239 190 128 / 90%);
  box-shadow: 0 0 8px rgb(239 190 128 / 90%);
  animation: cuePulse 2s ease-in-out infinite;
}

.cue-arrow {
  animation: cueBounce 1.8s ease-in-out infinite;
}

@keyframes cuePulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.15); }
}

@keyframes cueBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}

/* Final Chapter: Return to Start */
.btn-return-start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 0.65rem 1.4rem;
  background: rgb(239 190 128 / 18%);
  border: 1px solid rgb(239 190 128 / 75%);
  color: rgb(255 244 224 / 96%);
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 160ms ease;
  border-radius: 2px;
  box-shadow: 0 0 16px rgb(239 190 128 / 20%);
}

.btn-return-start:hover {
  background: rgb(239 190 128 / 32%);
  border-color: rgb(239 190 128 / 100%);
  color: #fff;
  box-shadow: 0 0 24px rgb(239 190 128 / 40%);
}

.btn-return-start:focus-visible {
  outline: 2px solid rgb(239 190 128 / 90%);
  outline-offset: 3px;
}

/* Return to This Planet Button */
.btn-return-planet {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: rgb(239 190 128 / 75%);
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 0;
  transition: color 150ms ease;
  margin-top: 0.15rem;
}

.btn-return-planet:hover {
  color: #fff;
}

.btn-return-planet:focus-visible {
  outline: 1px solid rgb(239 190 128 / 90%);
  outline-offset: 3px;
}

/* More Data Section */
.more-data-container {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.more-data-btn {
  align-self: flex-start;
  padding: 0;
  background: none;
  border: none;
  color: rgb(239 190 128 / 70%);
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 150ms ease;
}

.more-data-btn:hover {
  color: rgb(255 235 200 / 100%);
}

.more-data-btn:focus-visible {
  outline: 1px solid rgb(239 190 128 / 90%);
  outline-offset: 3px;
}

.more-data-content {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.more-data-line {
  color: rgb(220 228 235 / 55%);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
}

.nasa-footnote-link {
  color: rgb(239 190 128 / 65%);
  font-size: 0.54rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 140ms ease;
}

.nasa-footnote-link:hover {
  color: #fff;
}

.nasa-footnote-link:focus-visible {
  outline: 1px solid rgb(239 190 128 / 90%);
  outline-offset: 3px;
}

/* 4. Planet Picker at Bottom-Right */
.scene-picker {
  position: absolute;
  right: clamp(1.5rem, 4vw, 3.5rem);
  bottom: clamp(1.5rem, 4vw, 3.5rem);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  pointer-events: auto;
}

.picker-count {
  color: rgb(220 228 235 / 45%);
  font-size: 0.54rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.picker-letters {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.picker-letter-wrap {
  position: relative;
}

.picker-letter-btn {
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: rgb(15 22 31 / 75%);
  border: 1px solid rgb(220 228 235 / 16%);
  color: rgb(220 228 235 / 65%);
  font-family: Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  text-transform: lowercase;
  cursor: pointer;
  transition: all 160ms ease;
}

.picker-letter-btn:hover {
  background: rgb(22 33 46 / 90%);
  border-color: rgb(220 228 235 / 35%);
  color: #fff;
}

.picker-letter-btn.surveyed {
  border-color: rgb(239 190 128 / 38%);
}

.picker-letter-btn.active {
  background: rgb(239 190 128 / 22%);
  border-color: rgb(239 190 128 / 90%);
  color: #fff;
  box-shadow: 0 0 14px rgb(239 190 128 / 35%);
}

.picker-letter-btn:focus-visible {
  outline: 2px solid rgb(239 190 128 / 90%);
  outline-offset: 3px;
}

/* Tooltip */
.picker-tooltip {
  position: absolute;
  bottom: calc(100% + 0.65rem);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  background: rgb(10 16 23 / 95%);
  border: 1px solid rgb(239 190 128 / 35%);
  padding: 0.4rem 0.65rem;
  border-radius: 3px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 30;
  box-shadow: 0 4px 18px rgb(0 0 0 / 70%);
}

.tooltip-title {
  color: #fff;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.tooltip-detail {
  color: rgb(220 228 235 / 55%);
  font-size: 0.52rem;
  letter-spacing: 0.08em;
}

/* Smooth Transitions */
.caption-fade-enter-active,
.caption-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.caption-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.caption-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.more-data-slide-enter-active,
.more-data-slide-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.more-data-slide-enter-from,
.more-data-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Responsive Overrides (100vh constraint maintained) */
@media (max-width: 768px) {
  .scene-header {
    padding: 1rem 1.2rem;
  }

  .orbit-viewbox {
    width: min(86vw, 42vh);
    height: min(86vw, 42vh);
    transform: translateY(-4vh);
  }

  .scene-caption {
    left: 1.2rem;
    right: 1.2rem;
    bottom: 4.8rem;
    max-width: calc(100% - 2.4rem);
  }

  .caption-title {
    font-size: 2.1rem;
  }

  .caption-facts {
    font-size: 0.64rem;
  }

  .caption-blurb {
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .scene-picker {
    left: 1.2rem;
    right: 1.2rem;
    bottom: 1rem;
    align-items: center;
  }

  .picker-count {
    font-size: 0.48rem;
  }

  .picker-letter-btn {
    width: 1.85rem;
    height: 1.85rem;
    font-size: 0.85rem;
  }
}

/* Reduced Motion Mode */
@media (prefers-reduced-motion: reduce) {
  .system-scene,
  .caption-fade-enter-active,
  .caption-fade-leave-active,
  .more-data-slide-enter-active,
  .more-data-slide-leave-active,
  .picker-letter-btn,
  .btn-survey-primary,
  .btn-return-start,
  .cue-dot,
  .cue-arrow,
  .selected-glow-outer {
    transition: none !important;
    animation: none !important;
  }
}
</style>
