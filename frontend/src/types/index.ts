// 用户相关类型
export type UserRole = 'admin' | 'annotator' | 'reviewer' | 'expert' | 'ai_annotator'

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  score: number
}

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

// 文档相关类型
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface Document {
  id: number
  filename: string
  fileSize: number
  mimeType: string
  status: string
  priority?: Priority
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

// 文件夹相关类型
export interface Folder {
  id: number
  name: string
  path: string
  depth: number
  parentId: number | null
  createdAt: string
  createdBy?: string
}

// 类别相关类型
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

// 任务相关类型
export type TaskStatus = 
  | 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'CLOSED'
  | 'AI_PROCESSING' | 'AI_COMPLETED' | 'ANNOTATING' | 'ANNOTATED'
  | 'INSPECTING' | 'INSPECTED' | 'EXPERT_REVIEWING' | 'EXPERT_REVIEWED'

export type AssignmentType = 'ANNOTATION' | 'REVIEW' | 'AI_ANNOTATION' | 'INSPECTION' | 'EXPERT_REVIEW'
export type AssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'

export interface Task {
  id: number
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
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
  assignmentType: AssignmentType
  status: AssignmentStatus
  assignedAt: string
  completedAt?: string
  notes?: string
  user: {
    id: number
    username: string
    role: string
  }
}

// 标注相关类型
export type AnnotationStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface Annotation {
  id: number
  taskId: number
  taskAssignmentId: number
  annotationData: string
  version: number
  status: AnnotationStatus
  submittedAt?: string
  reviewedAt?: string
  confidenceScore?: number
  reviewNotes?: string
  reviewer?: {
    id: number
    username: string
  }
}

// 表单配置相关类型
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

export interface FormField {
  id: number
  name: string
  label: string
  type: string
  required: boolean
  sortOrder: number
  options?: string
  defaultValue?: string
  placeholder?: string
  validation?: string
}

// 文档类型
export interface DocumentType {
  id: number
  name: string
  description?: string
  isActive?: boolean
  formConfigCount?: number
  createdAt: string
  updatedAt?: string
}

// 质量检查相关类型
export type ComparisonResult = 'MATCH' | 'PARTIAL_MATCH' | 'CONFLICT'
export type QualityCheckStatus = 'PENDING' | 'RESOLVED' | 'ESCALATED'

export interface QualityCheck {
  id: number
  comparisonResult: ComparisonResult
  conflictFields?: string
  resolutionNotes?: string
  status: QualityCheckStatus
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

// 分页响应类型
export interface PaginatedResponse<T> {
  currentPage: number
  totalItems: number
  totalPages: number
  [key: string]: T[] | number
}

// 标注历史类型
export interface AnnotationHistoryEntry {
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
}

