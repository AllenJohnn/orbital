<template>
  <section
    class="system-map fixed inset-0 z-20 text-white"
    :aria-hidden="progress < 0.02"
    :inert="progress <= 0.55"
    :style="{ opacity: progress, visibility: progress < 0.02 ? 'hidden' : 'visible' }"
  >
    <div class="map-shell" :style="{ pointerEvents: progress > 0.55 ? 'auto' : 'none' }">
      <!-- Header -->
      <header class="map-header">
        <div class="header-left">
          <span class="eyebrow">ORBITAL ATLAS <span>／</span> SYSTEM 00{{ system.missionNo }}</span>
          <span class="system-star-badge" :style="{ '--star-color': system.starColor }">
            <span class="star-dot"></span>
            {{ system.starType }}
          </span>
        </div>

        <div class="header-nav">
          <NuxtLink
            v-if="system.slug === 'kepler-186'"
            to="/system/trappist-1"
            class="sys-nav-link"
          >
            NEXT SYSTEM: TRAPPIST-1 <span>→</span>
          </NuxtLink>
          <NuxtLink
            v-else
            to="/"
            class="sys-nav-link"
          >
            <span>←</span> BACK TO KEPLER-186
          </NuxtLink>
        </div>
      </header>

      <!-- Main Stage -->
      <main class="map-content">
        <!-- 1. Centered & Enlarged Orbit Map -->
        <div class="orbit-stage">
          <div
            class="orbit-field"
            role="group"
            :aria-label="`Diagram of the ${system.planets.length} known ${system.name} planets`"
          >
            <svg class="orbit-lines" viewBox="0 0 620 620" aria-hidden="true">
              <!-- Subtle shaded habitable zone band -->
              <path
                v-if="system.habitableZone"
                class="habitable-band"
                fill-rule="evenodd"
                :d="hzPathD"
              />
              <ellipse
                v-if="system.habitableZone"
                class="habitable-edge inner"
                cx="310"
                cy="310"
                :rx="hzInnerR"
                :ry="hzInnerRy"
              />
              <ellipse
                v-if="system.habitableZone"
                class="habitable-edge outer"
                cx="310"
                cy="310"
                :rx="hzOuterR"
                :ry="hzOuterRy"
              />
              <text
                v-if="system.habitableZone"
                class="habitable-band-label"
                x="310"
                :y="310 - hzOuterRy - 6"
                text-anchor="middle"
              >HABITABLE ZONE</text>

              <!-- Planetary orbit tracks -->
              <ellipse
                v-for="world in system.planets"
                :key="`orbit-${world.id}`"
                class="orbit-line"
                cx="310"
                cy="310"
                :rx="world.diagramRadius * 280"
                :ry="world.diagramRadius * 280 * 0.72"
              />

              <!-- Central Star -->
              <circle
                class="star-halo"
                cx="310"
                cy="310"
                r="30"
                :style="{ fill: system.starColor + '18', stroke: system.starColor + '44' }"
              />
              <circle
                class="star-core"
                cx="310"
                cy="310"
                r="6"
                :style="{ fill: system.starColor }"
              />
            </svg>

            <!-- Planet Interactive Markers -->
            <button
              v-for="world in system.planets"
              :key="world.id"
              type="button"
              class="world-marker"
              :class="{ selected: selectedWorldId === world.id, surveyed: world.surveyed }"
              :style="{
                ...worldPosition(world),
                '--dot-scale': dotScale(world)
              }"
              :aria-label="`${system.name}${world.id.toUpperCase()}, ${world.surveyed ? 'survey complete' : 'survey not yet available'}`"
              :aria-pressed="selectedWorldId === world.id"
              :title="`${system.name}${world.id.toUpperCase()}`"
              @click="selectedWorldId = world.id"
            >
              <span class="marker-dot" :style="{ '--marker-color': world.markerColor }"></span>
              <span class="marker-label">
                <span class="world-letter">{{ world.id.toUpperCase() }}</span>
                <span v-if="world.periodDays" class="world-period-tag">· {{ world.periodDays.toFixed(1) }} d</span>
              </span>
            </button>

            <!-- Star & HZ Annotations -->
            <div class="star-label" :style="{ '--star-color': system.starColor }">
              {{ system.name }} <span>{{ system.starType }}</span>
            </div>
            <div class="diagram-note">
              ORBITAL SPACING IS DIAGRAMMATIC
            </div>
          </div>
        </div>

        <!-- 2. Selected Planet Details Panel -->
        <aside class="world-profile" aria-live="polite">
          <div class="profile-header">
            <span class="profile-tag" :class="selectedWorld.surveyed ? 'tag-surveyed' : 'tag-unsurveyed'">
              {{ selectedWorld.surveyed ? 'SURVEY COMPLETE' : 'SIGNAL IDENTIFIED' }}
            </span>
            <span class="profile-meta">
              {{ selectedWorld.inHabitableZone ? 'HABITABLE ZONE WORLD' : 'OUTER / INNER BOUNDARY' }}
            </span>
          </div>

          <h1 class="world-title">
            {{ system.name }}<span>{{ selectedWorld.id.toUpperCase() }}</span>
          </h1>

          <p class="profile-copy">
            {{ selectedWorld.blurb }}
          </p>

          <!-- Larger, easy-to-read stats grid -->
          <dl class="world-stats-grid">
            <div class="stat-card">
              <dt>WORLD TYPE</dt>
              <dd>{{ selectedWorld.worldType }}</dd>
            </div>
            <div class="stat-card">
              <dt>ORBITAL PERIOD</dt>
              <dd>{{ selectedWorld.periodDays ? selectedWorld.periodDays.toFixed(1) + ' d' : 'UNKNOWN' }}</dd>
            </div>
            <div class="stat-card">
              <dt>SEMI-MAJOR AXIS</dt>
              <dd>{{ selectedWorld.distanceAU ? selectedWorld.distanceAU.toFixed(3) + ' AU' : 'UNKNOWN' }}</dd>
            </div>
            <div class="stat-card">
              <dt>PLANETARY RADIUS</dt>
              <dd>{{ selectedWorld.radiusEarth ? selectedWorld.radiusEarth.toFixed(2) + ' R⊕' : 'UNKNOWN' }}</dd>
            </div>
            <div class="stat-card">
              <dt>ESTIMATED MASS</dt>
              <dd>{{ selectedWorld.massEarth ? selectedWorld.massEarth.toFixed(2) + ' M⊕' : 'UNKNOWN' }}</dd>
            </div>
            <div class="stat-card">
              <dt>EQUILIBRIUM TEMP</dt>
              <dd>{{ selectedWorld.equilibriumTempK ? selectedWorld.equilibriumTempK + ' K' : 'UNKNOWN' }}</dd>
            </div>
          </dl>

          <!-- Action Buttons -->
          <div class="profile-actions">
            <!-- Survey Button -->
            <button
              v-if="selectedWorld.surveyed"
              type="button"
              class="action-btn-primary"
              @click="handleBeginSurvey"
            >
              <span>BEGIN SURVEY</span>
              <span class="btn-arrow">→</span>
            </button>
            <div v-else class="action-btn-disabled">
              <span>SURVEY NOT YET AVAILABLE</span>
            </div>

            <!-- Return button (when scroll-driven return is supported) -->
            <button
              v-if="showReturnButton"
              class="return-button"
              type="button"
              @click="$emit('return-to-kepler')"
            >
              <span>↖</span> RETURN TO KEPLER-186F
            </button>

            <!-- NASA Catalog Link -->
            <a
              v-if="selectedWorld.nasaUrl"
              class="source-link"
              :href="selectedWorld.nasaUrl"
              target="_blank"
              rel="noreferrer"
            >
              NASA EXOPLANET ARCHIVE ↗
            </a>
          </div>
        </aside>
      </main>

      <!-- 3. Bottom Row of Planet Cards -->
      <nav class="planet-cards-wrapper" aria-label="System planets carousel">
        <div class="planet-cards-row" role="tablist">
          <button
            v-for="world in system.planets"
            :key="`card-${world.id}`"
            type="button"
            role="tab"
            class="planet-card"
            :class="{ selected: selectedWorldId === world.id, surveyed: world.surveyed }"
            :aria-selected="selectedWorldId === world.id"
            tabindex="0"
            @click="selectedWorldId = world.id"
            @keydown.enter.prevent="selectedWorldId = world.id"
            @keydown.space.prevent="selectedWorldId = world.id"
          >
            <div class="card-head">
              <span class="card-marker-dot" :style="{ backgroundColor: world.markerColor }"></span>
              <span class="card-letter">{{ world.id.toUpperCase() }}</span>
              <span
                class="card-status-pill"
                :class="world.surveyed ? 'pill-surveyed' : 'pill-unsurveyed'"
              >
                {{ world.surveyed ? 'Surveyed' : 'Not surveyed' }}
              </span>
            </div>
            <div class="card-type">{{ world.worldType }}</div>
            <div class="card-period">
              <span class="period-num">{{ world.periodDays ? world.periodDays.toFixed(1) : '—' }}</span>
              <span class="period-lbl">DAYS</span>
            </div>
          </button>
        </div>
      </nav>

      <!-- Footer aligned to grid -->
      <footer class="map-footer">
        <div class="footer-grid">
          <div class="footer-col">
            <span class="stat-label">SYSTEM WORLDS</span>
            <span class="stat-value">{{ system.planets.length }} KNOWN</span>
          </div>
          <div class="footer-col">
            <span class="stat-label">SURVEY STATUS</span>
            <span class="stat-value">{{ surveyedCount }} SURVEYED</span>
          </div>
          <div class="footer-col">
            <span class="stat-label">STELLAR DISTANCE</span>
            <span class="stat-value">{{ system.distanceLY ? system.distanceLY + ' LY' : 'UNMAPPED' }}</span>
          </div>
          <div class="footer-col nav-col">
            <NuxtLink
              v-if="system.slug === 'kepler-186'"
              to="/system/trappist-1"
              class="footer-link"
            >
              NEXT MISSION: TRAPPIST-1 ↗
            </NuxtLink>
            <NuxtLink
              v-else
              to="/"
              class="footer-link"
            >
              ← RETURN TO KEPLER-186
            </NuxtLink>
          </div>
        </div>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Planet, System } from '~/types/atlas'

