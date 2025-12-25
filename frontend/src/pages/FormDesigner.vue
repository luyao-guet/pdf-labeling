<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formConfigService } from '@/api'
import type { FormConfig, FormField } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Delete,
  Edit,
  ArrowLeft,
  Rank,
  Refresh
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

// 状态
const loading = ref(false)
const formConfigs = ref<FormConfig[]>([])
const currentConfig = ref<FormConfig | null>(null)
const fields = ref<FormField[]>([])
const configDialogVisible = ref(false)
const fieldDialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingField = ref<FormField | null>(null)

// 表单配置表单
const configForm = ref({
  name: '',
  description: '',
  promptTemplate: '',
  isActive: true
})

// 字段表单
const fieldForm = ref({
  name: '',
  label: '',
  type: 'text',
  required: false,
  options: '',
  defaultValue: '',
  placeholder: ''
})

// 字段类型选项
const fieldTypes = [
  { label: '文本', value: 'text' },
  { label: '多行文本', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '下拉选择', value: 'select' },
  { label: '单选', value: 'radio' },
  { label: '多选', value: 'checkbox' },
  { label: '日期', value: 'date' }
]

// 加载表单配置列表
const loadFormConfigs = async () => {
  loading.value = true
  try {
    const response = await formConfigService.getFormConfigs()
    formConfigs.value = response.formConfigs
  } catch (e) {
    ElMessage.error('加载表单配置失败')
  } finally {
    loading.value = false
  }
}

// 加载字段
const loadFields = async (configId: number) => {
  loading.value = true
  try {
    const response = await formConfigService.getFormFields(configId)
    fields.value = response.fields || []
  } catch (e) {
    ElMessage.error('加载字段失败')
  } finally {
    loading.value = false
  }
}

// 选择配置
const selectConfig = async (config: FormConfig) => {
  currentConfig.value = config
  await loadFields(config.id)
}

// 打开创建配置对话框
const openCreateConfigDialog = () => {
  dialogMode.value = 'create'
  configForm.value = {
    name: '',
    description: '',
    promptTemplate: '',
    isActive: true
  }
  configDialogVisible.value = true
}

// 保存配置
const handleSaveConfig = async () => {
  if (!configForm.value.name.trim()) {
    ElMessage.warning('请输入表单名称')
    return
  }

  loading.value = true
  try {
    if (dialogMode.value === 'create') {
      const response = await formConfigService.createFormConfig(configForm.value)
      formConfigs.value.push(response.formConfig)
      ElMessage.success('表单配置创建成功')
    }
    configDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  } finally {
    loading.value = false
  }
}

// 删除配置
const handleDeleteConfig = async (config: FormConfig) => {
  await ElMessageBox.confirm(
    `确定要删除表单配置 "${config.name}" 吗？`,
    '确认删除',
    { type: 'warning' }
  )
  
  loading.value = true
  try {
    await formConfigService.deleteFormConfig(config.id)
    formConfigs.value = formConfigs.value.filter(c => c.id !== config.id)
    if (currentConfig.value?.id === config.id) {
      currentConfig.value = null
      fields.value = []
    }
    ElMessage.success('删除成功')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  } finally {
    loading.value = false
  }
}

// 打开添加字段对话框
const openAddFieldDialog = () => {
  dialogMode.value = 'create'
  editingField.value = null
  fieldForm.value = {
    name: '',
    label: '',
    type: 'text',
    required: false,
    options: '',
    defaultValue: '',
    placeholder: ''
  }
  fieldDialogVisible.value = true
}

// 打开编辑字段对话框
const openEditFieldDialog = (field: FormField) => {
  dialogMode.value = 'edit'
  editingField.value = field
  fieldForm.value = {
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options || '',
    defaultValue: field.defaultValue || '',
    placeholder: field.placeholder || ''
  }
  fieldDialogVisible.value = true
}

// 保存字段
const handleSaveField = async () => {
  if (!currentConfig.value) return
  if (!fieldForm.value.name.trim() || !fieldForm.value.label.trim()) {
    ElMessage.warning('请填写字段名和标签')
    return
  }

  loading.value = true
  try {
    if (dialogMode.value === 'create') {
      const response = await formConfigService.addFormField(currentConfig.value.id, {
        ...fieldForm.value,
        sortOrder: fields.value.length
      })
      fields.value.push(response.field)
      ElMessage.success('字段添加成功')
    } else if (editingField.value) {
      const response = await formConfigService.updateFormField(editingField.value.id, fieldForm.value)
      const index = fields.value.findIndex(f => f.id === editingField.value?.id)
      if (index !== -1) {
        fields.value[index] = response.field
      }
      ElMessage.success('字段更新成功')
    }
    fieldDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  } finally {
    loading.value = false
  }
}

