<script setup lang="ts">
import AppButton from '@/components/AppButton.vue'
import InkVignette from '@/illustrations/InkVignette.vue'
</script>

<template>
  <section class="not-found container">
    <InkVignette name="signpost" />
    <p class="eyebrow">Ошибка 404</p>
    <h1>Такого кадра нет на плёнке</h1>
    <p class="muted">
      Возможно, адрес набран с ошибкой или раздел переехал. Ваш прогресс в порядке — он хранится отдельно от адресов
      страниц.
    </p>
    <div class="not-found__actions">
      <AppButton variant="primary" :to="{ name: 'home' }">На главную</AppButton>
      <AppButton :to="{ name: 'course' }">Карта курса</AppButton>
    </div>
  </section>
</template>

<style scoped>
.not-found {
  display: grid;
  justify-items: center;
  gap: 1rem;
  max-width: 36rem;
  padding-top: 3rem;
  text-align: center;
}
.not-found__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
</style>
