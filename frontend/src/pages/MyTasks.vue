<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import type { TaskAssignment, Task } from '@/types'
import { Refresh, Edit } from '@element-plus/icons-vue'

const router = useRouter()
const taskStore = useTaskStore()

// 状态标签类型
const statusTagType = (status: string) => {
  const types: Record<string, string> = {
    'ASSIGNED': 'warning',
    'IN_PROGRESS': 'primary',
    'COMPLETED': 'success',
    'REJECTED': 'danger'
  }
  return types[status] || 'info'
}

// 分配类型标签
const assignmentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'ANNOTATION': '标注',
    'REVIEW': '审核',
    'INSPECTION': '检查',
    'EXPERT_REVIEW': '专家审核',
    'AI_ANNOTATION': 'AI标注'
  }
  return labels[type] || type
}

// 优先级标签类型
const priorityTagType = (priority: string) => {
  const types: Record<string, string> = {
    'LOW': 'info',
    'NORMAL': '',
    'HIGH': 'warning',
    'URGENT': 'danger'
  }
  return types[priority] || ''
}

// 加载数据
const loadData = async () => {
  await taskStore.fetchMyTasks()
}

// 开始任务
const startTask = (task: Task, assignment: TaskAssignment) => {
  router.push(`/annotation/${task.id}`)
}

// 格式化日期
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="my-tasks">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">我的任务</h2>
      </div>
      <div class="toolbar-right">
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
      </div>
    </div>

    <!-- 任务列表 -->
    <el-card>
      <el-table
        :data="taskStore.myTasks"
        v-loading="taskStore.loading"
        stripe
      >
        <el-table-column label="任务标题" min-width="200">
          <template #default="{ row }">
            {{ row.task?.title }}
          </template>
        </el-table-column>
        <el-table-column label="文档" width="180">
          <template #default="{ row }">
            {{ row.task?.document?.filename }}
          </template>
        </el-table-column>
        <el-table-column label="任务类型" width="120">
          <template #default="{ row }">
            <el-tag type="primary" size="small">
              {{ assignmentTypeLabel(row.assignment?.assignmentType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.assignment?.status)" size="small">
              {{ row.assignment?.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="100">
          <template #default="{ row }">
            <el-tag :type="priorityTagType(row.task?.priority)" size="small">
              {{ row.task?.priority }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分配时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.assignment?.assignedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              :icon="Edit"
              @click="startTask(row.task, row.assignment)"
            >
              开始
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="taskStore.myTasksPagination.currentPage"
          :page-size="taskStore.myTasksPagination.pageSize"
          :total="taskStore.myTasksPagination.totalItems"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <!-- 空状态 -->
    <el-empty
      v-if="!taskStore.loading && taskStore.myTasks.length === 0"
      description="暂无分配的任务"
    />
  </div>
</template>

<style scoped>
.my-tasks {
  height: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>

