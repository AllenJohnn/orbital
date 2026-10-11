<template>
  <div class="h-screen w-full bg-black text-white relative overflow-hidden font-sans">
    <!-- Found System View -->
    <SystemMap
      v-if="system"
      :system="system"
      :progress="1"
      :initial-world-id="initialWorldId"
      :show-return-button="system.slug === 'kepler-186'"
      @return-to-kepler="returnToOrigin"
    />

    <!-- Themed 404: Signal Not Found -->
    <div
      v-else
      class="h-full w-full flex flex-col justify-between p-6 md:p-12 bg-[radial-gradient(ellipse_at_center,rgba(25,18,18,0.6)_0%,rgba(3,5,8,0.98)_80%)]"
    >
      <header class="flex items-center justify-between text-xs tracking-[0.25em] text-white/40 uppercase">
        <div>ORBITAL ATLAS <span class="text-white/20">／</span> TELEMETRY ERROR</div>
        <div class="text-rose-400/80 flex items-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          FREQUENCY LOST
        </div>
      </header>

      <main class="max-w-xl mx-auto text-center flex flex-col items-center gap-6 py-12">
        <div class="text-[0.65rem] tracking-[0.35em] text-rose-400 uppercase border border-rose-500/30 bg-rose-500/10 px-3 py-1 rounded-full">
          STATUS 404 · TRANSMISSION SILENT
        </div>

        <h1 class="text-3xl md:text-5xl font-light tracking-[0.14em] uppercase text-white/95 font-serif">
          Signal not found
        </h1>

        <p class="text-sm md:text-base text-white/60 leading-relaxed font-light tracking-wide max-w-md">
          Deep space receiver scanned coordinates for <span class="text-white font-mono font-normal">"{{ routeSlug }}"</span>, but no stellar transponder or orbital telemetry was identified in the catalog.
        </p>

        <div class="pt-4">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-2 text-xs tracking-[0.22em] text-white/90 uppercase border border-white/30 bg-white/5 hover:bg-white/15 hover:border-white/60 transition-all duration-200 px-6 py-3 rounded"
          >
            <span>←</span>
            <span>RETURN TO KEPLER-186</span>
          </NuxtLink>
        </div>
      </main>

      <footer class="flex items-center justify-between text-[0.65rem] tracking-[0.2em] text-white/30 uppercase border-t border-white/10 pt-4">
        <div>ORBITAL DEEP SPACE NETWORK</div>
        <div>002 SYSTEMS REGISTERED</div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SystemMap from '~/components/orbital/SystemMap.vue'
import { getSystem } from '~/data/systems'

const route = useRoute()
const router = useRouter()

const routeSlug = computed(() => {
  const param = route.params.slug
  return Array.isArray(param) ? param[0] ?? '' : param ?? ''
})

const system = computed(() => getSystem(routeSlug.value))

const initialWorldId = computed(() => {
  const queryPlanet = route.query.planet
  if (typeof queryPlanet === 'string' && queryPlanet.trim()) {
    return queryPlanet.trim().toLowerCase()
  }
  return undefined
})

const returnToOrigin = () => {
  void router.push({ path: '/', query: { planet: 'f' } })
}

useSeoMeta({
  title: computed(() => (system.value ? `ORBITAL — ${system.value.name} System` : 'ORBITAL — Signal Not Found')),
  description: computed(() =>
    system.value
      ? `Exploration and orbital telemetry of the ${system.value.name} system.`
      : 'Signal not found in deep space atlas.'
  )
})
</script>
