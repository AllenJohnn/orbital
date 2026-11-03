<template>
  <section
    class="survey-complete"
    :aria-hidden="progress < 0.02"
    :inert="progress <= 0.55"
    :style="{ opacity: progress, visibility: progress < 0.02 ? 'hidden' : 'visible' }"
    aria-labelledby="survey-title"
  >
    <header class="survey-header">
      <p>ORBITAL <span>／</span> FIELD RECORD 001</p>
      <p>KEPLER SYSTEM <span>·</span> 2014</p>
    </header>

    <div class="survey-layout">
      <div class="survey-copy">
        <p class="survey-kicker"><span class="status-dot" aria-hidden="true"></span>Survey complete</p>
        <h1 id="survey-title">Kepler-186<span>f</span></h1>
        <p class="survey-description">
          Its orbit falls within the star’s habitable zone, a measure of incoming energy, not evidence
          of surface water or life. The planet’s true surface remains unknown.
        </p>
        <p class="impression-note">Procedural artist’s impression <span>·</span> surface conditions unknown</p>
      </div>

      <div class="survey-data">
        <h2>Observed parameters</h2>
        <dl>
          <div class="data-row">
            <dt>Planet class</dt>
            <dd>{{ planet.worldType.toLowerCase() }}</dd>
          </div>
          <div class="data-row">
            <dt>Orbital period</dt>
            <dd>{{ planet.periodDays?.toFixed(1) }} days</dd>
          </div>
          <div class="data-row">
            <dt>Distance from star</dt>
            <dd>{{ planet.distanceAU?.toFixed(3) }} AU</dd>
          </div>
          <template v-if="showMoreData">
            <div class="data-row expanded-row">
              <dt>Radius</dt>
              <dd>{{ planet.radiusEarth?.toFixed(2) }} Earth radii</dd>
            </div>
            <div class="data-row expanded-row">
              <dt>Mass</dt>
              <dd>{{ planet.massEarth?.toFixed(2) }} Earth masses</dd>
            </div>
            <div class="data-row expanded-row">
              <dt>Equilibrium temperature</dt>
              <dd>{{ planet.equilibriumTempK }} K</dd>
            </div>
          </template>
        </dl>

        <button
          class="data-toggle"
          type="button"
          :aria-expanded="showMoreData"
          @click="showMoreData = !showMoreData"
        >
          <span aria-hidden="true">{{ showMoreData ? '−' : '+' }}</span>
          {{ showMoreData ? 'Fewer parameters' : 'More parameters' }}
        </button>
      </div>
    </div>

    <footer class="survey-footer">
      <button class="action-primary" type="button" @click="$emit('return-to-planet')">
        <span aria-hidden="true">↖</span> Return to the planet
      </button>
      <button class="action-secondary" type="button" @click="$emit('return-to-start')">
        Begin again <span aria-hidden="true">↑</span>
      </button>
      <p>End of field record <span>／</span> Kepler-186f</p>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Planet } from '~/types/atlas'

withDefaults(defineProps<{
  planet: Planet
  progress?: number
}>(), {
  progress: 1
})

defineEmits<{
  'return-to-planet': []
  'return-to-start': []
}>()

const showMoreData = ref(false)
</script>

<style scoped>
.survey-complete {
  --warm: var(--orbital-amber);
  position: fixed;
  z-index: 12;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-y: auto;
  padding: clamp(1.4rem, 4.2vh, 3rem) clamp(1.5rem, 6vw, 7rem);
  background: radial-gradient(ellipse at 17% 58%, rgb(7 14 20 / 12%), rgb(5 8 12 / 44%) 72%);
  color: var(--orbital-ivory);
  font-family: var(--font-body);
  transition: opacity 180ms linear;
  user-select: text;
}

.survey-header,
.survey-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.survey-header p,
.survey-footer > p {
  margin: 0;
  color: rgb(225 229 232 / 64%);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.survey-header p:first-child {
  color: var(--warm);
}

.survey-header span,
.survey-footer > p span {
  padding-inline: 0.3rem;
  color: rgb(225 229 232 / 34%);
}

.survey-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(16rem, 0.72fr);
  align-items: end;
  gap: clamp(3rem, 12vw, 13rem);
  width: min(100%, 1320px);
  margin: auto;
  padding-block: 4rem;
}

