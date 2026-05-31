import { createRouter, createWebHashHistory } from 'vue-router'
import Tabs from '../views/AppTabs.vue'
import HomeView from '../views/HomeView.vue'
import PluginManager from '../views/PluginManagerView.vue'
import AssistantManagerView from '../views/AssistantManagerView.vue'
import TipsView from '../views/TipsView.vue'
import OnboardingView from '../views/OnboardingView.vue'

const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    {
      path: '/',
      redirect: '/tabs'
    },
    {
      path: '/tabs',
      name: 'tabs',
      component: Tabs
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: OnboardingView
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView
    },
    {
      path: '/plugin-manager',
      name: 'plugin-manager',
      component: PluginManager
    },
    {
      path: '/assistant-manager',
      name: 'assistant-manager',
      component: AssistantManagerView
    },
    {
      path: '/tips',
      name: 'tips',
      component: TipsView
    }
  ]
})

export default router
