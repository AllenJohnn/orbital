<template>
  <section class="intro-container fixed inset-0 z-10 pointer-events-none" aria-labelledby="orbital-title">
    <div class="intro-content" ref="contentRef">
      <p class="mission-tag">FIELD SURVEY <span>01 / 01</span></p>
      <h1 id="orbital-title" class="title">ORBITAL</h1>
      <p class="subtitle">A journey beyond the known.</p>
    </div>

    <button
      ref="scrollRef"
      class="scroll-indicator pointer-events-auto"
      type="button"
      aria-label="Begin the Kepler-186f survey"
      @click="beginSurvey"
    >
      <span>BEGIN THE SURVEY</span>
      <span class="arrow" aria-hidden="true">↓</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const contentRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLButtonElement | null>(null)

const beginSurvey = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: window.innerHeight, behavior: reduceMotion ? 'instant' : 'smooth' })
}

defineExpose({ contentRef, scrollRef })
</script>

<style scoped>
.intro-container {
  color: var(--orbital-ivory);
}

.intro-content {
  position: absolute;
  top: clamp(3.25rem, 12vh, 8rem);
  left: clamp(1.5rem, 8vw, 8.5rem);
  max-width: min(76vw, 880px);
  text-shadow: 0 2px 36px rgb(4 7 10 / 72%);
}

.mission-tag,
.subtitle,
.scroll-indicator {
  font-family: var(--font-body);
}

.mission-tag {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin: 0 0 clamp(0.7rem, 2vh, 1.25rem);
  color: var(--orbital-amber);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.2em;
}

.mission-tag span {
  color: rgb(220 225 230 / 64%);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(4rem, 12.5vw, 11rem);
  font-weight: 500;
  letter-spacing: 0.055em;
  line-height: 0.82;
}

.subtitle {
  margin: 1.1rem 0 0 0.2rem;
  color: rgb(237 237 231 / 78%);
  font-size: clamp(0.76rem, 1.1vw, 0.94rem);
  font-weight: 400;
  letter-spacing: 0.21em;
  text-transform: uppercase;
}

.scroll-indicator {
  position: absolute;
  right: clamp(1.5rem, 5vw, 5rem);
  bottom: clamp(1.5rem, 5vh, 3.25rem);
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 0;
  border: 0;
  background: transparent;
  color: rgb(237 237 231 / 84%);
  cursor: pointer;
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.18em;
}

.scroll-indicator::before {
  width: 2.25rem;
  height: 1px;
  background: var(--orbital-amber);
  content: '';
  transition: width 220ms ease-out;
}

.scroll-indicator:hover::before {
  width: 3.25rem;
}

.scroll-indicator:focus-visible {
  outline: 1px solid var(--orbital-amber);
  outline-offset: 5px;
}

.arrow {
  color: var(--orbital-amber);
  font-size: 1rem;
}

@media (max-width: 600px) {
  .intro-content {
    top: 12vh;
    left: 1.25rem;
    max-width: calc(100vw - 2.5rem);
  }

  .title {
    font-size: clamp(3.75rem, 18vw, 6rem);
  }

  .subtitle {
    max-width: 18rem;
    font-size: 0.66rem;
    line-height: 1.7;
    letter-spacing: 0.15em;
  }

  .scroll-indicator {
    right: 1.25rem;
    bottom: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-indicator::before {
    transition: none;
  }
}
</style>
