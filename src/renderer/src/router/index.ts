import { createRouter, createWebHashHistory } from 'vue-router'
import Tabs from '../views/AppTabs.vue'
import HomeView from '../views/HomeView.vue'
import PluginManager from '../views/PluginManagerView.vue'
import AssistantManagerView from '../views/AssistantManagerView.vue'
import ChatBoxView from '../views/ChatBoxView.vue'
import AssistantView from '../views/AssistantView.vue'
import TipsView from '../views/TipsView.vue'
import OnboardingView from '../views/OnboardingView.vue'
import StartupView from '../views/StartupView.vue'

const router = createRouter({
  history: createWebHashHistory('/'),
  routes: [
    {
      path: '/',
      redirect: '/startup'
    },
    {
      path: '/startup',
      name: 'startup',
      component: StartupView
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
      path: '/chat-box',
      name: 'chat-box',
      component: ChatBoxView
    },
    {
      path: '/assistant-manager',
      name: 'assistant-manager',
      component: AssistantManagerView
    },
    {
      path: '/assistant',
      name: 'assistant',
      component: AssistantView
    },
    {
      path: '/tips',
      name: 'tips',
      component: TipsView
    }
  ]
})

export default router
