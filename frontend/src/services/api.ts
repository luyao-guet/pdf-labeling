import axios from 'axios'

const API_BASE_URL = 'http://localhost:8080/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    const status = error.response?.status
    const url = error.config?.url
    console.log('API Error Interceptor:', status, url);
    console.log('Error details:', {
      status,
      url,
      message: error.response?.data?.message || error.message,
      pathname: window.location.pathname
    });
    
    // Handle authentication errors (401 or 403 when token exists - likely expired)
    const hasToken = !!localStorage.getItem('token')
    const isAuthError = status === 401 || (status === 403 && hasToken)
    const shouldRedirect = isAuthError && 
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/annotation')
    
    if (shouldRedirect) {
      console.log(`Authentication error (${status}) detected, token may be expired. Will redirect to login.`);
      // Clear token and user data
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Don't redirect immediately - let the component handle the error first
      // Use setTimeout to allow error handling to complete
      setTimeout(() => {
        // Check again if we're still not on login page (component might have navigated)
        if (!window.location.pathname.includes('/login')) {
          console.log('Redirecting to login after authentication error');
          window.location.href = '/login'
        }
      }, 100)
    } else if (status === 403 && !hasToken) {
      // 403 without token - likely a permission issue, let components handle it
      console.log('Permission error (403) - component will handle:', url)
    }
    return Promise.reject(error)
  }
)

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  id: number
  username: string
  email: string
  role: string
  score: number
  authorities: string[]
}

export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'annotator' | 'reviewer' | 'expert' | 'ai_annotator'
  score: number
}

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },

  register: async (userData: any): Promise<any> => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },
}

export const userService = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get('/users')
    return response.data
  },

  createUser: async (userData: any): Promise<User> => {
    const response = await api.post('/users', userData)
    return response.data
  },

  updateUser: async (id: number, userData: any): Promise<User> => {
    const response = await api.put(`/users/${id}`, userData)
    return response.data
  },

  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}

export interface Document {
  id: number
  filename: string
  fileSize: number
  mimeType: string
  status: string
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  uploadedAt: string
  uploadedBy: string
  folderPath?: string
  folder?: {
    id: number
    name: string
    path: string
  }
  category?: {
    id: number
    name: string
  }
  documentType?: {
    id: number
    name: string
    description?: string
  }
}

export interface UploadDocumentOptions {
  categoryId?: number
  folderId?: number | null
  folderPath?: string
}

export interface Folder {
  id: number
  name: string
  path: string
  depth: number
  parentId: number | null
  createdAt: string
  createdBy?: string
}

export interface Category {
  id: number
  name: string
  description?: string
  level: number
  sortOrder: number
  createdAt: string
  parentId?: number
  children?: Category[]
}

export interface Task {
  id: number
  title: string
  description?: string
  status: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'CLOSED' | 'AI_PROCESSING' | 'AI_COMPLETED' | 'ANNOTATING' | 'ANNOTATED' | 'INSPECTING' | 'INSPECTED' | 'EXPERT_REVIEWING' | 'EXPERT_REVIEWED'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  deadline?: string
  batchId?: string
  batchName?: string
  createdAt: string
  updatedAt: string
  document: {
    id: number
    filename: string
  }
  category: {
    id: number
    name: string
  }
  formConfig: {
    id: number
    name: string
  }
  createdBy: {
    id: number
    username: string
  }
  assignments?: TaskAssignment[]
  documentIndex?: string | any
}

export interface TaskAssignment {
  id: number
  assignmentType: 'ANNOTATION' | 'REVIEW' | 'AI_ANNOTATION' | 'INSPECTION' | 'EXPERT_REVIEW'
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'
  assignedAt: string
  completedAt?: string
  notes?: string
  user: {
    id: number
    username: string
    role: string
  }
}

export interface Annotation {
  id: number
  taskId: number
  taskAssignmentId: number
  annotationData: string
  version: number
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  submittedAt?: string
  reviewedAt?: string
  confidenceScore?: number
  reviewNotes?: string
  reviewer?: {
    id: number
    username: string
  }
}

