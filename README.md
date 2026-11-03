# ORBITAL

**A Journey Beyond The Known.**

ORBITAL is a cinematic, scroll-driven survey of Kepler-186f. The experience follows one procedural artist’s impression and ends with a diagram of the Kepler-186 system. The surface depiction is illustrative; the planet’s actual surface conditions are unknown.

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

- `app/pages/index.vue` — the Kepler-186f survey and scroll progress
- `app/components/orbital/` — intro, WebGL scene, and system diagram
- `app/composables/useOrbitalScene.ts` — Three.js scene, camera path, glare, adaptive pixel ratio, and visibility handling
- `app/composables/usePlanet.ts` and `app/shaders/` — procedural planet, cloud, atmosphere, and moon rendering
- `app/data/systems/` — typed system registry and sourced planet values
- `app/config/timeline.ts` — named scroll milestones
- `public/orbital-poster.svg` — social preview and no-WebGL fallback

The registry contains only Kepler-186f; the site does not call the NASA archive at runtime. Physical values are sourced from the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), while the visual profile and diagram positions are presentation data rather than measured surface facts.
