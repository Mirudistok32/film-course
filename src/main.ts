import './styles/index.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useProgressStore } from './stores/progress'

const app = createApp(App)
app.use(createPinia())
app.use(router)
useProgressStore().init()
app.mount('#app')