export interface FormConfig {
  id: number
  name: string
  description?: string
  categoryId?: number | null
  categoryName?: string | null
  promptTemplate?: string
  isActive?: boolean
  fieldCount?: number
  createdAt: string
  updatedAt?: string
  createdBy?: {
    id: number
    username: string
  }
}

export interface DocumentType {
  id: number
  name: string
  description?: string
  isActive?: boolean
  formConfigCount?: number
  createdAt: string
  updatedAt?: string
}

export const documentService = {
  getDocuments: async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
    categoryId?: number
    status?: string
    filename?: string
    folderId?: number
    root?: boolean
  }): Promise<{
    documents: Document[]
    currentPage: number
    totalItems: number
    totalPages: number
  }> => {
    const response = await api.get('/documents', { params })
    return response.data
  },

  uploadDocument: async (file: File, options?: UploadDocumentOptions): Promise<{
    message: string
    document: Document
  }> => {
    const formData = new FormData()
    formData.append('file', file)
    if (options?.categoryId !== undefined && options?.categoryId !== null) {
      formData.append('categoryId', options.categoryId.toString())
    }
    if (options?.folderId !== undefined && options.folderId !== null) {
      formData.append('folderId', options.folderId.toString())
    }
    if (options?.folderPath !== undefined && options.folderPath !== null && options.folderPath.trim() !== '') {
      formData.append('folderPath', options.folderPath)
    }
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  getDocument: async (id: number): Promise<Document> => {
    const response = await api.get(`/documents/${id}`)
    return response.data
  },

  deleteDocument: async (id: number): Promise<{ message: string }> => {
    console.log('API deleteDocument called with id:', id, 'type:', typeof id)

    // Validate id is a valid number
    if (typeof id !== 'number' || isNaN(id) || id <= 0) {
      throw new Error(`Invalid document ID: ${id} (type: ${typeof id})`)
    }

    console.log('Constructed URL:', `/documents/${id}`)
    const response = await api.delete(`/documents/${id}`)
    return response.data
  },

  updateDocumentCategory: async (id: number, categoryId?: number): Promise<{
    message: string
    document: Document
  }> => {
    const response = await api.put(`/documents/${id}/category`, {
      categoryId
    })
    return response.data
  },

  updateDocumentType: async (id: number, documentTypeId?: number): Promise<{
    message: string
    document: Document
  }> => {
    const response = await api.put(`/documents/${id}/document-type`, {
      documentTypeId
    })
    return response.data
  },

  updateDocumentPriority: async (id: number, priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'): Promise<{
    message: string
    document: Document
  }> => {
    const response = await api.put(`/documents/${id}/priority`, { priority })
    return response.data
  },
}

export const folderService = {
  getFolders: async (parentId?: number): Promise<{ folders: Folder[] }> => {
    const response = await api.get('/folders', { params: { parentId } })
    return response.data
  },

  createFolder: async (name: string, parentId?: number | null): Promise<{
    message: string
    folder: Folder
  }> => {
    const response = await api.post('/folders', {
      name,
      parentId: parentId ?? null
    })
    return response.data
  },

  deleteFolder: async (id: number): Promise<{
    message: string
    deletedCount: number
    folderId: number
    folderPath: string
  }> => {
    const response = await api.delete(`/folders/${id}`)
    return response.data
  },

  renameFolder: async (id: number, name: string): Promise<{
    message: string
    folder: Folder
  }> => {
    const response = await api.put(`/folders/${id}`, { name })
    return response.data
  },

  moveFolder: async (id: number, parentId: number | null): Promise<{
    message: string
    folder: Folder
  }> => {
    const response = await api.put(`/folders/${id}/move`, { parentId })
    return response.data
  },
}

