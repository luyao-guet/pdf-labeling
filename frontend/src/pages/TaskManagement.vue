<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import { useFileStore } from '@/stores/file'
import { useUserStore } from '@/stores/user'
import { formConfigService, userService } from '@/api'
import type { Task, FormConfig, User } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Delete,
  Edit,
  User as UserIcon,
  Refresh,
  Search
} from '@element-plus/icons-vue'

const router = useRouter()
const taskStore = useTaskStore()
const fileStore = useFileStore()
const userStore = useUserStore()

// 状态
const createDialogVisible = ref(false)
const assignDialogVisible = ref(false)
const searchKeyword = ref('')
const statusFilter = ref('')
const formConfigs = ref<FormConfig[]>([])
const users = ref<User[]>([])
const selectedTask = ref<Task | null>(null)
const selectedUsers = ref<number[]>([])
const assignmentType = ref('ANNOTATION')

// 表单数据
const taskForm = ref({
  title: '',
  description: '',
  documentId: undefined as number | undefined,
  formConfigId: undefined as number | undefined
})

// 状态标签类型
const statusTagType = (status: string) => {
  const types: Record<string, string> = {
    'CREATED': 'info',
    'ASSIGNED': 'warning',
    'IN_PROGRESS': 'primary',
    'COMPLETED': 'success',
    'REVIEWED': 'success',
    'CLOSED': 'info'
  }
  return types[status] || 'info'
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

// 状态选项
const statusOptions = [
  { label: '全部', value: '' },
  { label: '已创建', value: 'CREATED' },
  { label: '已分配', value: 'ASSIGNED' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已审核', value: 'REVIEWED' },
  { label: '已关闭', value: 'CLOSED' }
]

// 分配类型选项
const assignmentTypeOptions = [
  { label: '标注', value: 'ANNOTATION' },
  { label: '审核', value: 'REVIEW' },
  { label: '检查', value: 'INSPECTION' },
  { label: '专家审核', value: 'EXPERT_REVIEW' }
]

// 加载数据
const loadData = async () => {
  await taskStore.fetchTasks({
    status: statusFilter.value || undefined
  })
}

// 加载表单配置
const loadFormConfigs = async () => {
  try {
    const response = await formConfigService.getFormConfigs()
    formConfigs.value = response.formConfigs
  } catch (e) {
    console.error('加载表单配置失败', e)
  }
}

// 加载用户列表
const loadUsers = async () => {
  try {
    users.value = await userService.getUsers()
  } catch (e) {
    console.error('加载用户失败', e)
  }
}

// 创建任务
const handleCreateTask = async () => {
  if (!taskForm.value.title || !taskForm.value.documentId) {
    ElMessage.warning('请填写任务标题并选择文档')
    return
  }
  
  const result = await taskStore.createTask({
    title: taskForm.value.title,
    description: taskForm.value.description,
    documentId: taskForm.value.documentId,
    formConfigId: taskForm.value.formConfigId
  })
  
  if (result) {
    createDialogVisible.value = false
    resetForm()
  }
}

// 分配任务
const openAssignDialog = (task: Task) => {
  selectedTask.value = task
  selectedUsers.value = []
  assignDialogVisible.value = true
}

const handleAssignTask = async () => {
  if (!selectedTask.value || selectedUsers.value.length === 0) {
    ElMessage.warning('请选择用户')
    return
  }
  
  const result = await taskStore.assignTask(selectedTask.value.id, {
    userIds: selectedUsers.value,
    assignmentType: assignmentType.value
  })
  
  if (result) {
    assignDialogVisible.value = false
    selectedUsers.value = []
  }
}

// 删除任务
const handleDeleteTask = async (task: Task) => {
  await ElMessageBox.confirm(
    `确定要删除任务 "${task.title}" 吗？`,
    '确认删除',
    { type: 'warning' }
  )
  await taskStore.deleteTask(task.id)
}

// 重置表单
const resetForm = () => {
  taskForm.value = {
    title: '',
    description: '',
    documentId: undefined,
    formConfigId: undefined
  }
}

// 打开创建对话框
const openCreateDialog = async () => {
  await Promise.all([
    fileStore.fetchDocuments({ size: 100 }),
    loadFormConfigs()
  ])
  createDialogVisible.value = true
}

// 格式化日期
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(async () => {
  await Promise.all([
    loadData(),
    loadUsers()
  ])
})
</script>

<template>
  <div class="task-management">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          创建任务
        </el-button>
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
      </div>
      <div class="toolbar-right">
        <el-select
          v-model="statusFilter"
          placeholder="状态筛选"
          clearable
          style="width: 150px; margin-right: 12px"
          @change="loadData"
        >
          <el-option
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索任务..."
          :prefix-icon="Search"
          clearable
          style="width: 250px"
        />
      </div>
    </div>

    <!-- 任务表格 -->
    <el-card>
      <el-table
        :data="taskStore.tasks"
        v-loading="taskStore.loading"
        stripe
      >
        <el-table-column label="ID" prop="id" width="80" />
        <el-table-column label="任务标题" prop="title" min-width="200" />
        <el-table-column label="文档" width="180">
          <template #default="{ row }">
            {{ row.document?.filename }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="100">
          <template #default="{ row }">
            <el-tag :type="priorityTagType(row.priority)" size="small">
              {{ row.priority }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建人" width="120">
          <template #default="{ row }">
            {{ row.createdBy?.username }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                type="primary"
                :icon="UserIcon"
                size="small"
                @click="openAssignDialog(row)"
                title="分配"
              />
              <el-button
                type="warning"
                :icon="Edit"
                size="small"
                title="编辑"
              />
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                @click="handleDeleteTask(row)"
                title="删除"
              />
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="taskStore.pagination.currentPage"
          :page-size="taskStore.pagination.pageSize"
          :total="taskStore.pagination.totalItems"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <!-- 创建任务对话框 -->
    <el-dialog v-model="createDialogVisible" title="创建任务" width="500px">
      <el-form :model="taskForm" label-width="100px">
        <el-form-item label="任务标题" required>
          <el-input v-model="taskForm.title" placeholder="请输入任务标题" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="taskForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入任务描述"
          />
        </el-form-item>
        <el-form-item label="选择文档" required>
          <el-select
            v-model="taskForm.documentId"
            placeholder="选择文档"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="doc in fileStore.documents"
              :key="doc.id"
              :label="doc.filename"
              :value="doc.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="表单模板">
          <el-select
            v-model="taskForm.formConfigId"
            placeholder="选择表单模板"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="fc in formConfigs"
              :key="fc.id"
              :label="fc.name"
              :value="fc.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateTask" :loading="taskStore.loading">
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 分配任务对话框 -->
    <el-dialog v-model="assignDialogVisible" title="分配任务" width="500px">
      <el-form label-width="100px">
        <el-form-item label="任务">
          <el-input :value="selectedTask?.title" disabled />
        </el-form-item>
        <el-form-item label="分配类型">
          <el-select v-model="assignmentType" style="width: 100%">
            <el-option
              v-for="opt in assignmentTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="选择用户" required>
          <el-select
            v-model="selectedUsers"
            multiple
            placeholder="选择用户"
            style="width: 100%"
          >
            <el-option
              v-for="user in users"
              :key="user.id"
              :label="`${user.username} (${user.role})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssignTask" :loading="taskStore.loading">
          分配
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.task-management {
  height: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>

