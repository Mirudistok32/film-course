<template>
  <div class="ink-divider" role="separator">
    <svg viewBox="0 0 120 24" aria-hidden="true" focusable="false">
      <path class="fine" d="M2 12H44M76 12H118" />
      <path d="M60 4Q50 12 60 20Q70 12 60 4Z" />
      <path class="fine" d="M44 12Q50 6 54 12Q50 18 44 12ZM76 12Q70 6 66 12Q70 18 76 12Z" />
    </svg>
  </div>
</template>

<style scoped>
.ink-divider {
  display: flex;
  justify-content: center;
  margin: 2.5rem 0;
  color: var(--line-strong);
}
svg {
  width: 9rem;
  height: auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.fine {
  stroke-width: 1;
}
</style>
