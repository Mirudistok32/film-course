<script setup lang="ts">
/** Интертитр немого кино: тёмная карточка с рамкой-орнаментом в обеих темах. */
withDefaults(defineProps<{ caption?: string }>(), { caption: '' })
</script>

<template>
  <figure class="intertitle">
    <svg
      class="intertitle__corners"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 14V2H14M86 2H98V14M98 86V98H86M14 98H2V86" vector-effect="non-scaling-stroke" />
    </svg>
    <blockquote class="intertitle__text">
      <slot />
    </blockquote>
    <figcaption v-if="caption" class="intertitle__caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.intertitle {
  position: relative;
  margin: 0;
  padding: clamp(1.5rem, 5vw, 2.5rem) clamp(1.25rem, 5vw, 3rem);
  background: var(--intertitle-bg);
  color: var(--intertitle-ink);
  border: 1px solid var(--intertitle-line);
  border-radius: 2px;
  box-shadow:
    inset 0 0 0 6px var(--intertitle-bg),
    inset 0 0 0 7px color-mix(in srgb, var(--intertitle-line) 60%, transparent),
    inset 0 0 60px rgb(0 0 0 / 0.55);
  text-align: center;
}
.intertitle__corners {
  position: absolute;
  inset: 12px;
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  fill: none;
  stroke: var(--intertitle-line);
  stroke-width: 1.5;
}
.intertitle__text {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(1.15rem, 1rem + 0.7vw, 1.45rem);
  line-height: 1.35;
  text-wrap: balance;
}
.intertitle__caption {
  margin-top: 0.9rem;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--intertitle-ink) 70%, var(--intertitle-bg));
}
</style>