export const categoryService = {
  getCategories: async (): Promise<{ categories: Category[] }> => {
    const response = await api.get('/categories')
    return response.data
  },

  createCategory: async (data: {
    name: string
    description?: string
    parentId?: number
  }): Promise<{ message: string; category: Category }> => {
    const response = await api.post('/categories', data)
    return response.data
  },

  updateCategory: async (id: number, data: {
    name?: string
    description?: string
  }): Promise<{ message: string; category: Category }> => {
    const response = await api.put(`/categories/${id}`, data)
    return response.data
  },

  deleteCategory: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/categories/${id}`)
    return response.data
  },

  getCategoryStats: async (id: number): Promise<{
    categoryId: number
    documentCount: number
    subcategoryCount: number
  }> => {
    const response = await api.get(`/categories/${id}/stats`)
    return response.data
  },
}

// Keep backward compatibility
export const fileService = {
  getFiles: documentService.getDocuments,
  uploadFile: (file: File, options?: UploadDocumentOptions) => documentService.uploadDocument(file, options),
  deleteFile: documentService.deleteDocument,
}

export const taskService = {
  getTasks: async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
    documentId?: number
    categoryId?: number
    formConfigId?: number
    status?: string
    priority?: string
  }): Promise<{
    tasks: Task[]
    currentPage: number
    totalItems: number
    totalPages: number
  }> => {
    const response = await api.get('/tasks', { params })
    return response.data
  },

  createTask: async (taskData: {
    title: string
    description?: string
    documentId: number
    categoryId?: number
    formConfigId?: number
  }): Promise<{ message: string; task: Task }> => {
    const response = await api.post('/tasks', taskData)
    return response.data
  },

  createBatchTasks: async (batchData: {
    batchName: string
    documentIds: number[]
    categoryId?: number
    formConfigId?: number
  }): Promise<{
    message: string
    batchId: string
    batchName: string
    successCount: number
    skipCount: number
    failCount: number
    task?: Task
    errors?: string[]
  }> => {
    const response = await api.post('/tasks/batch', batchData)
    return response.data
  },

  updateTask: async (id: number, taskData: {
    title?: string
    description?: string
    status?: string
    priority?: string
    formConfigId?: number
    documentTypeId?: number
  }): Promise<{ message: string; task: Task }> => {
    const response = await api.put(`/tasks/${id}`, taskData)
    return response.data
  },

  getTaskById: async (id: number): Promise<{ task: Task }> => {
    const response = await api.get(`/tasks/${id}`)
    return response.data
  },

  getTasksByBatchId: async (batchId: string): Promise<{
    batchId: string
    batchName: string
    taskId: number
    documents: Array<{
      documentId: number
      absolutePath: string
      filename: string
      folderPath?: string
      fileSize?: number
      mimeType?: string
    }>
    totalCount: number
  }> => {
    const response = await api.get(`/tasks/batch/${batchId}`)
    return response.data
  },

  assignTask: async (taskId: number, assignmentData: {
    userId?: number
    userIds?: number[]
    assignmentType: string
  }): Promise<{ message: string; assignment: TaskAssignment }> => {
    const response = await api.post(`/tasks/${taskId}/assign`, assignmentData)
    return response.data
  },

  getMyTasks: async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }): Promise<{
    assignments: Array<{
      assignment: TaskAssignment
      task: Task
    }>
    currentPage: number
    totalItems: number
    totalPages: number
  }> => {
    const response = await api.get('/tasks/my-tasks', { params })
    return response.data
  },

  getTaskStatistics: async (): Promise<{ statistics: any }> => {
    const response = await api.get('/tasks/statistics')
    return response.data
  },

  deleteTask: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/tasks/${id}`)
    return response.data
  },

  createReviewTasks: async (data: {
    documentIds: number[]
    taskTitle: string
    description?: string
    formConfigId?: number
  }): Promise<{
    message: string
    createdCount: number
    errors: string[]
    tasks: Task[]
  }> => {
    const response = await api.post('/tasks/review/batch', data)
    return response.data
  },

  deleteBatchTasks: async (taskIds: number[]): Promise<{
    message: string
    successCount: number
    failCount: number
    errors?: string[]
  }> => {
    const response = await api.post('/tasks/batch/delete', { taskIds })
    return response.data
  },

  getUserPerformance: async (): Promise<{ userPerformance: any[] }> => {
    const response = await api.get('/tasks/user-performance')
    return response.data
  },
}

