<template>
  <div class="fixed inset-0 w-full h-full bg-black z-0" ref="sceneContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, toRef } from 'vue'
import { useOrbitalScene } from '~/composables/useOrbitalScene'

const props = defineProps<{
  scrollProgress: number
}>()

const sceneContainer = ref<HTMLElement | null>(null)
const progressRef = toRef(props, 'scrollProgress')

const orbital = useOrbitalScene(sceneContainer, progressRef)

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
