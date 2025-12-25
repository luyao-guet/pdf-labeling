<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import type { User } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Edit, Refresh } from '@element-plus/icons-vue'

const userStore = useUserStore()

// 状态
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingUser = ref<User | null>(null)

// 表单数据
const formData = ref({
  username: '',
  email: '',
  password: '',
  role: 'annotator'
})

// 角色选项
const roleOptions = [
  { label: '管理员', value: 'ADMIN' },
  { label: '标注员', value: 'ANNOTATOR' },
  { label: '审核员', value: 'REVIEWER' },
  { label: '专家', value: 'EXPERT' }
]

// 角色标签类型
const roleTagType = (role: string) => {
  const types: Record<string, string> = {
    'admin': 'danger',
    'annotator': 'primary',
    'reviewer': 'warning',
    'expert': 'success'
  }
  return types[role] || 'info'
}

// 角色标签
const roleLabel = (role: string) => {
  const labels: Record<string, string> = {
    'admin': '管理员',
    'annotator': '标注员',
    'reviewer': '审核员',
    'expert': '专家'
  }
  return labels[role] || role
}

// 打开创建对话框
const openCreateDialog = () => {
  dialogMode.value = 'create'
  formData.value = {
    username: '',
    email: '',
    password: '',
    role: 'annotator'
  }
  dialogVisible.value = true
}

// 打开编辑对话框
const openEditDialog = (user: User) => {
  dialogMode.value = 'edit'
  editingUser.value = user
  formData.value = {
    username: user.username,
    email: user.email,
    password: '',
    role: user.role.toUpperCase()
  }
  dialogVisible.value = true
}

// 保存用户
const handleSave = async () => {
  if (!formData.value.username.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (!formData.value.email.trim()) {
    ElMessage.warning('请输入邮箱')
    return
  }

  const userData = {
    username: formData.value.username,
    email: formData.value.email,
    role: formData.value.role,
    ...(formData.value.password ? { password: formData.value.password } : {})
  }

  let success = false
  if (dialogMode.value === 'create') {
    if (!formData.value.password) {
      ElMessage.warning('请输入密码')
      return
    }
    success = await userStore.createUser(userData)
  } else if (editingUser.value) {
    success = await userStore.updateUser(editingUser.value.id, userData)
  }
  
  if (success) {
    dialogVisible.value = false
  }
}

// 删除用户
const handleDelete = async (user: User) => {
  await ElMessageBox.confirm(
    `确定要删除用户 "${user.username}" 吗？`,
    '确认删除',
    { type: 'warning' }
  )
  await userStore.deleteUser(user.id)
}

onMounted(() => {
  userStore.fetchUsers()
})
</script>

<template>
  <div class="user-management">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          新建用户
        </el-button>
        <el-button :icon="Refresh" @click="userStore.fetchUsers">刷新</el-button>
      </div>
    </div>

    <!-- 用户表格 -->
    <el-card>
      <el-table :data="userStore.users" v-loading="userStore.loading" stripe>
        <el-table-column label="ID" prop="id" width="80" />
        <el-table-column label="用户名" prop="username" min-width="150" />
        <el-table-column label="邮箱" prop="email" min-width="200" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small">
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分" prop="score" width="100" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                type="warning"
                :icon="Edit"
                size="small"
                @click="openEditDialog(row)"
              />
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                @click="handleDelete(row)"
              />
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建用户' : '编辑用户'"
      width="500px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="用户名" required>
          <el-input v-model="formData.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="邮箱" required>
          <el-input v-model="formData.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item :label="dialogMode === 'create' ? '密码' : '新密码'" :required="dialogMode === 'create'">
          <el-input
            v-model="formData.password"
            type="password"
            :placeholder="dialogMode === 'create' ? '请输入密码' : '留空则不修改'"
            show-password
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="formData.role" style="width: 100%">
            <el-option
              v-for="opt in roleOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="userStore.loading">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.user-management {
  height: 100%;
}

.toolbar {
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}
</style>

