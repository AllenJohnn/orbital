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
import { ref, onMounted, onBeforeUnmount, toRef } from 'vue'
import { useOrbitalScene } from '~/composables/useOrbitalScene'

const props = defineProps<{
  scrollProgress: number
}>()
const sceneContainer = ref<HTMLElement | null>(null)
const webglUnavailable = ref(false)
const progressRef = toRef(props, 'scrollProgress')

const orbital = useOrbitalScene(sceneContainer, progressRef, () => {
  webglUnavailable.value = true
})

onMounted(() => {
  orbital.init()
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
