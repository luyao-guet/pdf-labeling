<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '@/components/Sidebar.vue'
import Header from '@/components/Header.vue'

const route = useRoute()

const pageTitle = computed(() => {
  return (route.meta.title as string) || '数据标注平台'
})
</script>

<template>
  <el-container class="main-layout">
    <Sidebar />
    <el-container class="main-container">
      <Header :title="pageTitle" />
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.main-layout {
  min-height: 100vh;
}

.main-container {
  flex-direction: column;
}

.main-content {
  background-color: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}
</style>

