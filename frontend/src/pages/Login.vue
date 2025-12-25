<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import type { FormInstance, FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()

interface LoginForm {
  username: string
  password: string
}

const form = reactive<LoginForm>({
  username: '',
  password: ''
})

const rules: FormRules<LoginForm> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      // 测试环境统一使用 password
      const success = await userStore.login(form.username, 'password')
      if (success) {
        router.push('/')
      }
    }
  })
}
</script>

<template>
  <div class="login-container">
    <div class="login-background">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>
    
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <h1>数据AI自动化处理审核平台</h1>
          <p class="subtitle">Data Annotation Platform</p>
        </div>
      </template>
      
      <div class="test-hint">
        <el-alert
          title="测试环境"
          type="info"
          description="所有用户密码均为 password"
          :closable="false"
          show-icon
        />
      </div>
      
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            size="large"
            :prefix-icon="User"
          />
        </el-form-item>
        
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="userStore.loading"
            @click="handleSubmit"
            class="login-button"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="test-accounts">
        <el-divider>测试账号</el-divider>
        <div class="accounts-list">
          <el-tag type="success">管理员: admin</el-tag>
          <el-tag type="primary">标注员: annotator</el-tag>
          <el-tag type="warning">审核员: reviewer</el-tag>
          <el-tag type="danger">专家: expert</el-tag>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.login-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.circle-1 {
  width: 400px;
  height: 400px;
  top: -100px;
  left: -100px;
  animation: float 8s ease-in-out infinite;
}

.circle-2 {
  width: 300px;
  height: 300px;
  bottom: -50px;
  right: -50px;
  animation: float 6s ease-in-out infinite reverse;
}

.circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  left: 10%;
  animation: float 10s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(10deg);
  }
}

.login-card {
  width: 420px;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  z-index: 1;
}

.card-header {
  text-align: center;
}

.card-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  color: #303133;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.test-hint {
  margin-bottom: 20px;
}

.login-button {
  width: 100%;
}

.test-accounts {
  margin-top: 20px;
}

.accounts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

:deep(.el-divider__text) {
  color: #909399;
  font-size: 12px;
}
</style>

