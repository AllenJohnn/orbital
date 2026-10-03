<template>
  <section
    class="system-map fixed inset-0 z-20 text-white"
    :aria-hidden="progress < 0.02"
    :inert="progress <= 0.55"
    :style="{ opacity: progress, visibility: progress < 0.02 ? 'hidden' : 'visible' }"
  >
    <div class="map-shell" :style="{ pointerEvents: progress > 0.55 ? 'auto' : 'none' }">
      <header class="map-header">
        <div class="eyebrow">ORBITAL ATLAS <span>／</span> SYSTEM 001</div>
        <div class="chapter-index">KEPLER-186 <span>·</span> 01 OF MANY</div>
      </header>

      <main class="map-content">
        <div class="orbit-field" role="group" aria-label="Diagram of the five known Kepler-186 planets">
          <svg class="orbit-lines" viewBox="0 0 620 620" aria-hidden="true">
            <ellipse class="habitable-zone" cx="310" cy="310" rx="235" ry="169" />
            <ellipse
              v-for="world in kepler186System.worlds"
              :key="`orbit-${world.id}`"
              class="orbit-line"
              cx="310"
              cy="310"
              :rx="world.diagramRadius * 280"
              :ry="world.diagramRadius * 280 * 0.72"
            />
            <circle class="star-halo" cx="310" cy="310" r="27" />
            <circle class="star-core" cx="310" cy="310" r="5" />
          </svg>

          <button
            v-for="world in kepler186System.worlds"
            :key="world.id"
            class="world-marker"
            :class="{ selected: selectedWorldId === world.id, surveyed: world.surveyed }"
            :style="worldPosition(world)"
            :aria-label="`Kepler-186${world.id}, ${world.surveyed ? 'survey complete' : 'survey not yet available'}`"
            :aria-pressed="selectedWorldId === world.id"
            :title="`Kepler-186${world.id}`"
            @click="selectedWorldId = world.id"
          >
            <span class="marker-dot" :style="{ '--marker-color': world.markerColor }"></span>
            <span class="marker-label">{{ world.id }}</span>
          </button>

          <div class="star-label">KEPLER-186 <span>{{ kepler186System.starType }}</span></div>
          <div class="habitable-label">HABITABLE ZONE</div>
          <div class="diagram-note">ORBITAL SPACING IS DIAGRAMMATIC</div>
        </div>

        <section class="world-profile" aria-live="polite">
          <div class="eyebrow">{{ selectedWorld.surveyed ? 'SURVEY COMPLETE' : 'SIGNAL IDENTIFIED' }}</div>
          <h1>Kepler-186<span>{{ selectedWorld.id }}</span></h1>
          <p v-if="selectedWorld.surveyed" class="profile-copy">
            The first surveyed world in the system, orbiting within its star's habitable zone. Surface conditions remain unknown.
          </p>
          <p v-else class="profile-copy">
            This world is mapped as a future destination. Its planetary chapter has not been surveyed yet.
          </p>

          <dl v-if="selectedWorld.surveyed" class="world-facts">
            <div><dt>WORLD TYPE</dt><dd>SUPER-EARTH</dd></div>
            <div><dt>ORBITAL PERIOD</dt><dd>129.9 DAYS</dd></div>
            <div><dt>ORBITAL DISTANCE</dt><dd>0.432 AU</dd></div>
          </dl>
          <p v-else class="signal-note">ORBIT CHARTED <span>／</span> TERRAIN UNKNOWN</p>

          <a
            v-if="selectedWorld.surveyed"
            class="source-link"
            href="https://science.nasa.gov/exoplanet-catalog/kepler-186-f/"
            target="_blank"
            rel="noreferrer"
          >NASA EXOPLANET CATALOG ↗</a>

          <button class="return-button" type="button" @click="$emit('return-to-kepler')">
            <span>↖</span> RETURN TO KEPLER-186F
          </button>
        </section>
      </main>

      <footer class="map-footer">
        <span>FIVE KNOWN WORLDS</span>
        <span>ONE SURVEY COMPLETE</span>
        <span>THE NEXT CHAPTER STARTS HERE</span>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { kepler186System, type KeplerWorld } from '~/data/kepler186System'

defineProps<{
  progress: number
}>()

defineEmits<{
  'return-to-kepler': []
}>()

