<template>
  <SystemMap
    :system="kepler186"
    :progress="progress"
    :initial-world-id="initialWorldId"
    @return-to-kepler="$emit('return-to-kepler')"
  />
</template>

<script setup lang="ts">
import SystemMap from './SystemMap.vue'
import { kepler186 } from '~/data/systems/kepler-186'

defineProps<{
  progress?: number
  initialWorldId?: string
}>()

defineEmits<{
  'return-to-kepler': []
}>()
</script>
