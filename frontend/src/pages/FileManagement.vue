<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useFileStore } from '@/stores/file'
import { useCategoryStore } from '@/stores/category'
import type { Document, Folder, User, AnnotationHistoryEntry } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { annotationService, taskService, userService } from '@/api'
import {
  Upload,
  Delete,
  FolderAdd,
  Document as DocIcon,
  Folder as FolderIcon,
  Search,
  Refresh,
  Picture,
  Clock,
  Plus,
  ZoomIn,
  InfoFilled,
  List,
  Setting
} from '@element-plus/icons-vue'

const fileStore = useFileStore()
const categoryStore = useCategoryStore()

// 状态
const currentFolderId = ref<number | null>(null)
const selectedDocuments = ref<Document[]>([])
const selectedFolders = ref<Folder[]>([])
const searchKeyword = ref('')
const uploadDialogVisible = ref(false)
const createFolderDialogVisible = ref(false)
const newFolderName = ref('')
const previewDialogVisible = ref(false)
const previewDocument = ref<Document | null>(null)
const breadcrumbs = ref<Folder[]>([])

// 标注档案相关
const archiveDialogVisible = ref(false)
const archiveDocument = ref<Document | null>(null)
const archiveData = ref<any>(null)
const archiveHistory = ref<AnnotationHistoryEntry[]>([])
const archiveLoading = ref(false)

// 任务分配相关
const taskAssignDialogVisible = ref(false)
const taskAssignForm = ref({
  batchName: '',
  categoryId: undefined as number | undefined,
  formConfigId: undefined as number | undefined
})
const taskAssignLoading = ref(false)

// 用户列表（用于显示标注者信息）
const users = ref<User[]>([])

// 图片预览相关
const imagePreviewVisible = ref(false)
const imagePreviewUrl = ref('')
const imagePreviewLoading = ref(false)

// 缩略图缓存
const thumbnailCache = ref<Map<number, string>>(new Map())

// API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

