<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'
import { useAnnotationStore } from '@/stores/annotation'
import { formConfigService } from '@/api'
import type { Task, FormField } from '@/types'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Document,
  Check,
  Close,
  RefreshRight
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const annotationStore = useAnnotationStore()

// 状态
const loading = ref(false)
const task = ref<Task | null>(null)
const formFields = ref<FormField[]>([])
const formData = reactive<Record<string, any>>({})
const currentAssignment = computed(() => {
  return task.value?.assignments?.[0]
})

// 获取任务ID
const taskId = computed(() => Number(route.params.taskId))

// 加载任务数据
const loadTask = async () => {
  loading.value = true
  try {
    const result = await taskStore.getTaskById(taskId.value)
    if (result) {
      task.value = result
      
      // 加载表单字段
      if (result.formConfig?.id) {
        const fieldsResponse = await formConfigService.getFormFields(result.formConfig.id)
        formFields.value = fieldsResponse.fields || []
        
        // 初始化表单数据
        formFields.value.forEach(field => {
          formData[field.name] = field.defaultValue || ''
        })
      }
      
      // 加载已有标注
      if (result.id) {
        const annotations = await annotationStore.fetchTaskAnnotations(result.id)
        if (annotations && annotations.length > 0) {
          const latestAnnotation = annotations[0]
          try {
            const data = JSON.parse(latestAnnotation.annotationData)
            Object.assign(formData, data)
          } catch (e) {
            console.error('解析标注数据失败', e)
          }
        }
      }
    }
  } catch (e) {
    ElMessage.error('加载任务失败')
  } finally {
    loading.value = false
  }
}

// 保存草稿
const saveDraft = async () => {
  if (!task.value || !currentAssignment.value) return
  
  const result = await annotationStore.saveDraftAnnotation({
    taskId: task.value.id,
    taskAssignmentId: currentAssignment.value.id,
    documentId: task.value.document.id,
    annotationData: formData
  })
  
  if (result) {
    ElMessage.success('草稿已保存')
  }
}

// 提交标注
const submitAnnotation = async () => {
  if (!task.value || !currentAssignment.value) return
  
  // 验证必填字段
  const requiredFields = formFields.value.filter(f => f.required)
  for (const field of requiredFields) {
    if (!formData[field.name]) {
      ElMessage.warning(`请填写 ${field.label}`)
      return
    }
  }
  
  const result = await annotationStore.submitAnnotation({
    taskId: task.value.id,
    taskAssignmentId: currentAssignment.value.id,
    documentId: task.value.document.id,
    annotationData: formData
  })
  
  if (result) {
    ElMessage.success('标注提交成功')
    router.push('/my-tasks')
  }
}

// 返回
const goBack = () => {
  router.push('/my-tasks')
}

// 渲染表单项
const getFieldComponent = (field: FormField) => {
  switch (field.type) {
    case 'textarea':
      return 'el-input'
    case 'select':
      return 'el-select'
    case 'radio':
      return 'el-radio-group'
    case 'checkbox':
      return 'el-checkbox-group'
    case 'number':
      return 'el-input-number'
    case 'date':
      return 'el-date-picker'
    default:
      return 'el-input'
  }
}

// 解析选项
const parseOptions = (optionsStr?: string) => {
  if (!optionsStr) return []
  try {
    return JSON.parse(optionsStr)
  } catch {
    return optionsStr.split(',').map(s => s.trim())
  }
}

onMounted(() => {
  loadTask()
})
</script>