const selectedWorldId = ref<KeplerWorld['id']>('f')
const selectedWorld = computed(() =>
  kepler186System.worlds.find((world) => world.id === selectedWorldId.value) ?? kepler186System.worlds[4]!
)

const worldPosition = (world: KeplerWorld) => {
  const radius = world.diagramRadius * 280
  const angle = world.diagramAngle
  const x = 310 + Math.cos(angle) * radius
  const y = 310 + Math.sin(angle) * radius * 0.72
  return {
    left: `${((x / 620) * 100).toFixed(4)}%`,
    top: `${((y / 620) * 100).toFixed(4)}%`
  }
}
</script>

<style scoped>
.system-map {
  background:
    radial-gradient(ellipse at 50% 54%, rgb(18 25 34 / 54%), transparent 54%),
    linear-gradient(180deg, rgb(3 5 8 / 76%), rgb(3 5 8 / 38%) 35%, rgb(3 5 8 / 82%));
  transition: opacity 120ms linear;
  font-family: Inter, system-ui, sans-serif;
}

.map-shell {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(1.2rem, 4vw, 3.5rem) clamp(1.2rem, 6vw, 6rem);
}

.map-header,
.map-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: rgb(230 235 239 / 62%);
  font-size: 0.62rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.eyebrow {
  color: rgb(239 190 128 / 78%);
  font-size: 0.63rem;
  letter-spacing: 0.27em;
  text-transform: uppercase;
}

.map-header span,
.map-footer span + span {
  color: rgb(239 190 128 / 62%);
}

.map-content {
  width: min(100%, 1220px);
  margin: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.75fr);
  align-items: center;
  gap: clamp(1rem, 5vw, 5.5rem);
}

.orbit-field {
  position: relative;
  width: min(100%, 68vh, 52vw);
  aspect-ratio: 1;
  justify-self: center;
  filter: drop-shadow(0 0 28px rgb(132 169 202 / 8%));
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
  stroke: rgb(183 201 215 / 26%);
  stroke-width: 0.8;
}

.habitable-zone {
  fill: none;
  stroke: rgb(229 170 105 / 22%);
  stroke-width: 1;
  stroke-dasharray: 2 7;
}

.star-halo {
  fill: rgb(239 177 103 / 10%);
  stroke: rgb(246 204 142 / 30%);
  stroke-width: 1;
}

.star-core {
  fill: #ffe0a3;
  filter: drop-shadow(0 0 9px rgb(255 192 112 / 94%));
}

.world-marker {
  position: absolute;
  z-index: 2;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
}

.world-marker:focus-visible {
  outline: 1px solid rgb(246 204 142 / 90%);
  outline-offset: 3px;
}

.marker-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.45rem;
  height: 0.45rem;
  border: 1px solid color-mix(in srgb, var(--marker-color), white 35%);
  border-radius: 50%;
  background: var(--marker-color);
  box-shadow: 0 0 12px color-mix(in srgb, var(--marker-color), transparent 45%);
  transform: translate(-50%, -50%);
  transition: width 180ms ease, height 180ms ease, box-shadow 180ms ease;
}

.surveyed .marker-dot,
.selected .marker-dot {
  width: 0.8rem;
  height: 0.8rem;
}

.selected .marker-dot {
  box-shadow: 0 0 0 5px rgb(236 186 126 / 14%), 0 0 22px rgb(236 186 126 / 85%);
}

.marker-label {
  position: absolute;
  top: 50%;
  left: calc(50% + 1rem);
  color: rgb(232 237 241 / 78%);
  font-family: Georgia, serif;
  font-size: 0.8rem;
  font-style: italic;
  text-transform: uppercase;
  transform: translateY(-50%);
}

.star-label {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: rgb(255 231 190 / 88%);
  font-size: 0.53rem;
  letter-spacing: 0.15em;
  text-align: center;
  transform: translate(-50%, 2.2rem);
  white-space: nowrap;
}

.star-label span {
  color: rgb(255 231 190 / 48%);
  font-size: 0.45rem;
}

.habitable-label {
  position: absolute;
  top: 10%;
  right: 9%;
  color: rgb(239 190 128 / 70%);
  font-size: 0.48rem;
  letter-spacing: 0.16em;
}

.diagram-note {
  position: absolute;
  right: 1%;
  bottom: 3%;
  color: rgb(224 231 236 / 44%);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
}

