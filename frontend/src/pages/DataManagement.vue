<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFileStore } from '@/stores/file'
import { useAnnotationStore } from '@/stores/annotation'
import { annotationService } from '@/api'
import type { Document, AnnotationHistoryEntry } from '@/types'
import { ElMessage } from 'element-plus'
import {
  Search,
  Refresh,
  Document as DocIcon,
  View,
  Clock
} from '@element-plus/icons-vue'

const fileStore = useFileStore()
const annotationStore = useAnnotationStore()

// 状态
const searchKeyword = ref('')
const selectedDocument = ref<Document | null>(null)
const historyDialogVisible = ref(false)
const archiveDialogVisible = ref(false)
const documentArchive = ref<any>(null)
const annotationHistory = ref<AnnotationHistoryEntry[]>([])
const conflictInfo = ref<any>(null)

// 过滤后的文档
const filteredDocuments = computed(() => {
  if (!searchKeyword.value) return fileStore.documents
  return fileStore.documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 加载数据
const loadData = async () => {
  await fileStore.fetchDocuments({ size: 100 })
}

// 查看归档数据
const viewArchive = async (doc: Document) => {
  selectedDocument.value = doc
  try {
    const response = await annotationService.getDocumentArchive(doc.id)
    documentArchive.value = response.archive
    archiveDialogVisible.value = true
  } catch (e) {
    ElMessage.error('获取归档数据失败')
  }
}

// 查看标注历史
const viewHistory = async (doc: Document) => {
  selectedDocument.value = doc
  try {
    const response = await annotationService.getDocumentAnnotationHistory(doc.id)
    annotationHistory.value = response.history
    historyDialogVisible.value = true
  } catch (e) {
    ElMessage.error('获取标注历史失败')
  }
}

// 检查冲突
const checkConflicts = async (doc: Document) => {
  try {
    const response = await annotationService.getDocumentConflicts(doc.id)
    if (response.conflictCount > 0) {
      conflictInfo.value = response
      ElMessage.warning(`发现 ${response.conflictCount} 个冲突`)
    } else {
      ElMessage.success('没有冲突')
    }
  } catch (e) {
    ElMessage.error('检查冲突失败')
  }
}

// 格式化日期
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

// 操作类型标签
const actionTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'CREATE': '创建',
    'UPDATE': '更新',
    'DELETE': '删除'
  }
  return labels[type] || type
}

const actionTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    'CREATE': 'success',
    'UPDATE': 'warning',
    'DELETE': 'danger'
  }
  return colors[type] || 'info'
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="data-management">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">数据管理</h2>
      </div>
      <div class="toolbar-right">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文档..."
          :prefix-icon="Search"
          clearable
          style="width: 250px; margin-right: 12px"
        />
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
      </div>
    </div>

    <!-- 文档列表 -->
    <el-card>
      <el-table :data="filteredDocuments" v-loading="fileStore.loading" stripe>
        <el-table-column label="文档名称" min-width="250">
          <template #default="{ row }">
            <div class="doc-name-cell">
              <el-icon><DocIcon /></el-icon>
              <span>{{ row.filename }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="150">
          <template #default="{ row }">
            {{ row.category?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="上传时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.uploadedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                type="primary"
                :icon="View"
                size="small"
                @click="viewArchive(row)"
              >
                归档
              </el-button>
              <el-button
                type="info"
                :icon="Clock"
                size="small"
                @click="viewHistory(row)"
              >
                历史
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="fileStore.pagination.currentPage"
          :page-size="fileStore.pagination.pageSize"
          :total="fileStore.pagination.totalItems"
          layout="total, prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <!-- 归档数据对话框 -->
    <el-dialog
      v-model="archiveDialogVisible"
      :title="`归档数据 - ${selectedDocument?.filename}`"
      width="700px"
    >
      <div v-if="documentArchive">
        <el-descriptions :column="2" border>
          <el-descriptions-item
            v-for="(value, key) in documentArchive"
            :key="key"
            :label="key"
          >
            {{ value }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <el-empty v-else description="暂无归档数据" />
    </el-dialog>

    <!-- 标注历史对话框 -->
    <el-dialog
      v-model="historyDialogVisible"
      :title="`标注历史 - ${selectedDocument?.filename}`"
      width="900px"
    >
      <el-table :data="annotationHistory" max-height="500">
        <el-table-column label="字段" prop="fieldLabel" width="150" />
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-tag :type="actionTypeColor(row.actionType)" size="small">
              {{ actionTypeLabel(row.actionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="旧值" prop="oldValue" min-width="150">
          <template #default="{ row }">
            {{ row.oldValue || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="新值" prop="newValue" min-width="150" />
        <el-table-column label="操作人" width="100">
          <template #default="{ row }">
            {{ row.user?.username }}
          </template>
        </el-table-column>
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="annotationHistory.length === 0" description="暂无标注历史" />
    </el-dialog>
  </div>
</template>

<style scoped>
.data-management {
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
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.doc-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>