// 获取带认证的图片URL
const fetchImageWithAuth = async (documentId: number): Promise<string> => {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/preview`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  if (!response.ok) {
    throw new Error('Failed to load image')
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

// 加载缩略图
const loadThumbnail = async (doc: Document) => {
  if (!isImageFile(doc.mimeType)) return
  if (thumbnailCache.value.has(doc.id)) return
  
  try {
    const url = await fetchImageWithAuth(doc.id)
    thumbnailCache.value.set(doc.id, url)
  } catch (error) {
    console.error(`Failed to load thumbnail for document ${doc.id}:`, error)
  }
}

// 获取缩略图URL
const getThumbnailFromCache = (doc: Document): string | undefined => {
  return thumbnailCache.value.get(doc.id)
}

// 计算属性
const filteredDocuments = computed(() => {
  if (!searchKeyword.value) return fileStore.documents
  return fileStore.documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 是否有选中的文件或文件夹
const hasSelection = computed(() => {
  return selectedDocuments.value.length > 0 || selectedFolders.value.length > 0
})

// 选中的文件数量
const selectedCount = computed(() => {
  return selectedDocuments.value.length + selectedFolders.value.length
})

// 加载数据
const loadData = async () => {
  await Promise.all([
    fileStore.fetchDocuments({
      folderId: currentFolderId.value ?? undefined,
      root: currentFolderId.value === null
    }),
    fileStore.fetchFolders(currentFolderId.value ?? undefined),
    categoryStore.fetchCategories()
  ])
  
  // 加载图片缩略图
  for (const doc of fileStore.documents) {
    if (isImageFile(doc.mimeType) && !thumbnailCache.value.has(doc.id)) {
      loadThumbnail(doc)
    }
  }
}

// 加载用户列表
const loadUsers = async () => {
  try {
    users.value = await userService.getUsers()
  } catch (error) {
    console.error('Failed to load users:', error)
  }
}

// 进入文件夹
const enterFolder = async (folder: Folder) => {
  breadcrumbs.value.push(folder)
  currentFolderId.value = folder.id
}

// 返回根目录
const goToRoot = () => {
  breadcrumbs.value = []
  currentFolderId.value = null
}

// 导航到面包屑位置
const navigateToBreadcrumb = (index: number) => {
  if (index === -1) {
    goToRoot()
  } else {
    breadcrumbs.value = breadcrumbs.value.slice(0, index + 1)
    currentFolderId.value = breadcrumbs.value[index].id
  }
}

// 文件上传
const handleUpload = async (options: any) => {
  const file = options.file
  const result = await fileStore.uploadDocument(file, {
    folderId: currentFolderId.value
  })
  if (result) {
    uploadDialogVisible.value = false
    await loadData()
  }
}

// 创建文件夹
const handleCreateFolder = async () => {
  if (!newFolderName.value.trim()) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  const result = await fileStore.createFolder(newFolderName.value, currentFolderId.value)
  if (result) {
    createFolderDialogVisible.value = false
    newFolderName.value = ''
    await loadData()
  }
}

// 删除文件
const handleDeleteDocument = async (doc: Document) => {
  await ElMessageBox.confirm(
    `确定要删除文件 "${doc.filename}" 吗？`,
    '确认删除',
    { type: 'warning' }
  )
  const success = await fileStore.deleteDocument(doc.id)
  if (success) {
    await loadData()
  }
}

// 删除文件夹
const handleDeleteFolder = async (folder: Folder) => {
  await ElMessageBox.confirm(
    `确定要删除文件夹 "${folder.name}" 及其所有内容吗？`,
    '确认删除',
    { type: 'warning' }
  )
  const success = await fileStore.deleteFolder(folder.id)
  if (success) {
    await loadData()
  }
}

// 预览文件详情
const openPreview = (doc: Document) => {
  previewDocument.value = doc
  previewDialogVisible.value = true
}

// 清理预览URL
const cleanupPreviewUrl = () => {
  if (imagePreviewUrl.value.startsWith('blob:')) {
    window.URL.revokeObjectURL(imagePreviewUrl.value)
  }
  imagePreviewUrl.value = ''
}

// 查看图片大图
const openImagePreview = async (doc: Document) => {
  imagePreviewLoading.value = true
  imagePreviewVisible.value = true
  
  try {
    // 清理之前的 blob URL
    cleanupPreviewUrl()
    imagePreviewUrl.value = await fetchImageWithAuth(doc.id)
  } catch (error) {
    console.error('Failed to load image:', error)
    ElMessage.error('图片加载失败')
    imagePreviewVisible.value = false
  } finally {
    imagePreviewLoading.value = false
  }
}

// 查看标注档案
const openArchive = async (doc: Document) => {
  archiveDocument.value = doc
  archiveDialogVisible.value = true
  archiveLoading.value = true
  archiveData.value = null
  archiveHistory.value = []
  
  try {
    // 获取标注档案
    const archiveResult = await annotationService.getDocumentArchive(doc.id)
    archiveData.value = archiveResult.archive
    
    // 获取标注历史
    const historyResult = await annotationService.getDocumentAnnotationHistory(doc.id)
    archiveHistory.value = historyResult.history || []
  } catch (error) {
    console.error('Failed to load archive:', error)
    ElMessage.error('加载标注档案失败')
  } finally {
    archiveLoading.value = false
  }
}

// 打开任务分配对话框
const openTaskAssignDialog = () => {
  if (!hasSelection.value) {
    ElMessage.warning('请先选择要分配任务的文件或文件夹')
    return
  }
  
  const now = new Date()
  const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  taskAssignForm.value = {
    batchName: `标注任务批次 - ${dateStr} (${selectedCount.value}个文件)`,
    categoryId: undefined,
    formConfigId: undefined
  }
  taskAssignDialogVisible.value = true
}

// 创建批量任务
const handleCreateBatchTask = async () => {
  if (!taskAssignForm.value.batchName.trim()) {
    ElMessage.warning('请输入批次名称')
    return
  }
  
  const documentIds = selectedDocuments.value.map(doc => doc.id)
  
  if (documentIds.length === 0) {
    ElMessage.warning('请选择要分配任务的文件')
    return
  }
  
  taskAssignLoading.value = true
  try {
    const result = await taskService.createBatchTasks({
      batchName: taskAssignForm.value.batchName,
      documentIds,
      categoryId: taskAssignForm.value.categoryId,
      formConfigId: taskAssignForm.value.formConfigId
    })
    
    ElMessage.success(`成功创建 ${result.successCount} 个任务`)
    taskAssignDialogVisible.value = false
    selectedDocuments.value = []
    selectedFolders.value = []
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '创建任务失败')
  } finally {
    taskAssignLoading.value = false
  }
}

// 批量删除选中的文件
const handleBatchDelete = async () => {
  if (selectedDocuments.value.length === 0) {
    ElMessage.warning('请先选择要删除的文件')
    return
  }
  
  await ElMessageBox.confirm(
    `确定要删除选中的 ${selectedDocuments.value.length} 个文件吗？`,
    '确认批量删除',
    { type: 'warning' }
  )
  
  let successCount = 0
  for (const doc of selectedDocuments.value) {
    try {
      await fileStore.deleteDocument(doc.id)
      successCount++
    } catch (error) {
      console.error(`Failed to delete document ${doc.id}:`, error)
    }
  }
  
  ElMessage.success(`成功删除 ${successCount} 个文件`)
  selectedDocuments.value = []
  await loadData()
}

// 获取文件图标
const getFileIcon = (mimeType: string) => {
  if (mimeType?.startsWith('image/')) return Picture
  return DocIcon
}

// 是否为图片文件
const isImageFile = (mimeType: string) => {
  return mimeType?.startsWith('image/')
}


// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

// 获取状态标签类型
const getStatusType = (status: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const statusMap: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    'UPLOADED': 'info',
    'PENDING': 'warning',
    'PROCESSING': 'primary',
    'PROCESSED': 'success',
    'ANNOTATED': 'success',
    'REVIEWED': 'success',
    'ERROR': 'danger'
  }
  return statusMap[status] || 'info'
}

// 处理文件夹选择
const handleFolderSelect = (folder: Folder, selected: boolean) => {
  if (selected) {
    if (!selectedFolders.value.find(f => f.id === folder.id)) {
      selectedFolders.value.push(folder)
    }
  } else {
    selectedFolders.value = selectedFolders.value.filter(f => f.id !== folder.id)
  }
}

// 判断文件夹是否被选中
const isFolderSelected = (folder: Folder) => {
  return selectedFolders.value.some(f => f.id === folder.id)
}

// 下载文件
const downloadFile = (doc: Document) => {
  window.open(`${API_BASE_URL}/documents/${doc.id}/download`)
}

// 监听文件夹变化
watch(currentFolderId, () => {
  loadData()
  selectedDocuments.value = []
  selectedFolders.value = []
})

onMounted(() => {
  loadData()
  loadUsers()
})
</script>

<template>
  <div class="file-management">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" :icon="Upload" @click="uploadDialogVisible = true">
          上传文件
        </el-button>
        <el-button :icon="FolderAdd" @click="createFolderDialogVisible = true">
          新建文件夹
        </el-button>
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
        
        <el-divider direction="vertical" />
        
        <!-- 批量操作按钮 -->
        <el-button
          type="success"
          :icon="Plus"
          :disabled="!hasSelection"
          @click="openTaskAssignDialog"
        >
          创建任务 ({{ selectedCount }})
        </el-button>
        <el-button
          type="danger"
          :icon="Delete"
          :disabled="selectedDocuments.length === 0"
          @click="handleBatchDelete"
        >
          批量删除
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文件..."
          :prefix-icon="Search"
          clearable
          style="width: 250px"
        />
      </div>
    </div>

    <!-- 面包屑导航 -->
    <div class="breadcrumb-bar">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item @click="navigateToBreadcrumb(-1)">
          <span class="breadcrumb-link">根目录</span>
        </el-breadcrumb-item>
        <el-breadcrumb-item
          v-for="(folder, index) in breadcrumbs"
          :key="folder.id"
          @click="navigateToBreadcrumb(index)"
        >
          <span class="breadcrumb-link">{{ folder.name }}</span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 文件夹列表 -->
    <div v-if="fileStore.folders.length > 0" class="folder-section">
      <div class="section-title">文件夹</div>
      <el-row :gutter="16">
        <el-col
          v-for="folder in fileStore.folders"
          :key="folder.id"
          :xs="12"
          :sm="8"
          :md="6"
          :lg="4"
        >
          <el-card
            class="folder-card"
            :class="{ 'folder-selected': isFolderSelected(folder) }"
            shadow="hover"
            @dblclick="enterFolder(folder)"
            @click="handleFolderSelect(folder, !isFolderSelected(folder))"
          >
            <div class="folder-content">
              <el-checkbox
                :model-value="isFolderSelected(folder)"
                @click.stop
                class="folder-checkbox"
              />
              <el-icon :size="40" color="#e6a23c"><FolderIcon /></el-icon>
              <div class="folder-name">{{ folder.name }}</div>
            </div>
            <div class="folder-actions">
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                circle
                @click.stop="handleDeleteFolder(folder)"
              />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 文件列表 -->
    <div class="files-section">
      <div class="section-title">文件 ({{ filteredDocuments.length }})</div>
      <el-table
        :data="filteredDocuments"
        v-loading="fileStore.loading"
        stripe
        @selection-change="(val: Document[]) => selectedDocuments = val"
      >
        <el-table-column type="selection" width="55" />
        
        <!-- 缩略图列 -->
        <el-table-column label="预览" width="80">
          <template #default="{ row }">
            <div class="thumbnail-cell" @click="isImageFile(row.mimeType) && openImagePreview(row)">
              <el-image
                v-if="isImageFile(row.mimeType) && getThumbnailFromCache(row)"
                :src="getThumbnailFromCache(row)"
                fit="cover"
                class="thumbnail-image"
                :preview-src-list="[]"
              />
              <div v-else-if="isImageFile(row.mimeType)" class="thumbnail-placeholder thumbnail-loading">
                <el-icon class="is-loading"><Picture /></el-icon>
              </div>
              <div v-else class="thumbnail-placeholder">
                <el-icon><component :is="getFileIcon(row.mimeType)" /></el-icon>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="文件名" min-width="200">
          <template #default="{ row }">
            <div class="file-name-cell">
              <span class="filename">{{ row.filename }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.fileSize) }}
          </template>
        </el-table-column>
        
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">
              {{ row.mimeType?.split('/')[1] || 'unknown' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.uploadedAt) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <!-- 查看大图 -->
              <el-tooltip content="查看大图" placement="top" v-if="isImageFile(row.mimeType)">
                <el-button
                  type="primary"
                  :icon="ZoomIn"
                  size="small"
                  @click="openImagePreview(row)"
                />
              </el-tooltip>
              
              <!-- 文件详情 -->
              <el-tooltip content="文件详情" placement="top">
                <el-button
                  type="info"
                  :icon="InfoFilled"
                  size="small"
                  @click="openPreview(row)"
                />
              </el-tooltip>
              
              <!-- 标注档案 -->
              <el-tooltip content="标注档案" placement="top">
                <el-button
                  type="success"
                  :icon="List"
                  size="small"
                  @click="openArchive(row)"
                />
              </el-tooltip>
              
              <!-- 删除 -->
              <el-tooltip content="删除" placement="top">
                <el-button
                  type="danger"
                  :icon="Delete"
                  size="small"
                  @click="handleDeleteDocument(row)"
                />
              </el-tooltip>
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
    </div>

    <!-- 上传对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="上传文件" width="500px">
      <el-upload
        drag
        :http-request="handleUpload"
        :show-file-list="false"
        multiple
      >
        <el-icon class="el-icon--upload" :size="60"><Upload /></el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持各种类型的文件上传
          </div>
        </template>
      </el-upload>
    </el-dialog>

    <!-- 创建文件夹对话框 -->
    <el-dialog v-model="createFolderDialogVisible" title="新建文件夹" width="400px">
      <el-form @submit.prevent="handleCreateFolder">
        <el-form-item label="文件夹名称">
          <el-input v-model="newFolderName" placeholder="请输入文件夹名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createFolderDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateFolder" :loading="fileStore.loading">
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 图片预览对话框 -->
    <el-dialog
      v-model="imagePreviewVisible"
      title="图片预览"
      width="90%"
      top="2vh"
      class="image-preview-dialog"
      @closed="cleanupPreviewUrl"
    >
      <div class="image-preview-container" v-loading="imagePreviewLoading">
        <img v-if="imagePreviewUrl && !imagePreviewLoading" :src="imagePreviewUrl" class="preview-full-image" />
        <div v-else-if="!imagePreviewLoading" class="preview-placeholder">
          <el-icon :size="60"><Picture /></el-icon>
          <p>图片加载失败</p>
        </div>
      </div>
    </el-dialog>

    <!-- 文件详情对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      :title="previewDocument?.filename"
      width="800px"
      top="5vh"
    >
      <div class="detail-container" v-if="previewDocument">
        <el-row :gutter="20">
          <!-- 左侧预览 -->
          <el-col :span="12">
            <div class="preview-area">
              <img
                v-if="isImageFile(previewDocument.mimeType) && getThumbnailFromCache(previewDocument)"
                :src="getThumbnailFromCache(previewDocument)"
                class="detail-preview-image"
              />
              <div v-else-if="isImageFile(previewDocument.mimeType)" class="preview-loading">
                <el-icon class="is-loading" :size="40"><Picture /></el-icon>
                <p>图片加载中...</p>
              </div>
              <div v-else class="preview-unsupported">
                <el-icon :size="60"><DocIcon /></el-icon>
                <p>此文件类型暂不支持预览</p>
              </div>
            </div>
          </el-col>
          
          <!-- 右侧信息 -->
          <el-col :span="12">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="文件ID">{{ previewDocument.id }}</el-descriptions-item>
              <el-descriptions-item label="文件名">{{ previewDocument.filename }}</el-descriptions-item>
              <el-descriptions-item label="文件大小">{{ formatFileSize(previewDocument.fileSize) }}</el-descriptions-item>
              <el-descriptions-item label="文件类型">{{ previewDocument.mimeType }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="getStatusType(previewDocument.status)" size="small">
                  {{ previewDocument.status }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="上传时间">{{ formatDate(previewDocument.uploadedAt) }}</el-descriptions-item>
              <el-descriptions-item label="文件路径">{{ previewDocument.folderPath || '-' }}</el-descriptions-item>
            </el-descriptions>
            
            <div class="detail-actions">
              <el-button type="primary" @click="openArchive(previewDocument)">
                <el-icon><List /></el-icon>
                查看标注档案
              </el-button>
              <el-button @click="downloadFile(previewDocument)">
                下载文件
              </el-button>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-dialog>

    <!-- 标注档案对话框 -->
    <el-dialog
      v-model="archiveDialogVisible"
      :title="`标注档案 - ${archiveDocument?.filename}`"
      width="900px"
      top="5vh"
    >
      <div v-loading="archiveLoading" class="archive-container">
        <el-row :gutter="20">
          <!-- 左侧图片预览 -->
          <el-col :span="10">
            <div class="archive-preview">
              <img
                v-if="archiveDocument && isImageFile(archiveDocument.mimeType) && getThumbnailFromCache(archiveDocument)"
                :src="getThumbnailFromCache(archiveDocument)"
                class="archive-image"
              />
              <div v-else-if="archiveDocument && isImageFile(archiveDocument.mimeType)" class="preview-loading">
                <el-icon class="is-loading" :size="40"><Picture /></el-icon>
              </div>
              <div v-else class="preview-unsupported">
                <el-icon :size="40"><DocIcon /></el-icon>
              </div>
            </div>
          </el-col>
          
          <!-- 右侧标注信息 -->
          <el-col :span="14">
            <!-- 当前标注数据 -->
            <el-card class="archive-card">
              <template #header>
                <div class="card-header">
                  <span><el-icon><Setting /></el-icon> 当前标注数据</span>
                </div>
              </template>
              <div v-if="archiveData && Object.keys(archiveData).length > 0">
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item
                    v-for="(value, key) in archiveData"
                    :key="key"
                    :label="String(key)"
                  >
                    <template v-if="typeof value === 'object'">
                      <pre class="json-value">{{ JSON.stringify(value, null, 2) }}</pre>
                    </template>
                    <template v-else>
                      {{ value }}
                    </template>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
              <el-empty v-else description="暂无标注数据" :image-size="60" />
            </el-card>
            
            <!-- 标注历史 -->
            <el-card class="archive-card" style="margin-top: 16px">
              <template #header>
                <div class="card-header">
                  <span><el-icon><Clock /></el-icon> 标注历史 ({{ archiveHistory.length }})</span>
                </div>
              </template>
              <div v-if="archiveHistory.length > 0" class="history-list">
                <el-timeline>
                  <el-timeline-item
                    v-for="(item, index) in archiveHistory.slice(0, 10)"
                    :key="index"
                    :timestamp="formatDate(item.createdAt)"
                    placement="top"
                    :type="item.actionType === 'UPDATE' ? 'warning' : 'primary'"
                  >
                    <el-card shadow="never" class="history-item">
                      <div class="history-header">
                        <el-tag size="small" :type="item.actionType === 'CREATE' ? 'success' : item.actionType === 'UPDATE' ? 'warning' : 'danger'">
                          {{ item.actionType }}
                        </el-tag>
                        <span class="history-user">{{ item.user?.username || '未知用户' }}</span>
                      </div>
                      <div class="history-field">
                        字段: <strong>{{ item.fieldLabel || item.fieldName }}</strong>
                      </div>
                      <div class="history-value">
                        <template v-if="typeof item.newValue === 'object'">
                          <pre class="json-value small">{{ JSON.stringify(item.newValue, null, 2) }}</pre>
                        </template>
                        <template v-else>
                          值: {{ item.newValue }}
                        </template>
                      </div>
                    </el-card>
                  </el-timeline-item>
                </el-timeline>
                <div v-if="archiveHistory.length > 10" class="history-more">
                  还有 {{ archiveHistory.length - 10 }} 条历史记录...
                </div>
              </div>
              <el-empty v-else description="暂无标注历史" :image-size="60" />
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-dialog>

    <!-- 任务分配对话框 -->
    <el-dialog
      v-model="taskAssignDialogVisible"
      title="创建标注任务"
      width="500px"
    >
      <el-form :model="taskAssignForm" label-width="100px">
        <el-form-item label="批次名称" required>
          <el-input v-model="taskAssignForm.batchName" placeholder="请输入批次名称" />
        </el-form-item>
        <el-form-item label="选中文件">
          <el-tag type="info">{{ selectedDocuments.length }} 个文件</el-tag>
        </el-form-item>
        <el-form-item label="类别">
          <el-select v-model="taskAssignForm.categoryId" placeholder="选择类别（可选）" clearable style="width: 100%">
            <el-option
              v-for="category in categoryStore.categories"
              :key="category.id"
              :label="category.name"
              :value="category.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="taskAssignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateBatchTask" :loading="taskAssignLoading">
          创建任务
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.file-management {
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
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.breadcrumb-bar {
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
}

.breadcrumb-link {
  cursor: pointer;
  color: #409eff;
}

.breadcrumb-link:hover {
  text-decoration: underline;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
}

.folder-section {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.folder-card {
  cursor: pointer;
  margin-bottom: 16px;
  position: relative;
  transition: all 0.3s;
}

.folder-card.folder-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.folder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  position: relative;
}

.folder-checkbox {
  position: absolute;
  top: 0;
  left: 0;
}

.folder-name {
  margin-top: 8px;
  font-size: 14px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.folder-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.3s;
}

.folder-card:hover .folder-actions {
  opacity: 1;
}

.files-section {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
}

.thumbnail-cell {
  width: 50px;
  height: 50px;
  cursor: pointer;
}

.thumbnail-image {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  object-fit: cover;
}

.thumbnail-placeholder {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 4px;
  color: #909399;
}

.thumbnail-loading {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #909399;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
}

.file-name-cell {
  display: flex;
  flex-direction: column;
}

.filename {
  font-weight: 500;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* 图片预览对话框 */
.image-preview-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.image-preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  min-height: 70vh;
  max-height: 85vh;
  overflow: auto;
}

.preview-full-image {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
}

/* 文件详情 */
.detail-container {
  min-height: 400px;
}

.preview-area {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f7fa;
  border-radius: 8px;
  height: 300px;
  overflow: hidden;
}

.detail-preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #909399;
}

.detail-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

/* 标注档案 */
.archive-container {
  min-height: 500px;
}

.archive-preview {
  background: #f5f7fa;
  border-radius: 8px;
  height: 300px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.archive-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.archive-card {
  max-height: 250px;
  overflow-y: auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.json-value {
  margin: 0;
  padding: 4px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  max-height: 100px;
  overflow: auto;
}

.json-value.small {
  font-size: 11px;
  max-height: 60px;
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  padding: 8px !important;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.history-user {
  font-weight: 500;
  color: #409eff;
}

.history-field {
  font-size: 13px;
  color: #606266;
}

.history-value {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.history-more {
  text-align: center;
  color: #909399;
  font-size: 12px;
  padding: 8px;
}
</style>
