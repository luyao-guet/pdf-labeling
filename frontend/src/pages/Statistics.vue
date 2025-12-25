<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { taskService } from '@/api'
import { ElMessage } from 'element-plus'
import { Refresh, TrendCharts, DataAnalysis } from '@element-plus/icons-vue'

// 状态
const loading = ref(false)
const statistics = ref<any>(null)
const userPerformance = ref<any[]>([])

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const [statsResponse, performanceResponse] = await Promise.all([
      taskService.getTaskStatistics(),
      taskService.getUserPerformance()
    ])
    statistics.value = statsResponse.statistics
    userPerformance.value = performanceResponse.userPerformance || []
  } catch (e) {
    ElMessage.error('加载统计数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="statistics" v-loading="loading">
    <!-- 工具栏 -->
    <div class="toolbar">
      <h2 class="page-title">
        <el-icon><TrendCharts /></el-icon>
        统计分析
      </h2>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row" v-if="statistics">
      <el-col :xs="12" :sm="8" :md="6">
        <el-card class="stat-card" shadow="hover">
          <el-statistic title="总任务数" :value="statistics.totalTasks || 0" />
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card class="stat-card" shadow="hover">
          <el-statistic title="已完成任务" :value="statistics.completedTasks || 0" />
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card class="stat-card" shadow="hover">
          <el-statistic title="进行中任务" :value="statistics.inProgressTasks || 0" />
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card class="stat-card" shadow="hover">
          <el-statistic
            title="完成率"
            :value="statistics.completionRate || 0"
            suffix="%"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 用户表现 -->
    <el-card class="performance-card">
      <template #header>
        <div class="card-header">
          <el-icon><DataAnalysis /></el-icon>
          <span>用户表现排行</span>
        </div>
      </template>
      <el-table :data="userPerformance" stripe>
        <el-table-column label="排名" width="80">
          <template #default="{ $index }">
            <el-tag
              :type="$index < 3 ? 'warning' : 'info'"
              size="small"
            >
              {{ $index + 1 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用户" prop="username" min-width="150" />
        <el-table-column label="完成任务数" prop="completedTasks" width="120" />
        <el-table-column label="待处理任务" prop="pendingTasks" width="120" />
        <el-table-column label="平均完成时间" prop="avgCompletionTime" width="150">
          <template #default="{ row }">
            {{ row.avgCompletionTime ? `${row.avgCompletionTime}小时` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="准确率" prop="accuracy" width="120">
          <template #default="{ row }">
            <el-progress
              :percentage="row.accuracy || 0"
              :stroke-width="8"
              :show-text="true"
            />
          </template>
        </el-table-column>
      </el-table>
      
      <el-empty
        v-if="userPerformance.length === 0"
        description="暂无用户表现数据"
      />
    </el-card>
  </div>
</template>

<style scoped>
.statistics {
  height: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-row .el-col {
  margin-bottom: 16px;
}

.stat-card {
  text-align: center;
}

.performance-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
</style>