const props = withDefaults(
  defineProps<{
    system: System
    progress?: number
    initialWorldId?: string
    showReturnButton?: boolean
  }>(),
  {
    progress: 1,
    initialWorldId: undefined,
    showReturnButton: true
  }
)

const emit = defineEmits<{
  'return-to-kepler': []
}>()

const router = useRouter()

const defaultWorldId = computed(() => {
  if (props.initialWorldId) {
    const found = props.system.planets.find((p) => p.id === props.initialWorldId)
    if (found) return found.id
  }
  const surveyed = props.system.planets.find((p) => p.surveyed)
  return surveyed ? surveyed.id : props.system.planets[0]?.id ?? 'b'
})

const selectedWorldId = ref(defaultWorldId.value)

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
    props.system.planets.find((world) => world.id === selectedWorldId.value) ??
    props.system.planets.find((world) => world.surveyed) ??
    props.system.planets[0]!
  )
})

const surveyedCount = computed(() => props.system.planets.filter((p) => p.surveyed).length)

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

const dotScale = (world: Planet) => {
  const r = world.radiusEarth ?? 1.0
  return Math.max(0.75, Math.min(1.4, r)).toFixed(2)
}

const worldPosition = (world: Planet) => {
  const radius = world.diagramRadius * 280
  const angle = world.diagramAngle
  const x = 310 + Math.cos(angle) * radius
  const y = 310 + Math.sin(angle) * radius * 0.72
  return {
    left: `${((x / 620) * 100).toFixed(4)}%`,
    top: `${((y / 620) * 100).toFixed(4)}%`
  }
}

