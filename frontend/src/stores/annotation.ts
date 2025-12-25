import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Annotation, AnnotationHistoryEntry } from '@/types'
import { annotationService } from '@/api'
import { ElMessage } from 'element-plus'

export const useAnnotationStore = defineStore('annotation', () => {
  // State
  const annotations = ref<Annotation[]>([])
  const currentAnnotation = ref<Annotation | null>(null)
  const annotationHistory = ref<AnnotationHistoryEntry[]>([])
  const loading = ref(false)

  // Actions
  const submitAnnotation = async (annotationData: {
    taskId: number
    taskAssignmentId: number
    documentId?: number
    annotationData: any
    confidenceScore?: number
  }) => {
    loading.value = true
    try {
      const response = await annotationService.submitAnnotation(annotationData)
      annotations.value.push(response.annotation)
      ElMessage.success('标注提交成功')
      return response.annotation
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '标注提交失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const saveDraftAnnotation = async (annotationData: {
    taskId: number
    taskAssignmentId: number
    documentId?: number
    annotationData: any
    confidenceScore?: number
  }) => {
    loading.value = true
    try {
      const response = await annotationService.saveDraftAnnotation(annotationData)
      currentAnnotation.value = response.annotation
      ElMessage.success('草稿保存成功')
      return response.annotation
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '草稿保存失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const fetchTaskAnnotations = async (taskId: number) => {
    loading.value = true
    try {
      const response = await annotationService.getTaskAnnotations(taskId)
      annotations.value = response.annotations
      return response.annotations
    } catch (err: any) {
      ElMessage.error('获取标注列表失败')
      return []
    } finally {
      loading.value = false
    }
  }

  const getDocumentArchive = async (documentId: number) => {
    loading.value = true
    try {
      const response = await annotationService.getDocumentArchive(documentId)
      return response
    } catch (err: any) {
      ElMessage.error('获取文档归档失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const getDocumentConflicts = async (documentId: number) => {
    try {
      const response = await annotationService.getDocumentConflicts(documentId)
      return response
    } catch (err: any) {
      ElMessage.error('获取冲突信息失败')
      return null
    }
  }

  const getBatchDocumentConflicts = async (documentIds: number[]) => {
    try {
      const response = await annotationService.getBatchDocumentConflicts(documentIds)
      return response.conflicts
    } catch (err: any) {
      ElMessage.error('获取批量冲突信息失败')
      return {}
    }
  }

  const reviewAnnotation = async (id: number, reviewData: {
    status: string
    reviewNotes?: string
  }) => {
    loading.value = true
    try {
      const response = await annotationService.reviewAnnotation(id, reviewData)
      const index = annotations.value.findIndex(a => a.id === id)
      if (index !== -1) {
        annotations.value[index] = response.annotation
      }
      ElMessage.success('审核完成')
      return response.annotation
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '审核失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const fetchDocumentAnnotationHistory = async (documentId: number) => {
    loading.value = true
    try {
      const response = await annotationService.getDocumentAnnotationHistory(documentId)
      annotationHistory.value = response.history
      return response.history
    } catch (err: any) {
      ElMessage.error('获取标注历史失败')
      return []
    } finally {
      loading.value = false
    }
  }

  const fetchFieldHistory = async (documentId: number, fieldName: string) => {
    try {
      const response = await annotationService.getFieldHistory(documentId, fieldName)
      return response.history
    } catch (err: any) {
      ElMessage.error('获取字段历史失败')
      return []
    }
  }

  const setCurrentAnnotation = (annotation: Annotation | null) => {
    currentAnnotation.value = annotation
  }

  return {
    // State
    annotations,
    currentAnnotation,
    annotationHistory,
    loading,
    // Actions
    submitAnnotation,
    saveDraftAnnotation,
    fetchTaskAnnotations,
    getDocumentArchive,
    getDocumentConflicts,
    getBatchDocumentConflicts,
    reviewAnnotation,
    fetchDocumentAnnotationHistory,
    fetchFieldHistory,
    setCurrentAnnotation
  }
})