.survey-copy {
  max-width: 48rem;
}

.survey-kicker {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin: 0 0 1.2rem;
  color: var(--warm);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.status-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: var(--warm);
  box-shadow: 0 0 1.1rem rgb(218 161 95 / 72%);
}

.survey-copy h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(4.6rem, 9.2vw, 9.5rem);
  font-weight: 500;
  letter-spacing: 0.005em;
  line-height: 0.86;
  text-shadow: 0 4px 32px rgb(3 7 11 / 45%);
}

.survey-copy h1 span {
  color: var(--warm);
  font-style: italic;
}

.survey-description {
  max-width: 40rem;
  margin: clamp(1.25rem, 3vh, 2rem) 0 0;
  color: rgb(235 237 237 / 83%);
  font-size: clamp(1rem, 1.3vw, 1.2rem);
  line-height: 1.72;
}

.impression-note {
  margin: 1.25rem 0 0;
  color: rgb(225 229 232 / 62%);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
}

.impression-note span {
  color: var(--warm);
}

.survey-data {
  padding-block: 0.3rem 0.7rem;
  border-top: 1px solid rgb(225 229 232 / 26%);
}

.survey-data h2 {
  margin: 1.1rem 0 1.15rem;
  color: rgb(225 229 232 / 56%);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.survey-data dl {
  margin: 0;
}

.data-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.8rem;
  padding-block: 0.82rem;
  border-top: 1px solid rgb(225 229 232 / 13%);
  align-items: baseline;
}

.data-row dt {
  color: rgb(225 229 232 / 62%);
  font-size: 0.73rem;
}

.data-row dd {
  margin: 0;
  color: var(--orbital-ivory);
  font-size: 0.74rem;
  font-weight: 600;
  text-align: right;
  text-transform: capitalize;
}

.expanded-row dd {
  color: rgb(235 188 127 / 92%);
}

.data-toggle,
.action-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 0;
  background: transparent;
  color: var(--warm);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.data-toggle {
  margin-top: 1rem;
  padding: 0;
}

.data-toggle span {
  font-size: 1rem;
}

.data-toggle:hover,
.action-secondary:hover {
  color: var(--orbital-ivory);
}

.survey-footer {
  justify-content: flex-start;
}

.action-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 2.9rem;
  padding: 0.6rem 1.05rem;
  border: 1px solid rgb(235 188 127 / 70%);
  background: rgb(17 20 22 / 68%);
  color: var(--orbital-ivory);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  transition: background 160ms ease-out, border-color 160ms ease-out;
}

.action-primary > span {
  color: var(--warm);
  font-size: 0.9rem;
}

.action-primary:hover {
  border-color: var(--warm);
  background: rgb(218 161 95 / 18%);
}

.survey-complete button:focus-visible {
  outline: 2px solid var(--warm);
  outline-offset: 4px;
}

@media (max-width: 760px) {
  .survey-complete {
    padding: 1.25rem 1.25rem 1.4rem;
  }

  .survey-header {
    align-items: flex-start;
  }

  .survey-header p {
    font-size: 0.52rem;
    letter-spacing: 0.14em;
  }

  .survey-layout {
    grid-template-columns: 1fr;
    align-items: start;
    gap: 2rem;
    padding-block: 4.5rem 2rem;
  }

  .survey-copy h1 {
    font-size: clamp(4.2rem, 18vw, 7rem);
  }

  .survey-description {
    max-width: 33rem;
    margin-top: 1rem;
    font-size: 0.95rem;
  }

  .impression-note {
    font-size: 0.57rem;
    line-height: 1.5;
  }

  .survey-data h2 {
    margin: 0.85rem 0 0.65rem;
  }

  .data-row {
    padding-block: 0.65rem;
  }

  .survey-footer {
    flex-wrap: wrap;
    gap: 0.8rem 1.2rem;
  }

  .survey-footer > p {
    flex-basis: 100%;
    font-size: 0.53rem;
  }
}

@media (max-height: 700px) and (min-width: 761px) {
  .survey-layout {
    padding-block: 2rem;
  }

  .survey-copy h1 {
    font-size: clamp(4.5rem, 8vw, 7rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .survey-complete,
  .action-primary {
    transition: none;
  }
}
</style>
