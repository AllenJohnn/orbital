<template>
  <div class="intro-container fixed inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
    <div class="intro-content text-center text-white" ref="contentRef">
      <div class="mission-tag text-xs tracking-[0.3em] opacity-60 mb-6 uppercase">Mission 001</div>
      <h1 class="title text-6xl md:text-8xl font-light tracking-[0.2em] mb-4">ORBITAL</h1>
      <p class="subtitle text-sm md:text-base tracking-[0.4em] opacity-80 uppercase">A Journey Beyond The Known.</p>
    </div>
    
    <div class="scroll-indicator absolute bottom-12 flex flex-col items-center opacity-70" ref="scrollRef">
      <span class="text-xs tracking-[0.2em] mb-2">SCROLL TO BEGIN</span>
      <span class="arrow text-sm">↓</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const contentRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)

defineExpose({
  contentRef,
  scrollRef
})
</script>

<style scoped>
.title {
  font-family: 'Cinzel', 'Oswald', system-ui, sans-serif;
}
.mission-tag, .subtitle, .scroll-indicator {
  font-family: 'Inter', system-ui, sans-serif;
}
</style>