export const annotationService = {
  submitAnnotation: async (annotationData: {
    taskId: number
    taskAssignmentId: number
    documentId?: number
    annotationData: any
    confidenceScore?: number
  }): Promise<{ message: string; annotation: Annotation }> => {
    const response = await api.post('/annotations', annotationData)
    return response.data
  },

  saveDraftAnnotation: async (annotationData: {
    taskId: number
    taskAssignmentId: number
    documentId?: number
    annotationData: any
    confidenceScore?: number
  }): Promise<{ message: string; annotation: Annotation }> => {
    const response = await api.post('/annotations/draft', annotationData)
    return response.data
  },

  getTaskAnnotations: async (taskId: number): Promise<{ annotations: Annotation[] }> => {
    const response = await api.get(`/annotations/task/${taskId}`)
    return response.data
  },

  getDocumentArchive: async (documentId: number): Promise<{
    archive: any
    hasArchive: boolean
  }> => {
    const response = await api.get(`/annotations/document/${documentId}/archive`)
    return response.data
  },

  getDocumentConflicts: async (documentId: number): Promise<{
    conflictCount: number
    conflicts: Array<{
      fieldName: string
      entries: Array<{
        username: string
        roleType: string
        taskId: string
        operationTime: string
        value: any
      }>
    }>
  }> => {
    const response = await api.get(`/annotations/document/${documentId}/conflicts`)
    return response.data
  },

  getBatchDocumentConflicts: async (documentIds: number[]): Promise<{
    conflicts: Record<number, number>
  }> => {
    const response = await api.post('/annotations/documents/conflicts/batch', { documentIds })
    return response.data
  },

  getAnnotation: async (id: number): Promise<{ annotation: Annotation }> => {
    const response = await api.get(`/annotations/${id}`)
    return response.data
  },

  reviewAnnotation: async (id: number, reviewData: {
    status: string
    reviewNotes?: string
  }): Promise<{ message: string; annotation: Annotation }> => {
    const response = await api.put(`/annotations/${id}/review`, reviewData)
    return response.data
  },

  getMyAnnotations: async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }): Promise<{
    items: Array<{
      assignment: TaskAssignment
      task: Task
      annotation?: Annotation
    }>
    currentPage: number
    totalItems: number
    totalPages: number
  }> => {
    const response = await api.get('/annotations/my-annotations', { params })
    return response.data
  },

  getDocumentAnnotationHistory: async (documentId: number): Promise<{
    history: Array<{
      id: number
      fieldName: string
      fieldLabel: string
      oldValue?: string
      newValue: string
      actionType: 'CREATE' | 'UPDATE' | 'DELETE'
      version: number
      createdAt: string
      user: {
        id: number
        username: string
      }
      task: {
        id: number
        title: string
      }
      annotation: {
        id: number
        version: number
      }
    }>
  }> => {
    const response = await api.get(`/annotations/document/${documentId}/history`)
    return response.data
  },

  getFieldHistory: async (documentId: number, fieldName: string): Promise<{
    history: Array<{
      id: number
      fieldName: string
      fieldLabel: string
      oldValue?: string
      newValue: string
      actionType: 'CREATE' | 'UPDATE' | 'DELETE'
      version: number
      createdAt: string
      user: {
        id: number
        username: string
      }
      task: {
        id: number
        title: string
      }
      annotation: {
        id: number
        version: number
      }
    }>
  }> => {
    const response = await api.get(`/annotations/document/${documentId}/field/${fieldName}/history`)
    return response.data
  },
}

export interface QualityCheck {
  id: number
  comparisonResult: 'MATCH' | 'PARTIAL_MATCH' | 'CONFLICT'
  conflictFields?: string
  resolutionNotes?: string
  status: 'PENDING' | 'RESOLVED' | 'ESCALATED'
  createdAt: string
  resolvedAt?: string
  task: {
    id: number
    title: string
    document: {
      id: number
      filename: string
    }
  }
  annotatorA: {
    id: number
    username: string
  }
  annotatorB: {
    id: number
    username: string
  }
  resolvedBy?: {
    id: number
    username: string
  }
  annotationA?: Annotation
  annotationB?: Annotation
}