const handleBeginSurvey = () => {
  if (props.system.slug === 'kepler-186') {
    void router.push({ path: '/', query: { planet: selectedWorld.value.id } })
    emit('return-to-kepler')
  } else {
    // For TRAPPIST-1 or other surveyed systems, placeholder survey route
    void router.push({ path: `/system/${props.system.slug}`, query: { planet: selectedWorld.value.id } })
  }
}
</script>

<style scoped>
.system-map {
  background:
    radial-gradient(ellipse at 50% 50%, rgb(18 25 35 / 75%), transparent 68%),
    linear-gradient(180deg, rgb(3 5 8 / 92%), rgb(3 5 8 / 65%) 40%, rgb(3 5 8 / 95%));
  transition: opacity 160ms linear;
  font-family: Inter, system-ui, sans-serif;
  overflow-y: auto;
}

.map-shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(1rem, 2.5vw, 2.5rem) clamp(1.2rem, 4vw, 4rem);
  gap: 1.25rem;
}

/* Header */
.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid rgb(223 231 239 / 10%);
  padding-bottom: 0.85rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.eyebrow {
  color: rgb(239 190 128 / 85%);
  font-size: 0.65rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.eyebrow span {
  color: rgb(239 190 128 / 40%);
}

.system-star-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: rgb(225 231 236 / 75%);
  font-size: 0.58rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.star-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background-color: var(--star-color, #efbe80);
  box-shadow: 0 0 8px var(--star-color, #efbe80);
}

.sys-nav-link {
  color: rgb(239 190 128 / 90%);
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 150ms ease, transform 150ms ease;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.sys-nav-link:hover {
  color: #fff;
}

/* Main stage */
.map-content {
  width: 100%;
  max-width: 1360px;
  margin: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
  align-items: center;
  gap: clamp(1.5rem, 4vw, 4.5rem);
}

/* Orbit stage */
.orbit-stage {
  display: flex;
  justify-content: center;
  align-items: center;
}

.orbit-field {
  position: relative;
  width: min(100%, 58vw, 56vh);
  aspect-ratio: 1;
  filter: drop-shadow(0 0 32px rgb(132 169 202 / 10%));
}

.orbit-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.orbit-line {
  fill: none;
  stroke: rgb(183 201 215 / 24%);
  stroke-width: 0.8;
}

/* Habitable zone shaded band */
.habitable-band {
  fill: rgb(239 190 128 / 5.5%);
}

.habitable-edge {
  fill: none;
  stroke: rgb(239 190 128 / 22%);
  stroke-width: 0.9;
  stroke-dasharray: 2 6;
}

.star-core {
  filter: drop-shadow(0 0 10px rgb(255 192 112 / 95%));
}

/* Planet Markers */
.world-marker {
  position: absolute;
  z-index: 2;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
}

.world-marker:focus-visible {
  outline: 1px solid rgb(246 204 142 / 90%);
  outline-offset: 4px;
}

.marker-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(0.48rem * var(--dot-scale, 1));
  height: calc(0.48rem * var(--dot-scale, 1));
  border: 1px solid color-mix(in srgb, var(--marker-color), white 40%);
  border-radius: 50%;
  background: var(--marker-color);
  box-shadow: 0 0 10px color-mix(in srgb, var(--marker-color), transparent 40%);
  transform: translate(-50%, -50%);
  transition: width 180ms ease, height 180ms ease, box-shadow 180ms ease;
}

.surveyed .marker-dot {
  width: calc(0.72rem * var(--dot-scale, 1));
  height: calc(0.72rem * var(--dot-scale, 1));
}

.selected .marker-dot {
  width: calc(0.85rem * var(--dot-scale, 1));
  height: calc(0.85rem * var(--dot-scale, 1));
  box-shadow:
    0 0 0 4px rgb(239 190 128 / 20%),
    0 0 0 8px rgb(239 190 128 / 8%),
    0 0 22px rgb(239 190 128 / 90%);
}

.marker-label {
  position: absolute;
  top: 50%;
  left: calc(50% + 0.9rem);
  transform: translateY(-50%);
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  white-space: nowrap;
  pointer-events: none;
}

.world-letter {
  color: rgb(240 244 248 / 88%);
  font-family: Georgia, serif;
  font-size: 0.8rem;
  font-style: italic;
  text-transform: uppercase;
}

.world-period-tag {
  color: rgb(220 227 234 / 52%);
  font-size: 0.52rem;
  letter-spacing: 0.08em;
}

.selected .world-letter {
  color: rgb(248 208 152 / 100%);
}

.star-label {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: rgb(255 231 190 / 90%);
  font-size: 0.56rem;
  letter-spacing: 0.16em;
  text-align: center;
  transform: translate(-50%, 2.4rem);
  white-space: nowrap;
}

.star-label span {
  color: rgb(255 231 190 / 50%);
  font-size: 0.46rem;
}

.habitable-band-label {
  fill: rgb(239 190 128 / 75%);
  font-size: 7.5px;
  font-family: Inter, system-ui, sans-serif;
  letter-spacing: 0.22em;
  font-weight: 500;
  text-transform: uppercase;
  pointer-events: none;
}

.diagram-note {
  position: absolute;
  right: 0%;
  bottom: 0%;
  color: rgb(224 231 236 / 40%);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
}

/* Details Panel */
.world-profile {
  max-width: 440px;
  padding: 1.25rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.profile-tag {
  font-size: 0.6rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: 2px;
}

.tag-surveyed {
  color: rgb(239 190 128 / 95%);
  background: rgb(239 190 128 / 12%);
  border: 1px solid rgb(239 190 128 / 30%);
}

.tag-unsurveyed {
  color: rgb(180 195 210 / 65%);
  background: rgb(180 195 210 / 8%);
  border: 1px solid rgb(180 195 210 / 18%);
}

.profile-meta {
  color: rgb(220 228 235 / 45%);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.world-title {
  margin: 0;
  color: rgb(248 247 244 / 96%);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(2.4rem, 4.5vw, 4rem);
  font-weight: 400;
  letter-spacing: -0.05em;
  line-height: 1;
}

.world-title span {
  color: rgb(239 190 128 / 88%);
  font-style: italic;
  margin-left: 0.15rem;
}

.profile-copy {
  margin: 0;
  color: rgb(220 228 235 / 72%);
  font-size: 0.88rem;
  line-height: 1.65;
}

/* Stats Grid */
.world-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0.85rem 0;
  border-top: 1px solid rgb(223 231 239 / 14%);
  border-bottom: 1px solid rgb(223 231 239 / 14%);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: rgb(16 23 32 / 40%);
  padding: 0.5rem 0.6rem;
  border: 1px solid rgb(223 231 239 / 8%);
  border-radius: 2px;
}

.stat-card dt {
  color: rgb(223 231 239 / 48%);
  font-size: 0.46rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.stat-card dd {
  margin: 0;
  color: rgb(247 246 242 / 94%);
  font-size: 0.76rem;
  letter-spacing: 0.05em;
  font-weight: 500;
  white-space: nowrap;
}

/* Actions */
.profile-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 0.75rem 1.4rem;
  background: rgb(239 190 128 / 16%);
  border: 1px solid rgb(239 190 128 / 60%);
  color: rgb(255 240 216 / 96%);
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 160ms ease;
  border-radius: 2px;
}

.action-btn-primary:hover {
  background: rgb(239 190 128 / 28%);
  border-color: rgb(239 190 128 / 90%);
  color: #fff;
}

.action-btn-primary:focus-visible {
  outline: 2px solid rgb(239 190 128 / 90%);
  outline-offset: 3px;
}

.action-btn-disabled {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.4rem;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 10%);
  color: rgb(220 228 235 / 42%);
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  border-radius: 2px;
}

.return-button {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0;
  border: 0;
  color: rgb(247 246 242 / 85%);
  background: transparent;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  cursor: pointer;
}

.return-button span {
  color: rgb(239 190 128 / 90%);
  transition: transform 180ms ease;
}

.return-button:hover span {
  transform: translate(-3px, -3px);
}

.return-button:focus-visible,
.source-link:focus-visible {
  outline: 1px solid rgb(246 204 142 / 90%);
  outline-offset: 4px;
}

.source-link {
  color: rgb(239 190 128 / 70%);
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 150ms ease;
}

.source-link:hover {
  color: rgb(255 231 190 / 100%);
}

/* Planet Cards Horizontal Row */
.planet-cards-wrapper {
  width: 100%;
  border-top: 1px solid rgb(223 231 239 / 12%);
  padding-top: 0.85rem;
}

.planet-cards-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(135px, 1fr);
  gap: 0.6rem;
  overflow-x: auto;
  scrollbar-width: thin;
  padding-bottom: 0.4rem;
}

.planet-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.65rem 0.8rem;
  background: rgb(14 21 30 / 65%);
  border: 1px solid rgb(223 231 239 / 12%);
  border-radius: 3px;
  cursor: pointer;
  transition: all 160ms ease;
  text-align: left;
}