// 删除字段
const handleDeleteField = async (field: FormField) => {
  await ElMessageBox.confirm(
    `确定要删除字段 "${field.label}" 吗？`,
    '确认删除',
    { type: 'warning' }
  )
  
  loading.value = true
  try {
    await formConfigService.deleteFormField(field.id)
    fields.value = fields.value.filter(f => f.id !== field.id)
    ElMessage.success('删除成功')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  } finally {
    loading.value = false
  }
}

// 返回
const goBack = () => {
  router.push('/categories')
}

onMounted(() => {
  loadFormConfigs()
})
</script>

<template>
  <div class="form-designer">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2 class="page-title">表单设计器</h2>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreateConfigDialog">
          新建表单
        </el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <!-- 表单配置列表 -->
      <el-col :span="8">
        <el-card class="config-list-card">
          <template #header>
            <span>表单配置列表</span>
          </template>
          <div class="config-list">
            <div
              v-for="config in formConfigs"
              :key="config.id"
              class="config-item"
              :class="{ active: currentConfig?.id === config.id }"
              @click="selectConfig(config)"
            >
              <div class="config-info">
                <div class="config-name">{{ config.name }}</div>
                <div class="config-desc">{{ config.description || '暂无描述' }}</div>
              </div>
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                circle
                @click.stop="handleDeleteConfig(config)"
              />
            </div>
            
            <el-empty
              v-if="formConfigs.length === 0"
              description="暂无表单配置"
            />
          </div>
        </el-card>
      </el-col>

      <!-- 字段列表 -->
      <el-col :span="16">
        <el-card class="field-list-card">
          <template #header>
            <div class="card-header">
              <span>{{ currentConfig?.name || '请选择表单配置' }} - 字段列表</span>
              <el-button
                v-if="currentConfig"
                type="primary"
                :icon="Plus"
                size="small"
                @click="openAddFieldDialog"
              >
                添加字段
              </el-button>
            </div>
          </template>
          
          <el-table
            v-if="currentConfig"
            :data="fields"
            v-loading="loading"
            stripe
          >
            <el-table-column label="排序" width="80">
              <template #default="{ $index }">
                {{ $index + 1 }}
              </template>
            </el-table-column>
            <el-table-column label="字段名" prop="name" width="150" />
            <el-table-column label="标签" prop="label" min-width="150" />
            <el-table-column label="类型" prop="type" width="100" />
            <el-table-column label="必填" width="80">
              <template #default="{ row }">
                <el-tag :type="row.required ? 'danger' : 'info'" size="small">
                  {{ row.required ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button-group>
                  <el-button
                    type="warning"
                    :icon="Edit"
                    size="small"
                    @click="openEditFieldDialog(row)"
                  />
                  <el-button
                    type="danger"
                    :icon="Delete"
                    size="small"
                    @click="handleDeleteField(row)"
                  />
                </el-button-group>
              </template>
            </el-table-column>
          </el-table>
          
          <el-empty
            v-else
            description="请从左侧选择一个表单配置"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 创建配置对话框 -->
    <el-dialog v-model="configDialogVisible" title="新建表单配置" width="500px">
      <el-form :model="configForm" label-width="100px">
        <el-form-item label="表单名称" required>
          <el-input v-model="configForm.name" placeholder="请输入表单名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="configForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述"
          />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="configForm.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveConfig" :loading="loading">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 字段对话框 -->
    <el-dialog
      v-model="fieldDialogVisible"
      :title="dialogMode === 'create' ? '添加字段' : '编辑字段'"
      width="500px"
    >
      <el-form :model="fieldForm" label-width="100px">
        <el-form-item label="字段名" required>
          <el-input v-model="fieldForm.name" placeholder="英文标识符" />
        </el-form-item>
        <el-form-item label="标签" required>
          <el-input v-model="fieldForm.label" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="fieldForm.type" style="width: 100%">
            <el-option
              v-for="t in fieldTypes"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="是否必填">
          <el-switch v-model="fieldForm.required" />
        </el-form-item>
        <el-form-item
          v-if="['select', 'radio', 'checkbox'].includes(fieldForm.type)"
          label="选项"
        >
          <el-input
            v-model="fieldForm.options"
            type="textarea"
            :rows="3"
            placeholder="每行一个选项，或JSON格式"
          />
        </el-form-item>
        <el-form-item label="默认值">
          <el-input v-model="fieldForm.defaultValue" placeholder="默认值" />
        </el-form-item>
        <el-form-item label="占位符">
          <el-input v-model="fieldForm.placeholder" placeholder="输入提示" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fieldDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveField" :loading="loading">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.form-designer {
  height: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
}

.config-list-card,
.field-list-card {
  height: calc(100vh - 200px);
}

.config-list {
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.config-item:hover {
  border-color: #409eff;
}

.config-item.active {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.config-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.config-desc {
  font-size: 12px;
  color: #909399;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

