import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Document, Folder, UploadDocumentOptions, Priority } from '@/types'
import { documentService, folderService } from '@/api'
import { ElMessage } from 'element-plus'

export const useFileStore = defineStore('file', () => {
  // State
  const documents = ref<Document[]>([])
  const folders = ref<Folder[]>([])
  const currentFolder = ref<Folder | null>(null)
  const loading = ref(false)
  const pagination = ref({
    currentPage: 1,
    totalItems: 0,
    totalPages: 0,
    pageSize: 20
  })

  // Actions
  const fetchDocuments = async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
    categoryId?: number
    status?: string
    filename?: string
    folderId?: number
    root?: boolean
  }) => {
    loading.value = true
    try {
      const response = await documentService.getDocuments({
        page: params?.page ?? pagination.value.currentPage - 1,
        size: params?.size ?? pagination.value.pageSize,
        ...params
      })
      documents.value = response.documents
      pagination.value = {
        currentPage: response.currentPage + 1,
        totalItems: response.totalItems,
        totalPages: response.totalPages,
        pageSize: params?.size ?? pagination.value.pageSize
      }
    } catch (err: any) {
      ElMessage.error('获取文档列表失败')
    } finally {
      loading.value = false
    }
  }

  const uploadDocument = async (file: File, options?: UploadDocumentOptions) => {
    loading.value = true
    try {
      const response = await documentService.uploadDocument(file, options)
      documents.value.unshift(response.document)
      ElMessage.success('文件上传成功')
      return response.document
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '文件上传失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const deleteDocument = async (id: number) => {
    loading.value = true
    try {
      await documentService.deleteDocument(id)
      documents.value = documents.value.filter(d => d.id !== id)
      ElMessage.success('文件删除成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '文件删除失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const updateDocumentCategory = async (id: number, categoryId?: number) => {
    try {
      const response = await documentService.updateDocumentCategory(id, categoryId)
      const index = documents.value.findIndex(d => d.id === id)
      if (index !== -1) {
        documents.value[index] = response.document
      }
      ElMessage.success('类别更新成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '类别更新失败')
      return false
    }
  }

  const updateDocumentPriority = async (id: number, priority: Priority) => {
    try {
      const response = await documentService.updateDocumentPriority(id, priority)
      const index = documents.value.findIndex(d => d.id === id)
      if (index !== -1) {
        documents.value[index] = response.document
      }
      ElMessage.success('优先级更新成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '优先级更新失败')
      return false
    }
  }

  // 文件夹操作
  const fetchFolders = async (parentId?: number) => {
    loading.value = true
    try {
      const response = await folderService.getFolders(parentId)
      folders.value = response.folders
    } catch (err: any) {
      ElMessage.error('获取文件夹列表失败')
    } finally {
      loading.value = false
    }
  }

  const createFolder = async (name: string, parentId?: number | null) => {
    loading.value = true
    try {
      const response = await folderService.createFolder(name, parentId)
      folders.value.push(response.folder)
      ElMessage.success('文件夹创建成功')
      return response.folder
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '文件夹创建失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const deleteFolder = async (id: number) => {
    loading.value = true
    try {
      await folderService.deleteFolder(id)
      folders.value = folders.value.filter(f => f.id !== id)
      ElMessage.success('文件夹删除成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '文件夹删除失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const renameFolder = async (id: number, name: string) => {
    try {
      const response = await folderService.renameFolder(id, name)
      const index = folders.value.findIndex(f => f.id === id)
      if (index !== -1) {
        folders.value[index] = response.folder
      }
      ElMessage.success('文件夹重命名成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '文件夹重命名失败')
      return false
    }
  }

  const setCurrentFolder = (folder: Folder | null) => {
    currentFolder.value = folder
  }

  return {
    // State
    documents,
    folders,
    currentFolder,
    loading,
    pagination,
    // Actions
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    updateDocumentCategory,
    updateDocumentPriority,
    fetchFolders,
    createFolder,
    deleteFolder,
    renameFolder,
    setCurrentFolder
  }
})

