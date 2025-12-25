import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'
import { authService, userService } from '@/api'
import { ElMessage } from 'element-plus'

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null)
  const users = ref<User[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isLoggedIn = computed(() => !!user.value)
  const userRole = computed(() => user.value?.role)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const username = computed(() => user.value?.username)

  // Actions
  const setUser = (userData: User) => {
    user.value = userData
  }

  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (message: string | null) => {
    error.value = message
  }

  const login = async (username: string, password: string) => {
    loading.value = true
    error.value = null
    try {
      const response = await authService.login({ username, password })
      
      // 保存 token
      localStorage.setItem('token', response.token)

      // 角色映射
      const roleMap: Record<string, UserRole> = {
        'ADMIN': 'admin',
        'ANNOTATOR': 'annotator',
        'REVIEWER': 'reviewer',
        'EXPERT': 'expert'
      }

      const userData: User = {
        id: response.id,
        username: response.username,
        email: response.email,
        role: roleMap[response.role] || 'annotator',
        score: response.score,
      }

      // 保存用户信息
      localStorage.setItem('user', JSON.stringify(userData))
      user.value = userData

      ElMessage.success('登录成功')
      return true
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || '登录失败'
      error.value = errorMessage
      ElMessage.error(errorMessage)
      return false
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    ElMessage.success('已退出登录')
  }

  const fetchUsers = async () => {
    loading.value = true
    try {
      const data = await userService.getUsers()
      users.value = data
    } catch (err: any) {
      ElMessage.error('获取用户列表失败')
    } finally {
      loading.value = false
    }
  }

  const createUser = async (userData: any) => {
    loading.value = true
    try {
      const newUser = await userService.createUser(userData)
      users.value.push(newUser)
      ElMessage.success('用户创建成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '创建用户失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const updateUser = async (id: number, userData: any) => {
    loading.value = true
    try {
      const updatedUser = await userService.updateUser(id, userData)
      const index = users.value.findIndex(u => u.id === id)
      if (index !== -1) {
        users.value[index] = updatedUser
      }
      ElMessage.success('用户更新成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '更新用户失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const deleteUser = async (id: number) => {
    loading.value = true
    try {
      await userService.deleteUser(id)
      users.value = users.value.filter(u => u.id !== id)
      ElMessage.success('用户删除成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '删除用户失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const restoreFromStorage = () => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')

    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr)
        if (userData && userData.id && userData.username) {
          user.value = userData
          return true
        }
      } catch (e) {
        console.error('Failed to restore user from storage')
      }
    }
    return false
  }

  return {
    // State
    user,
    users,
    loading,
    error,
    // Getters
    isLoggedIn,
    userRole,
    isAdmin,
    username,
    // Actions
    setUser,
    setLoading,
    setError,
    login,
    logout,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    restoreFromStorage
  }
})

