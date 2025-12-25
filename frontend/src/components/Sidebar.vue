<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  HomeFilled,
  Document,
  List,
  User,
  DataAnalysis,
  CircleCheck,
  Trophy,
  FolderOpened,
  EditPen
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isCollapse = ref(false)

interface MenuItem {
  path: string
  title: string
  icon: any
  roles?: string[]
}

const menuItems: MenuItem[] = [
  {
    path: '/',
    title: '仪表板',
    icon: HomeFilled
  },
  {
    path: '/my-tasks',
    title: '我的任务',
    icon: List,
    roles: ['admin', 'annotator', 'reviewer', 'expert']
  },
  {
    path: '/data-management',
    title: '数据管理',
    icon: DataAnalysis
  },
  {
    path: '/files',
    title: '文件管理',
    icon: FolderOpened
  },
  {
    path: '/tasks',
    title: '任务管理',
    icon: Document,
    roles: ['admin']
  },
  {
    path: '/categories',
    title: '类别管理',
    icon: EditPen,
    roles: ['admin']
  },
  {
    path: '/quality-review',
    title: '质量审核',
    icon: CircleCheck,
    roles: ['admin', 'reviewer', 'expert']
  },
  {
    path: '/users',
    title: '用户管理',
    icon: User,
    roles: ['admin']
  },
  {
    path: '/statistics',
    title: '统计分析',
    icon: DataAnalysis,
    roles: ['admin']
  },
  {
    path: '/score-ranking',
    title: '积分排行',
    icon: Trophy
  }
]

const filteredMenuItems = computed(() => {
  const userRole = userStore.userRole
  return menuItems.filter(item => {
    if (item.roles && userRole) {
      return item.roles.includes(userRole)
    }
    return true
  })
})

const activeMenu = computed(() => {
  const path = route.path
  // 处理带参数的路由
  if (path.startsWith('/annotation/')) return '/my-tasks'
  if (path.startsWith('/form-designer')) return '/categories'
  return path
})

const handleSelect = (path: string) => {
  router.push(path)
}

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}
</script>

<template>
  <el-aside :width="isCollapse ? '64px' : '220px'" class="sidebar">
    <div class="logo" @click="toggleCollapse">
      <el-icon :size="24"><HomeFilled /></el-icon>
      <span v-if="!isCollapse" class="logo-text">数据标注平台</span>
    </div>
    
    <el-menu
      :default-active="activeMenu"
      :collapse="isCollapse"
      :collapse-transition="false"
      background-color="#304156"
      text-color="#bfcbd9"
      active-text-color="#409eff"
      @select="handleSelect"
    >
      <el-menu-item
        v-for="item in filteredMenuItems"
        :key="item.path"
        :index="item.path"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <template #title>{{ item.title }}</template>
      </el-menu-item>
    </el-menu>
  </el-aside>
</template>

<style scoped>
.sidebar {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  gap: 10px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

:deep(.el-menu) {
  border-right: none;
}

:deep(.el-menu-item) {
  height: 50px;
  line-height: 50px;
}

:deep(.el-menu-item.is-active) {
  background-color: #263445 !important;
}

:deep(.el-menu-item:hover) {
  background-color: #263445 !important;
}
</style>

