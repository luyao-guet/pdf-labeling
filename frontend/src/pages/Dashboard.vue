<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useFileStore } from '@/stores/file'
import { useTaskStore } from '@/stores/task'
import { Document, List, User, Trophy } from '@element-plus/icons-vue'

const userStore = useUserStore()
const fileStore = useFileStore()
const taskStore = useTaskStore()

const loading = ref(false)

const roleLabels: Record<string, string> = {
  admin: '管理员',
  annotator: '标注员',
  reviewer: '审核员',
  expert: '专家'
}

// 统计数据
const stats = computed(() => ({
  totalFiles: fileStore.pagination.totalItems,
  totalTasks: taskStore.pagination.totalItems,
  completedTasks: taskStore.tasks.filter(t => t.status === 'COMPLETED' || t.status === 'CLOSED').length,
  userScore: userStore.user?.score || 0
}))

const taskProgress = computed(() => {
  if (stats.value.totalTasks === 0) return 0
  return Math.round((stats.value.completedTasks / stats.value.totalTasks) * 100)
})

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([
      fileStore.fetchDocuments({ size: 100 }),
      taskStore.fetchTasks({ size: 100 })
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <h2 class="page-title">仪表板</h2>
    
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2)">
              <el-icon :size="28"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalFiles }}</div>
              <div class="stat-label">总文件数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c)">
              <el-icon :size="28"><List /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalTasks }}</div>
              <div class="stat-label">总任务数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe)">
              <el-icon :size="28"><List /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.completedTasks }}</div>
              <div class="stat-label">已完成任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140)">
              <el-icon :size="28"><Trophy /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.userScore }}</div>
              <div class="stat-label">我的积分</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 详细信息卡片 -->
    <el-row :gutter="20" class="detail-row">
      <el-col :xs="24" :md="12">
        <el-card class="detail-card">
          <template #header>
            <span class="card-title">任务完成进度</span>
          </template>
          <div class="progress-container">
            <el-progress
              type="dashboard"
              :percentage="taskProgress"
              :width="200"
              :stroke-width="12"
            >
              <template #default="{ percentage }">
                <div class="progress-text">
                  <span class="percentage">{{ percentage }}%</span>
                  <span class="label">完成率</span>
                </div>
              </template>
            </el-progress>
            <div class="progress-stats">
              <div class="progress-stat">
                <span class="value">{{ stats.completedTasks }}</span>
                <span class="label">已完成</span>
              </div>
              <div class="progress-stat">
                <span class="value">{{ stats.totalTasks - stats.completedTasks }}</span>
                <span class="label">进行中</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :md="12">
        <el-card class="detail-card">
          <template #header>
            <span class="card-title">用户信息</span>
          </template>
          <div class="user-info-container" v-if="userStore.user">
            <el-avatar :size="80" :icon="User" class="user-avatar" />
            <el-descriptions :column="1" border>
              <el-descriptions-item label="用户名">
                {{ userStore.user.username }}
              </el-descriptions-item>
              <el-descriptions-item label="角色">
                <el-tag :type="userStore.user.role === 'admin' ? 'danger' : 'primary'">
                  {{ roleLabels[userStore.user.role] || userStore.user.role }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="邮箱">
                {{ userStore.user.email }}
              </el-descriptions-item>
              <el-descriptions-item label="积分">
                <span class="score">{{ userStore.user.score }}</span>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 0;
}

.page-title {
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stats-row {
  margin-bottom: 24px;
}

.stats-row .el-col {
  margin-bottom: 16px;
}

.stat-card {
  border-radius: 12px;
  overflow: hidden;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.detail-row .el-col {
  margin-bottom: 16px;
}

.detail-card {
  border-radius: 12px;
  min-height: 320px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.progress-text {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-text .percentage {
  font-size: 32px;
  font-weight: 700;
  color: #409eff;
}

.progress-text .label {
  font-size: 14px;
  color: #909399;
}

.progress-stats {
  display: flex;
  gap: 40px;
  margin-top: 24px;
}

.progress-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-stat .value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.progress-stat .label {
  font-size: 12px;
  color: #909399;
}

.user-info-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.user-avatar {
  margin-bottom: 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.score {
  font-weight: 600;
  color: #e6a23c;
}

:deep(.el-descriptions) {
  width: 100%;
}
</style>