.planet-card:hover {
  background: rgb(20 30 42 / 85%);
  border-color: rgb(223 231 239 / 28%);
}

.planet-card.selected {
  background: rgb(26 36 50 / 92%);
  border-color: rgb(239 190 128 / 75%);
  box-shadow: 0 0 16px rgb(239 190 128 / 15%);
}

.planet-card:focus-visible {
  outline: 2px solid rgb(239 190 128 / 90%);
  outline-offset: 2px;
}

.card-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.card-marker-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-letter {
  font-family: Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  color: rgb(245 248 250 / 90%);
  margin-right: auto;
  margin-left: 0.3rem;
}

.card-status-pill {
  font-size: 0.46rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.15rem 0.35rem;
  border-radius: 2px;
  white-space: nowrap;
}

.pill-surveyed {
  color: rgb(239 190 128 / 90%);
  background: rgb(239 190 128 / 15%);
}

.pill-unsurveyed {
  color: rgb(210 220 230 / 45%);
  background: rgb(210 220 230 / 6%);
}

.card-type {
  color: rgb(220 228 235 / 65%);
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.card-period {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  color: rgb(245 248 250 / 92%);
}

.period-num {
  font-size: 0.74rem;
  font-weight: 500;
}

.period-lbl {
  font-size: 0.46rem;
  letter-spacing: 0.1em;
  color: rgb(220 228 235 / 45%);
}

/* Footer aligned to layout grid */
.map-footer {
  border-top: 1px solid rgb(223 231 239 / 10%);
  padding-top: 0.8rem;
}

.footer-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 1rem;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stat-label {
  color: rgb(220 228 235 / 42%);
  font-size: 0.48rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.stat-value {
  color: rgb(245 248 250 / 78%);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.nav-col {
  align-items: flex-end;
}

.footer-link {
  color: rgb(239 190 128 / 85%);
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 150ms ease;
}

.footer-link:hover {
  color: #fff;
}

/* Responsive Breakpoints */
@media (max-width: 960px) {
  .map-content {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .orbit-field {
    width: min(80vw, 48vh);
  }

  .world-profile {
    max-width: 100%;
    padding: 0;
  }

  .world-title {
    font-size: 2.5rem;
  }

  .footer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .nav-col {
    grid-column: span 2;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .map-shell {
    padding: 0.85rem 1rem;
    gap: 0.85rem;
  }

  .map-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .orbit-field {
    width: min(84vw, 42vh);
  }

  .world-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .world-title {
    font-size: 2.1rem;
  }

  .profile-copy {
    font-size: 0.78rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .system-map,
  .marker-dot,
  .planet-card,
  .action-btn-primary,
  .return-button span {
    transition: none !important;
  }
}
</style>