export const formConfigService = {
  getFormConfigs: async (params?: {
    categoryId?: number
    activeOnly?: boolean
  }): Promise<{ formConfigs: FormConfig[] }> => {
    const response = await api.get('/form-configs', { params })
    return response.data
  },

  createFormConfig: async (data: {
    name: string
    description?: string
    categoryId?: number | null
    promptTemplate?: string
    isActive?: boolean
  }): Promise<{ message: string; formConfig: FormConfig }> => {
    const response = await api.post('/form-configs', data)
    return response.data
  },

  updateFormConfig: async (id: number, data: {
    name?: string
    description?: string
    promptTemplate?: string
    isActive?: boolean
  }): Promise<{ message: string; formConfig: FormConfig }> => {
    const response = await api.put(`/form-configs/${id}`, data)
    return response.data
  },

  deleteFormConfig: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/form-configs/${id}`)
    return response.data
  },

  getFormConfig: async (id: number): Promise<{ formConfig: FormConfig }> => {
    const response = await api.get(`/form-configs/${id}`)
    return response.data
  },

  getFormFields: async (id: number): Promise<{ fields: any[] }> => {
    const response = await api.get(`/form-configs/${id}/fields`)
    return response.data
  },

  addFormField: async (id: number, fieldData: any): Promise<{ message: string; field: any }> => {
    const response = await api.post(`/form-configs/${id}/fields`, fieldData)
    return response.data
  },

  updateFormField: async (fieldId: number, fieldData: any): Promise<{ message: string; field: any }> => {
    const response = await api.put(`/form-configs/fields/${fieldId}`, fieldData)
    return response.data
  },

  deleteFormField: async (fieldId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/form-configs/fields/${fieldId}`)
    return response.data
  },
}

export const documentTypeService = {
  getDocumentTypes: async (params?: {
    activeOnly?: boolean
  }): Promise<{ documentTypes: DocumentType[] }> => {
    const response = await api.get('/document-types', { params })
    return response.data
  },

  getDocumentType: async (id: number): Promise<{ documentType: DocumentType }> => {
    const response = await api.get(`/document-types/${id}`)
    return response.data
  },

  createDocumentType: async (data: {
    name: string
    description?: string
  }): Promise<{ message: string; documentType: DocumentType }> => {
    const response = await api.post('/document-types', data)
    return response.data
  },

  updateDocumentType: async (id: number, data: {
    name?: string
    description?: string
    isActive?: boolean
  }): Promise<{ message: string; documentType: DocumentType }> => {
    const response = await api.put(`/document-types/${id}`, data)
    return response.data
  },

  deleteDocumentType: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/document-types/${id}`)
    return response.data
  },

  assignFormConfigs: async (id: number, formConfigIds: number[]): Promise<{ message: string; documentType: DocumentType }> => {
    const response = await api.post(`/document-types/${id}/form-configs`, { formConfigIds })
    return response.data
  },

  getDocumentTypeFormConfigs: async (id: number): Promise<{ formConfigs: FormConfig[] }> => {
    const response = await api.get(`/document-types/${id}/form-configs`)
    return response.data
  },
}

export const qualityCheckService = {
  getQualityChecks: async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
    taskId?: number
    status?: string
  }): Promise<{
    qualityChecks: QualityCheck[]
    currentPage: number
    totalItems: number
    totalPages: number
  }> => {
    const response = await api.get('/quality-checks', { params })
    return response.data
  },

  getQualityCheck: async (id: number): Promise<{ qualityCheck: QualityCheck }> => {
    const response = await api.get(`/quality-checks/${id}`)
    return response.data
  },

  resolveQualityCheck: async (id: number, data: {
    selectedAnnotation: 'A' | 'B'
    resolutionNotes?: string
  }): Promise<{ message: string; qualityCheck: QualityCheck }> => {
    const response = await api.post(`/quality-checks/${id}/resolve`, data)
    return response.data
  },

  getMyReviewTasks: async (params?: {
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }): Promise<{
    qualityChecks: QualityCheck[]
    currentPage: number
    totalItems: number
    totalPages: number
  }> => {
    const response = await api.get('/quality-checks/my-review-tasks', { params })
    return response.data
  },

  getQualityStatistics: async (): Promise<{ statistics: any }> => {
    const response = await api.get('/quality-checks/statistics')
    return response.data
  },
}

export default api
