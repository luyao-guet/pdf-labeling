<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ArrowDown, User, SwitchButton } from '@element-plus/icons-vue'

defineProps<{
  title?: string
}>()

const router = useRouter()
const userStore = useUserStore()

const roleLabels: Record<string, string> = {
  admin: '管理员',
  annotator: '标注员',
  reviewer: '审核员',
  expert: '专家'
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <el-header class="header">
    <div class="header-left">
      <h2 class="page-title">{{ title || '数据AI自动化处理审核平台' }}</h2>
    </div>
    
    <div class="header-right">
      <el-dropdown v-if="userStore.user" trigger="click">
        <div class="user-info">
          <el-avatar :size="32" :icon="User" />
          <span class="username">{{ userStore.user.username }}</span>
          <el-tag size="small" type="info">
            {{ roleLabels[userStore.user.role] || userStore.user.role }}
          </el-tag>
          <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              <el-icon><User /></el-icon>
              积分: {{ userStore.user.score }}
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-header>
</template>

<style scoped>
.header {
  background-color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #606266;
}

.dropdown-icon {
  color: #909399;
}
</style>

