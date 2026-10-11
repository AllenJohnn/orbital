<template>
  <div class="orbital-scene fixed inset-0 w-full h-full bg-black z-0" ref="sceneContainer">
    <img
      v-if="webglUnavailable"
      class="scene-poster"
      src="/orbital-poster.svg"
      alt="Artist’s impression of Kepler-186f beneath a distant red-orange star."
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, toRef, watch } from 'vue'
import { useOrbitalScene } from '~/composables/useOrbitalScene'
import type { PlanetVisual } from '~/types/atlas'

const props = defineProps<{
  scrollProgress: number
  planetVisual?: PlanetVisual
  starColor?: string
}>()

const sceneContainer = ref<HTMLElement | null>(null)
const webglUnavailable = ref(false)
const progressRef = toRef(props, 'scrollProgress')
const visualRef = toRef(props, 'planetVisual')
const starColorRef = toRef(props, 'starColor')

const orbital = useOrbitalScene(
  sceneContainer,
  progressRef,
  visualRef,
  () => {
    webglUnavailable.value = true
  },
  starColorRef
)

onMounted(() => {
  orbital.init()
  if (props.starColor && orbital.setStarColor) {
    orbital.setStarColor(props.starColor)
  }
})

onBeforeUnmount(() => {
  orbital.cleanup()
})

defineExpose({
  orbital
})
</script>

<style scoped>
.orbital-scene :deep(canvas) {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: block;
}

.scene-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