<template>
  <div class="annotation-workbench" v-loading="loading">
    <!-- 顶部工具栏 -->
    <div class="workbench-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2 v-if="task" class="task-title">{{ task.title }}</h2>
      </div>
      <div class="header-right">
        <el-button @click="saveDraft" :loading="annotationStore.loading">
          保存草稿
        </el-button>
        <el-button type="primary" :icon="Check" @click="submitAnnotation" :loading="annotationStore.loading">
          提交标注
        </el-button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="workbench-content" v-if="task">
      <el-row :gutter="20">
        <!-- 文档预览区 -->
        <el-col :span="12">
          <el-card class="preview-card">
            <template #header>
              <div class="card-header">
                <span><el-icon><Document /></el-icon> 文档预览</span>
                <span class="filename">{{ task.document?.filename }}</span>
              </div>
            </template>
            <div class="preview-container">
              <iframe
                :src="`http://localhost:8080/api/documents/${task.document?.id}/preview`"
                class="preview-iframe"
              />
            </div>
          </el-card>
        </el-col>

        <!-- 标注表单区 -->
        <el-col :span="12">
          <el-card class="form-card">
            <template #header>
              <div class="card-header">
                <span>标注表单</span>
                <el-tag v-if="task.formConfig">{{ task.formConfig.name }}</el-tag>
              </div>
            </template>
            
            <el-form
              v-if="formFields.length > 0"
              :model="formData"
              label-position="top"
              class="annotation-form"
            >
              <el-form-item
                v-for="field in formFields"
                :key="field.id"
                :label="field.label"
                :required="field.required"
              >
                <!-- 文本输入 -->
                <el-input
                  v-if="field.type === 'text'"
                  v-model="formData[field.name]"
                  :placeholder="field.placeholder || `请输入${field.label}`"
                />
                
                <!-- 多行文本 -->
                <el-input
                  v-else-if="field.type === 'textarea'"
                  v-model="formData[field.name]"
                  type="textarea"
                  :rows="3"
                  :placeholder="field.placeholder || `请输入${field.label}`"
                />
                
                <!-- 数字 -->
                <el-input-number
                  v-else-if="field.type === 'number'"
                  v-model="formData[field.name]"
                  style="width: 100%"
                />
                
                <!-- 下拉选择 -->
                <el-select
                  v-else-if="field.type === 'select'"
                  v-model="formData[field.name]"
                  :placeholder="field.placeholder || `请选择${field.label}`"
                  style="width: 100%"
                >
                  <el-option
                    v-for="opt in parseOptions(field.options)"
                    :key="opt"
                    :label="opt"
                    :value="opt"
                  />
                </el-select>
                
                <!-- 单选 -->
                <el-radio-group
                  v-else-if="field.type === 'radio'"
                  v-model="formData[field.name]"
                >
                  <el-radio
                    v-for="opt in parseOptions(field.options)"
                    :key="opt"
                    :label="opt"
                  >
                    {{ opt }}
                  </el-radio>
                </el-radio-group>
                
                <!-- 多选 -->
                <el-checkbox-group
                  v-else-if="field.type === 'checkbox'"
                  v-model="formData[field.name]"
                >
                  <el-checkbox
                    v-for="opt in parseOptions(field.options)"
                    :key="opt"
                    :label="opt"
                  >
                    {{ opt }}
                  </el-checkbox>
                </el-checkbox-group>
                
                <!-- 日期 -->
                <el-date-picker
                  v-else-if="field.type === 'date'"
                  v-model="formData[field.name]"
                  type="date"
                  :placeholder="field.placeholder || `请选择${field.label}`"
                  style="width: 100%"
                />
                
                <!-- 默认文本 -->
                <el-input
                  v-else
                  v-model="formData[field.name]"
                  :placeholder="field.placeholder || `请输入${field.label}`"
                />
              </el-form-item>
            </el-form>
            
            <el-empty
              v-else
              description="暂无表单字段配置"
            />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 任务不存在 -->
    <el-empty
      v-else-if="!loading"
      description="任务不存在或已被删除"
    >
      <el-button type="primary" @click="goBack">返回任务列表</el-button>
    </el-empty>
  </div>
</template>

<style scoped>
.annotation-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.workbench-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.task-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  gap: 8px;
}

.workbench-content {
  flex: 1;
  overflow: hidden;
}

.preview-card,
.form-card {
  height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filename {
  font-size: 12px;
  color: #909399;
}

.preview-container {
  flex: 1;
  min-height: 0;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  min-height: 500px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.annotation-form {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
  padding-right: 8px;
}

:deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