.world-profile {
  max-width: 390px;
  padding: 1.5rem 0;
  border-top: 1px solid rgb(223 231 239 / 22%);
  border-bottom: 1px solid rgb(223 231 239 / 22%);
}

.world-profile h1 {
  margin: 1rem 0 0.75rem;
  color: rgb(247 246 242 / 96%);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(2.2rem, 4.5vw, 4.5rem);
  font-weight: 400;
  letter-spacing: -0.055em;
  line-height: 1;
}

.world-profile h1 span {
  color: rgb(239 190 128 / 86%);
  font-style: italic;
}

.profile-copy {
  max-width: 35ch;
  margin: 0;
  color: rgb(225 231 236 / 68%);
  font-size: 0.94rem;
  line-height: 1.7;
}

.world-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1.5rem 0 0;
  padding: 1rem 0;
  border-top: 1px solid rgb(223 231 239 / 14%);
  border-bottom: 1px solid rgb(223 231 239 / 14%);
}

.world-facts div {
  min-width: 0;
}

.world-facts dt {
  color: rgb(223 231 239 / 46%);
  font-size: 0.48rem;
  letter-spacing: 0.13em;
}

.world-facts dd {
  margin: 0.45rem 0 0;
  color: rgb(247 246 242 / 90%);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.signal-note,
.source-link {
  display: block;
  margin: 1.25rem 0 0;
  color: rgb(239 190 128 / 70%);
  font-size: 0.57rem;
  letter-spacing: 0.17em;
  text-decoration: none;
}

.signal-note span {
  color: rgb(223 231 239 / 32%);
}

.source-link:hover {
  color: rgb(255 226 181 / 100%);
}

.return-button {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 0;
  border: 0;
  color: rgb(247 246 242 / 90%);
  background: transparent;
  font-size: 0.62rem;
  letter-spacing: 0.19em;
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
  outline-offset: 5px;
}

.map-footer {
  color: rgb(223 231 239 / 46%);
  font-size: 0.52rem;
}

@media (max-width: 760px) {
  .map-shell {
    padding: 1.1rem 1.15rem;
  }

  .map-header,
  .map-footer {
    font-size: 0.48rem;
    letter-spacing: 0.13em;
  }

  .map-header {
    align-items: flex-start;
  }

  .map-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(0.3rem, 2vh, 1.25rem);
  }

  .orbit-field {
    width: min(64vh, 78vw);
  }

  .world-profile {
    width: min(100%, 470px);
    padding: 0.8rem 0 0;
  }

  .world-profile h1 {
    margin: 0.4rem 0;
    font-size: clamp(2rem, 9vw, 3rem);
  }

  .profile-copy {
    font-size: 0.78rem;
  }

  .world-facts {
    margin-top: 0.75rem;
    padding: 0.6rem 0;
  }

  .signal-note,
  .source-link {
    margin-top: 0.65rem;
  }

  .return-button {
    margin-top: 0.8rem;
  }

  .map-footer span:last-child {
    display: none;
  }
}

@media (max-height: 540px) and (min-width: 761px) {
  .map-shell {
    padding-top: 1rem;
    padding-bottom: 1rem;
  }

  .orbit-field {
    width: min(58vh, 46vw);
  }

  .world-profile {
    padding: 0.8rem 0;
  }

  .world-profile h1 {
    margin: 0.6rem 0;
    font-size: clamp(2rem, 6vh, 3rem);
  }

  .world-facts {
    margin-top: 0.8rem;
    padding: 0.65rem 0;
  }
}

@media (max-height: 500px) and (max-width: 760px) {
  .map-shell {
    padding: 0.8rem 1rem;
  }

  .map-content {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 0.7rem;
  }

  .orbit-field {
    width: min(56vh, 43vw);
  }

  .world-profile {
    width: 100%;
    padding: 0.7rem 0;
  }

  .world-profile h1 {
    margin: 0.45rem 0;
    font-size: clamp(1.6rem, 7vw, 2.3rem);
  }

  .profile-copy {
    font-size: 0.68rem;
    line-height: 1.4;
  }

  .world-facts {
    gap: 0.35rem;
    margin-top: 0.55rem;
  }

  .world-facts dt {
    font-size: 0.4rem;
  }

  .world-facts dd {
    font-size: 0.52rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .system-map,
  .marker-dot,
  .return-button span {
    transition: none;
  }
}
</style>
