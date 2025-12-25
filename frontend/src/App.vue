<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onMounted(() => {
  // 从 localStorage 恢复用户状态
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr)
      if (user && user.id && user.username) {
        userStore.setUser(user)
        console.log('User state restored from localStorage:', user)
      } else {
        console.warn('Invalid user data in localStorage, clearing...')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    } catch (error) {
      console.error('Failed to parse user data from localStorage:', error)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})
</script>

<template>
  <router-view />
</template>

<style>
#app {
  width: 100%;
  min-height: 100vh;
}
</style>

