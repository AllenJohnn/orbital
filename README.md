# ORBITAL

**A Journey Beyond The Known.**

ORBITAL is a cinematic, scroll-driven exoplanet field survey. The current chapter follows a procedural artist’s impression of Kepler-186f and ends with a diagram of its five-planet system. The surface depiction is illustrative; the planet’s actual surface conditions are unknown.

- Live experience: [orbital0.vercel.app](https://orbital0.vercel.app/)
- Stack: Nuxt 4, Vue 3, TypeScript, Three.js, GLSL, GSAP, Lenis, Tailwind CSS
- Data: NASA Exoplanet Archive; orbit diagram layout is diagrammatic

## Run locally

```sh
npm install
npm run dev
```

Nuxt serves the site at `http://localhost:3000` by default.

## Quality checks

```sh
npm run typecheck
npm run build
```

## Project structure

- `app/pages/index.vue` — the current Kepler-186f chapter and scroll progress
- `app/components/orbital/` — intro, WebGL scene, and system diagram
- `app/composables/useOrbitalScene.ts` — Three.js scene, camera path, glare, adaptive pixel ratio, and visibility handling
- `app/composables/usePlanet.ts` and `app/shaders/` — procedural planet, cloud, atmosphere, and moon rendering
- `app/data/systems/` — typed system registry and sourced planet values
- `app/config/timeline.ts` — named scroll milestones
- `public/orbital-poster.svg` — social preview and no-WebGL fallback

The system registry is a local snapshot; the site does not call the NASA archive at runtime. Physical values are sourced from the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), while visual profiles and diagram positions are presentation data rather than measured surface facts.
