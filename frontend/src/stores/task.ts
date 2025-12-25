import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Task, TaskAssignment } from '@/types'
import { taskService } from '@/api'
import { ElMessage } from 'element-plus'

export const useTaskStore = defineStore('task', () => {
  // State
  const tasks = ref<Task[]>([])
  const myTasks = ref<Array<{ assignment: TaskAssignment; task: Task }>>([])
  const currentTask = ref<Task | null>(null)
  const loading = ref(false)
  const pagination = ref({
    currentPage: 1,
    totalItems: 0,
    totalPages: 0,
    pageSize: 20
  })
  const myTasksPagination = ref({
    currentPage: 1,
    totalItems: 0,
    totalPages: 0,
    pageSize: 20
  })

  // Actions
  const fetchTasks = async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
    documentId?: number
    categoryId?: number
    formConfigId?: number
    status?: string
    priority?: string
  }) => {
    loading.value = true
    try {
      const response = await taskService.getTasks({
        page: params?.page ?? pagination.value.currentPage - 1,
        size: params?.size ?? pagination.value.pageSize,
        ...params
      })
      tasks.value = response.tasks
      pagination.value = {
        currentPage: response.currentPage + 1,
        totalItems: response.totalItems,
        totalPages: response.totalPages,
        pageSize: params?.size ?? pagination.value.pageSize
      }
    } catch (err: any) {
      ElMessage.error('获取任务列表失败')
    } finally {
      loading.value = false
    }
  }

  const fetchMyTasks = async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }) => {
    loading.value = true
    try {
      const response = await taskService.getMyTasks({
        page: params?.page ?? myTasksPagination.value.currentPage - 1,
        size: params?.size ?? myTasksPagination.value.pageSize,
        ...params
      })
      myTasks.value = response.assignments
      myTasksPagination.value = {
        currentPage: response.currentPage + 1,
        totalItems: response.totalItems,
        totalPages: response.totalPages,
        pageSize: params?.size ?? myTasksPagination.value.pageSize
      }
    } catch (err: any) {
      ElMessage.error('获取我的任务失败')
    } finally {
      loading.value = false
    }
  }

  const createTask = async (taskData: {
    title: string
    description?: string
    documentId: number
    categoryId?: number
    formConfigId?: number
  }) => {
    loading.value = true
    try {
      const response = await taskService.createTask(taskData)
      tasks.value.unshift(response.task)
      ElMessage.success('任务创建成功')
      return response.task
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '任务创建失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const createBatchTasks = async (batchData: {
    batchName: string
    documentIds: number[]
    categoryId?: number
    formConfigId?: number
  }) => {
    loading.value = true
    try {
      const response = await taskService.createBatchTasks(batchData)
      ElMessage.success(`批量创建成功: ${response.successCount}个任务`)
      await fetchTasks()
      return response
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '批量创建失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const updateTask = async (id: number, taskData: {
    title?: string
    description?: string
    status?: string
    priority?: string
    formConfigId?: number
    documentTypeId?: number
  }) => {
    loading.value = true
    try {
      const response = await taskService.updateTask(id, taskData)
      const index = tasks.value.findIndex(t => t.id === id)
      if (index !== -1) {
        tasks.value[index] = response.task
      }
      ElMessage.success('任务更新成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '任务更新失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const deleteTask = async (id: number) => {
    loading.value = true
    try {
      await taskService.deleteTask(id)
      tasks.value = tasks.value.filter(t => t.id !== id)
      ElMessage.success('任务删除成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '任务删除失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const deleteBatchTasks = async (taskIds: number[]) => {
    loading.value = true
    try {
      const response = await taskService.deleteBatchTasks(taskIds)
      ElMessage.success(`批量删除成功: ${response.successCount}个任务`)
      await fetchTasks()
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '批量删除失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const getTaskById = async (id: number) => {
    loading.value = true
    try {
      const response = await taskService.getTaskById(id)
      currentTask.value = response.task
      return response.task
    } catch (err: any) {
      ElMessage.error('获取任务详情失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const assignTask = async (taskId: number, assignmentData: {
    userId?: number
    userIds?: number[]
    assignmentType: string
  }) => {
    loading.value = true
    try {
      const response = await taskService.assignTask(taskId, assignmentData)
      ElMessage.success('任务分配成功')
      await fetchTasks()
      return response.assignment
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '任务分配失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const getTaskStatistics = async () => {
    try {
      const response = await taskService.getTaskStatistics()
      return response.statistics
    } catch (err: any) {
      ElMessage.error('获取任务统计失败')
      return null
    }
  }

  const setCurrentTask = (task: Task | null) => {
    currentTask.value = task
  }

  return {
    // State
    tasks,
    myTasks,
    currentTask,
    loading,
    pagination,
    myTasksPagination,
    // Actions
    fetchTasks,
    fetchMyTasks,
    createTask,
    createBatchTasks,
    updateTask,
    deleteTask,
    deleteBatchTasks,
    getTaskById,
    assignTask,
    getTaskStatistics,
    setCurrentTask
  }
})

