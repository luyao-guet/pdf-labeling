<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { qualityCheckService } from '@/api'
import type { QualityCheck } from '@/types'
import { ElMessage } from 'element-plus'
import { Refresh, Check } from '@element-plus/icons-vue'

// 状态
const loading = ref(false)
const qualityChecks = ref<QualityCheck[]>([])
const pagination = ref({
  currentPage: 1,
  totalItems: 0,
  totalPages: 0,
  pageSize: 20
})
const resolveDialogVisible = ref(false)
const selectedCheck = ref<QualityCheck | null>(null)
const resolutionForm = ref({
  selectedAnnotation: 'A' as 'A' | 'B',
  resolutionNotes: ''
})

// 状态标签类型
const statusTagType = (status: string) => {
  const types: Record<string, string> = {
    'PENDING': 'warning',
    'RESOLVED': 'success',
    'ESCALATED': 'danger'
  }
  return types[status] || 'info'
}

// 结果标签类型
const resultTagType = (result: string) => {
  const types: Record<string, string> = {
    'MATCH': 'success',
    'PARTIAL_MATCH': 'warning',
    'CONFLICT': 'danger'
  }
  return types[result] || 'info'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const response = await qualityCheckService.getQualityChecks({
      page: pagination.value.currentPage - 1,
      size: pagination.value.pageSize
    })
    qualityChecks.value = response.qualityChecks
    pagination.value.totalItems = response.totalItems
    pagination.value.totalPages = response.totalPages
  } catch (e) {
    ElMessage.error('加载质量检查数据失败')
  } finally {
    loading.value = false
  }
}

// 打开解决对话框
const openResolveDialog = (check: QualityCheck) => {
  selectedCheck.value = check
  resolutionForm.value = {
    selectedAnnotation: 'A',
    resolutionNotes: ''
  }
  resolveDialogVisible.value = true
}

// 解决冲突
const handleResolve = async () => {
  if (!selectedCheck.value) return
  
  loading.value = true
  try {
    await qualityCheckService.resolveQualityCheck(selectedCheck.value.id, resolutionForm.value)
    ElMessage.success('冲突已解决')
    resolveDialogVisible.value = false
    await loadData()
  } catch (e) {
    ElMessage.error('解决冲突失败')
  } finally {
    loading.value = false
  }
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
  <div class="quality-review">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </div>

    <!-- 质量检查表格 -->
    <el-card>
      <el-table :data="qualityChecks" v-loading="loading" stripe>
        <el-table-column label="ID" prop="id" width="80" />
        <el-table-column label="任务" min-width="200">
          <template #default="{ row }">
            <div>{{ row.task?.title }}</div>
            <div class="sub-text">{{ row.task?.document?.filename }}</div>
          </template>
        </el-table-column>
        <el-table-column label="标注者A" width="120">
          <template #default="{ row }">
            {{ row.annotatorA?.username }}
          </template>
        </el-table-column>
        <el-table-column label="标注者B" width="120">
          <template #default="{ row }">
            {{ row.annotatorB?.username }}
          </template>
        </el-table-column>
        <el-table-column label="比较结果" width="120">
          <template #default="{ row }">
            <el-tag :type="resultTagType(row.comparisonResult)" size="small">
              {{ row.comparisonResult }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'PENDING'"
              type="primary"
              :icon="Check"
              size="small"
              @click="openResolveDialog(row)"
            >
              解决
            </el-button>
            <span v-else class="resolved-by">
              {{ row.resolvedBy?.username }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          :page-size="pagination.pageSize"
          :total="pagination.totalItems"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <!-- 解决对话框 -->
    <el-dialog v-model="resolveDialogVisible" title="解决冲突" width="600px">
      <div v-if="selectedCheck">
        <el-alert
          title="请选择采用哪个标注者的结果"
          type="info"
          :closable="false"
          style="margin-bottom: 20px"
        />
        
        <el-form :model="resolutionForm" label-width="120px">
          <el-form-item label="选择结果">
            <el-radio-group v-model="resolutionForm.selectedAnnotation">
              <el-radio label="A">
                采用 {{ selectedCheck.annotatorA?.username }} 的标注
              </el-radio>
              <el-radio label="B">
                采用 {{ selectedCheck.annotatorB?.username }} 的标注
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="解决备注">
            <el-input
              v-model="resolutionForm.resolutionNotes"
              type="textarea"
              :rows="3"
              placeholder="请输入解决备注"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleResolve" :loading="loading">
          确认解决
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.quality-review {
  height: 100%;
}

.toolbar {
  margin-bottom: 16px;
}

.sub-text {
  font-size: 12px;
  color: #909399;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.resolved-by {
  color: #909399;
  font-size: 12px;
}
</style>

