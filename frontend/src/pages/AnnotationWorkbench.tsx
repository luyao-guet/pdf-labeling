import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Row, Col, Card, Button, Form, Input, Select, message, Space, Spin, Alert, Descriptions, List, Collapse } from 'antd'
import { SaveOutlined, SendOutlined, ArrowLeftOutlined, StepForwardOutlined, MenuFoldOutlined, MenuUnfoldOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import {
  taskService,
  annotationService,
  Task,
  TaskAssignment,
  Annotation,
  documentService,
  formConfigService,
  documentTypeService,
  DocumentType,
  FormConfig
} from '../services/api'
import { setCurrentTask } from '../store/slices/taskSlice'
import { setCurrentAnnotation, setLoading } from '../store/slices/annotationSlice'
import FileViewer from '../components/FileViewer'

const { Option } = Select

interface FormField {
  id: string
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'boolean' | 'textarea'
  required: boolean
  options?: string[]
  placeholder?: string
}

// Form field rendering function
const renderFormField = (field: FormField) => {
  const commonProps = {
    placeholder: field.placeholder || `请输入${field.label}`
  }

  switch (field.type) {
    case 'text':
      return <Input {...commonProps} />

    case 'number':
      return <Input type="number" {...commonProps} />

    case 'date':
      return <Input type="date" />

    case 'select':
      return (
        <Select {...commonProps}>
          {field.options?.filter((option: string) => option != null).map((option: string) => (
            <Option key={option} value={option}>
              {option}
            </Option>
          ))}
        </Select>
      )

    case 'multi_select':
      return (
        <Select mode="multiple" {...commonProps}>
          {field.options?.filter((option: string) => option != null).map((option: string) => (
            <Option key={option} value={option}>
              {option}
            </Option>
          ))}
        </Select>
      )

    case 'boolean':
      return <Select {...commonProps}>
        <Option value={true}>是</Option>
        <Option value={false}>否</Option>
      </Select>

    case 'textarea':
    default:
      return <Input.TextArea rows={3} {...commonProps} />
  }
}

const AnnotationWorkbench = () => {
  const { taskId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const [form] = Form.useForm()

  const { currentUser } = useSelector((state: RootState) => state.user)
  const { loading } = useSelector((state: RootState) => state.annotation)

  const [task, setTask] = useState<Task | null>(null)
  const [taskAssignment, setTaskAssignment] = useState<TaskAssignment | null>(null)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [annotationData, setAnnotationData] = useState<any>({})
  const [existingAnnotation, setExistingAnnotation] = useState<Annotation | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState<number>(0)
  const [taskDocuments, setTaskDocuments] = useState<Array<{id: number, filename: string, originalFilename?: string, filePath?: string, hasAnnotation?: boolean}>>([])
  const [documentListCollapsed, setDocumentListCollapsed] = useState<boolean>(false)
  
  // Document type and form config selection
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [formConfigs, setFormConfigs] = useState<FormConfig[]>([])
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState<number | undefined>(undefined)
  const [selectedFormConfigId, setSelectedFormConfigId] = useState<number | undefined>(undefined)
  const [loadingConfigs, setLoadingConfigs] = useState(false)

  // Load task data and user's assignment
  useEffect(() => {
    if (taskId && currentUser) {
      loadTaskData(parseInt(taskId))
    }
  }, [taskId, currentUser])

  // Update document index when URL parameter changes
  useEffect(() => {
    const urlDocIndex = searchParams.get('doc')
    if (urlDocIndex !== null && taskDocuments.length > 0) {
      const docIndex = parseInt(urlDocIndex, 10)
      if (!isNaN(docIndex) && docIndex >= 0 && docIndex < taskDocuments.length) {
        setCurrentDocumentIndex(docIndex)
      }
    }
  }, [searchParams, taskDocuments])

  // Load document types when component mounts
  useEffect(() => {
    loadDocumentTypes()
  }, [])

  // Load form configuration and set selected values when task is loaded
  useEffect(() => {
    if (task) {
      // Set selected document type from task's document
      if (task.document?.documentType?.id) {
        setSelectedDocumentTypeId(task.document.documentType.id)
      }
      // Set selected form config from task
      if (task.formConfig?.id) {
        setSelectedFormConfigId(task.formConfig.id)
      }
      
      loadFormConfig()
      loadExistingAnnotation()
      loadPdfUrl()
    }
  }, [task, taskAssignment, currentDocumentIndex, taskDocuments])

  // Load form configs when document type changes
  useEffect(() => {
    if (selectedDocumentTypeId) {
      loadFormConfigsByDocumentType(selectedDocumentTypeId)
    } else {
      // Load all form configs if no document type is selected
      loadAllFormConfigs()
    }
  }, [selectedDocumentTypeId])

  // Set form values when annotation data is loaded
  useEffect(() => {
    if (annotationData && Object.keys(annotationData).length > 0) {
      form.setFieldsValue(annotationData)
    }
  }, [annotationData, form])

  const loadTaskData = async (id: number) => {
    try {
      dispatch(setLoading(true))
      
      // Check authentication before making request
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No token found, redirecting to login')
        message.error('请先登录')
        navigate('/login')
        return
      }

      console.log('Loading task data for taskId:', id)
      const response = await taskService.getTaskById(id)
      const taskData = response.task
      console.log('Task data loaded:', taskData)
      setTask(taskData)
      dispatch(setCurrentTask(taskData))

      // Parse documentIndex to extract document list
      let documents: Array<{id: number, filename: string, originalFilename?: string, filePath?: string}> = []
      let docIndex = 0
      
      if (taskData.documentIndex) {
        try {
          const docIndexData = typeof taskData.documentIndex === 'string' 
            ? JSON.parse(taskData.documentIndex) 
            : taskData.documentIndex
          
          // Check if it's the new format with documents array
          if (docIndexData.documents && Array.isArray(docIndexData.documents)) {
            // New format: documents array
            documents = docIndexData.documents.map((doc: any) => ({
              id: doc.documentId || doc.id,
              filename: doc.filename,
              originalFilename: doc.originalFilename,
              filePath: doc.filePath
            }))
          } else if (docIndexData.id) {
            // Old format: single document
            documents = [{
              id: docIndexData.id,
              filename: docIndexData.filename,
              originalFilename: docIndexData.originalFilename,
              filePath: docIndexData.filePath
            }]
          }
        } catch (e) {
          console.warn('Failed to parse documentIndex:', e)
        }
      }
      
      // If no documents from documentIndex, use task.document
      if (documents.length === 0 && taskData.document?.id) {
        documents = [{
          id: taskData.document.id,
          filename: taskData.document.filename
        }]
      }
      
      // Get document index from URL query parameter or default to 0
      const urlDocIndex = searchParams.get('doc')
      if (urlDocIndex !== null) {
        docIndex = parseInt(urlDocIndex, 10)
        if (isNaN(docIndex) || docIndex < 0 || docIndex >= documents.length) {
          docIndex = 0
        }
      }
      setCurrentDocumentIndex(docIndex)

      // Find user's assignment for this task
      // For admin users, allow access even without assignment
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMIN'
      const userAssignment = taskData.assignments?.find(
        assignment => assignment.user.id === currentUser?.id
      )
      
      if (userAssignment) {
        console.log('User assignment found:', {
          id: userAssignment.id,
          type: userAssignment.assignmentType,
          status: userAssignment.status,
          userId: userAssignment.user?.id,
          currentUserId: currentUser?.id
        })
        
        // Check if assignment type is valid for annotation
        if (userAssignment.assignmentType !== 'ANNOTATION' && userAssignment.assignmentType !== 'AI_ANNOTATION') {
          console.warn('Assignment type is not ANNOTATION, cannot submit annotations:', userAssignment.assignmentType)
          if (isAdmin) {
            // Try to create a new ANNOTATION assignment
            console.log('Admin user has non-ANNOTATION assignment, attempting to create ANNOTATION assignment...')
            try {
              const assignResponse = await taskService.assignTask(taskData.id, {
                userId: currentUser.id,
                assignmentType: 'ANNOTATION'
              })
              if (assignResponse.assignment) {
                setTaskAssignment(assignResponse.assignment)
                console.log('Created new ANNOTATION assignment for admin:', assignResponse.assignment)
                message.success('已创建标注任务分配')
              } else {
                setTaskAssignment(userAssignment)
                message.warning('无法创建新的任务分配，当前分配类型不支持标注提交')
              }
            } catch (assignError: any) {
              console.warn('Failed to create ANNOTATION assignment:', assignError)
              setTaskAssignment(userAssignment)
              message.warning(`当前任务分配类型为 ${userAssignment.assignmentType}，无法提交标注`)
            }
          } else {
            setTaskAssignment(userAssignment)
            message.warning(`当前任务分配类型为 ${userAssignment.assignmentType}，无法提交标注`)
          }
        } else {
          setTaskAssignment(userAssignment)
        }
        
        // Load annotations to check which documents have been annotated
        let documentAnnotations: Map<number, boolean> = new Map()
        if (userAssignment.assignmentType === 'ANNOTATION' || userAssignment.assignmentType === 'AI_ANNOTATION') {
          try {
            const annotationsResponse = await annotationService.getTaskAnnotations(id)
            const annotations = annotationsResponse.annotations || []
            
            // Filter annotations for current user's assignment
            const userAnnotations = annotations.filter(
              (ann: Annotation) => ann.taskAssignmentId === userAssignment.id
            )
            
            // If there are any annotations, mark all documents as annotated
            // (since annotations are task-level, not document-level)
            if (userAnnotations.length > 0) {
              documents.forEach(doc => {
                documentAnnotations.set(doc.id, true)
              })
            }
          } catch (error) {
            console.warn('Failed to load annotations for document status:', error)
          }
        }
        
        // Add annotation status to documents
        const documentsWithStatus = documents.map(doc => ({
          ...doc,
          hasAnnotation: documentAnnotations.get(doc.id) || false
        }))
        
        setTaskDocuments(documentsWithStatus)
      } else if (isAdmin) {
        // Admin can access any task even without assignment
        // Try to auto-assign the task to admin user
        console.log('Admin user accessing task without assignment, attempting to auto-assign...')
        try {
          const assignResponse = await taskService.assignTask(taskData.id, {
            userId: currentUser.id,
            assignmentType: 'ANNOTATION'
          })
          if (assignResponse.assignment) {
            console.log('Auto-assigned task to admin user:', {
              id: assignResponse.assignment.id,
              type: assignResponse.assignment.assignmentType,
              status: assignResponse.assignment.status
            })
            setTaskAssignment(assignResponse.assignment)
            message.success('已自动分配任务')
          } else {
            console.warn('Failed to auto-assign, setting assignment to null')
            setTaskAssignment(null)
          }
        } catch (assignError: any) {
          console.warn('Failed to auto-assign task:', assignError)
          console.warn('Error details:', {
            status: assignError.response?.status,
            message: assignError.response?.data?.message || assignError.message
          })
          // If auto-assign fails, still allow admin to proceed (they can't submit though)
          setTaskAssignment(null)
          message.warning('无法自动分配任务，您可能无法提交标注')
        }
        
        // For admin without assignment, set documents without annotation status
        setTaskDocuments(documents)
      } else {
        console.warn('No assignment found for user:', currentUser?.id)
        message.error('您没有权限访问此任务')
        navigate('/my-tasks')
        return
      }
    } catch (error: any) {
      console.error('Failed to load task:', error)
      console.error('Error details:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        url: error.config?.url
      })
      
      // Handle authentication errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        message.error('认证失败，请重新登录')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
      } else {
        message.error(`加载任务失败: ${error.response?.data?.message || error.message || '未知错误'}`)
        navigate('/my-tasks')
      }
    } finally {
      dispatch(setLoading(false))
    }
  }

  const loadFormConfig = async () => {
    if (!task?.formConfig?.id) return

    try {
      // Get form config details
      const configResponse = await formConfigService.getFormConfig(task.formConfig.id)
      const configData = configResponse.formConfig

      if (configData) {
        // Get form fields
        const fieldsResponse = await formConfigService.getFormFields(task.formConfig.id)
        const fieldsData = fieldsResponse.fields

        if (fieldsData) {
          // Convert backend field structure to frontend form field structure
          const convertedFields: FormField[] = fieldsData.map((field: any) => ({
            id: field.id.toString(),
            name: field.fieldName,
            label: field.label,
            type: field.fieldType.toLowerCase(),
            required: field.required || false,
            placeholder: field.placeholder,
            options: field.options ? JSON.parse(field.options) : undefined
          }))

          setFormFields(convertedFields)
        }
      }
    } catch (error) {
      console.error('Failed to load form config:', error)
      message.error('加载表单配置失败')
    }
  }

  const loadExistingAnnotation = async () => {
    // Only load if we have an assignment of type ANNOTATION
    // For admin users without assignment, skip loading existing annotation
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMIN'
    
    if (!taskAssignment) {
      if (isAdmin) {
        console.log('Admin user without assignment, skipping annotation load (will create new)')
      } else {
        console.log('No assignment and not admin, skipping annotation load')
      }
      return
    }

    // Strictly check if assignment type is ANNOTATION or AI_ANNOTATION
    // Backend API requires ANNOTATION type assignment to view annotations
    const assignmentType = taskAssignment.assignmentType
    if (!assignmentType || (assignmentType !== 'ANNOTATION' && assignmentType !== 'AI_ANNOTATION')) {
      console.log('Assignment type is not ANNOTATION/AI_ANNOTATION, skipping annotation load:', assignmentType)
      return
    }

    // Double check: ensure we have a valid assignment ID
    if (!taskAssignment.id) {
      console.log('Assignment ID is missing, skipping annotation load')
      return
    }

    try {
      console.log('Loading existing annotations for task:', task!.id, 'assignment:', taskAssignment.id)
      const response = await annotationService.getTaskAnnotations(task!.id)
      const annotations = response.annotations || []

      // Find user's annotation
      const userAnnotation = annotations.find(
        (ann: Annotation) => ann.taskAssignmentId === taskAssignment.id
      )

      if (userAnnotation) {
        setExistingAnnotation(userAnnotation)
        
        // Load annotation data into form, even if status is SUBMITTED, APPROVED, or REJECTED
        // This allows editing of submitted annotations
        dispatch(setCurrentAnnotation(userAnnotation))
        try {
          const data = typeof userAnnotation.annotationData === 'string' 
            ? JSON.parse(userAnnotation.annotationData) 
            : userAnnotation.annotationData
          setAnnotationData(data)
          form.setFieldsValue(data)
          console.log('Loaded existing annotation for editing:', userAnnotation)
        } catch (e) {
          console.error('Failed to parse annotation data:', e)
        }
      } else {
        console.log('No existing annotation found for this assignment')
      }
    } catch (error: any) {
      // Handle 403 errors gracefully - this is expected if user doesn't have ANNOTATION assignment
      if (error.response?.status === 403) {
        console.log('No permission to view annotations (this is OK, will create new):', error.response?.data?.message)
        // Don't show error message, just silently skip - this is normal for new tasks
      } else {
        console.error('Failed to load existing annotation:', error)
        // Only show error for non-permission issues
        message.warning('无法加载已有标注，将创建新标注')
      }
    }
  }

  const loadDocumentTypes = async () => {
    try {
      const response = await documentTypeService.getDocumentTypes({ activeOnly: true })
      setDocumentTypes(response.documentTypes || [])
    } catch (error) {
      console.error('Failed to load document types:', error)
    }
  }

  const loadFormConfigsByDocumentType = async (documentTypeId: number) => {
    try {
      setLoadingConfigs(true)
      const response = await documentTypeService.getDocumentTypeFormConfigs(documentTypeId)
      setFormConfigs(response.formConfigs || [])
    } catch (error) {
      console.error('Failed to load form configs:', error)
      message.error('加载表单模板失败')
    } finally {
      setLoadingConfigs(false)
    }
  }

  const loadAllFormConfigs = async () => {
    try {
      setLoadingConfigs(true)
      const response = await formConfigService.getFormConfigs({ activeOnly: true })
      setFormConfigs(response.formConfigs || [])
    } catch (error) {
      console.error('Failed to load form configs:', error)
    } finally {
      setLoadingConfigs(false)
    }
  }

  const handleDocumentTypeChange = async (documentTypeId: number | undefined) => {
    setSelectedDocumentTypeId(documentTypeId)
    // Reset form config selection when document type changes
    setSelectedFormConfigId(undefined)
    
    // Update task's document type
    if (task && documentTypeId) {
      try {
        await taskService.updateTask(task.id, { documentTypeId })
        message.success('文档类型已更新')
        // Reload task data
        await loadTaskData(task.id)
      } catch (error: any) {
        console.error('Failed to update document type:', error)
        message.error(error.response?.data?.message || '更新文档类型失败')
      }
    }
  }

  const handleFormConfigChange = async (formConfigId: number | undefined) => {
    setSelectedFormConfigId(formConfigId)
    
    // Update task's form config
    if (task && formConfigId) {
      try {
        await taskService.updateTask(task.id, { formConfigId })
        message.success('表单模板已更新')
        // Reload task data and form config
        await loadTaskData(task.id)
        if (formConfigId) {
          // Reload form fields
          const fieldsResponse = await formConfigService.getFormFields(formConfigId)
          const fieldsData = fieldsResponse.fields

          if (fieldsData) {
            const convertedFields: FormField[] = fieldsData.map((field: any) => ({
              id: field.id.toString(),
              name: field.fieldName,
              label: field.label,
              type: field.fieldType.toLowerCase(),
              required: field.required || false,
              placeholder: field.placeholder,
              options: field.options ? JSON.parse(field.options) : undefined
            }))

            setFormFields(convertedFields)
            // Reset form values when form config changes
            form.resetFields()
            setAnnotationData({})
          }
        }
      } catch (error: any) {
        console.error('Failed to update form config:', error)
        message.error(error.response?.data?.message || '更新表单模板失败')
      }
    }
  }

  const loadPdfUrl = async () => {
    // Use document from taskDocuments array if available, otherwise fall back to task.document
    const currentDoc = taskDocuments.length > 0 && currentDocumentIndex < taskDocuments.length
      ? taskDocuments[currentDocumentIndex]
      : task?.document
    
    if (!currentDoc?.id) return

    try {
      // Get document preview URL
      // In a real implementation, this would be a preview URL
      setPdfUrl(`/api/documents/${currentDoc.id}/preview`)
    } catch (error) {
      console.error('Failed to load PDF:', error)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      if (!taskAssignment) {
        message.error('任务分配信息缺失')
        return
      }

      // For draft save, we could implement draft storage here
      // Currently treating as local/mock save
      message.success('草稿已保存')
    } catch (error) {
      console.error('Failed to save annotation:', error)
      message.error('保存失败')
    }
  }

  const handleSaveDraft = async () => {
    try {
      dispatch(setLoading(true))
      
      const values = await form.validateFields()

      if (!taskAssignment) {
        message.error('任务分配信息缺失')
        return
      }

      // Verify assignment type is ANNOTATION or AI_ANNOTATION
      const assignmentType = taskAssignment.assignmentType
      if (!assignmentType || (assignmentType !== 'ANNOTATION' && assignmentType !== 'AI_ANNOTATION')) {
        message.error(`无法暂存标注：任务分配类型为 ${assignmentType || '未知'}，需要 ANNOTATION 类型`)
        return
      }

      // Verify assignment belongs to current user
      if (taskAssignment.user?.id !== currentUser?.id) {
        message.error('任务分配不属于当前用户，无法暂存标注')
        return
      }

      // Get current document ID
      const currentDoc = taskDocuments.length > 0 && currentDocumentIndex < taskDocuments.length
        ? taskDocuments[currentDocumentIndex]
        : task?.document
      
      if (!currentDoc?.id) {
        message.error('无法确定当前标注的文档')
        return
      }

      const annotationPayload = {
        taskId: task!.id,
        taskAssignmentId: taskAssignment.id,
        documentId: currentDoc.id,
        annotationData: values,
        confidenceScore: 0.8,
      }

      const response = await annotationService.saveDraftAnnotation(annotationPayload)
      
      message.success('标注已暂存')
      
      // Update existing annotation state
      dispatch(setCurrentAnnotation(response.annotation))
      setExistingAnnotation(response.annotation)
      
      // Update document annotation status
      setTaskDocuments(prev => prev.map((doc, idx) => ({
        ...doc,
        hasAnnotation: idx === currentDocumentIndex ? true : doc.hasAnnotation
      })))

      // Navigate back to task list after saving draft
      setTimeout(() => {
        navigate('/my-tasks')
      }, 1000)

    } catch (error: any) {
      console.error('Failed to save draft annotation:', error)
      message.error(error.response?.data?.message || error.message || '暂存失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  const submitCurrentAnnotation = async () => {
    const values = await form.validateFields()

    if (!taskAssignment) {
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMIN'
      if (isAdmin) {
        throw new Error('任务分配信息缺失，请先分配任务或联系管理员')
      } else {
        throw new Error('任务分配信息缺失，您没有权限提交此标注')
      }
    }

    // Verify assignment type is ANNOTATION or AI_ANNOTATION
    // Backend requires ANNOTATION type assignment to submit annotations
    const assignmentType = taskAssignment.assignmentType
    if (!assignmentType || (assignmentType !== 'ANNOTATION' && assignmentType !== 'AI_ANNOTATION')) {
      console.error('Invalid assignment type for annotation submission:', assignmentType)
      throw new Error(`无法提交标注：任务分配类型为 ${assignmentType || '未知'}，需要 ANNOTATION 类型`)
    }

    // Verify assignment belongs to current user
    if (taskAssignment.user?.id !== currentUser?.id) {
      console.error('Assignment user mismatch:', {
        assignmentUserId: taskAssignment.user?.id,
        currentUserId: currentUser?.id
      })
      throw new Error('任务分配不属于当前用户，无法提交标注')
    }

    console.log('Submitting annotation:', {
      taskId: task!.id,
      taskAssignmentId: taskAssignment.id,
      assignmentType: taskAssignment.assignmentType,
      userId: currentUser?.id
    })

    // Get current document ID from taskDocuments array if available, otherwise fall back to task.document
    const currentDoc = taskDocuments.length > 0 && currentDocumentIndex < taskDocuments.length
      ? taskDocuments[currentDocumentIndex]
      : task?.document
    
    if (!currentDoc?.id) {
      throw new Error('无法确定当前标注的文档')
    }

    const annotationPayload = {
      taskId: task!.id,
      taskAssignmentId: taskAssignment.id,
      documentId: currentDoc.id, // Add current document ID
      annotationData: values,
      confidenceScore: 0.8, // Could be calculated based on form validation
    }

    try {
      // Submit annotation - backend allows ANNOTATOR, REVIEWER, EXPERT, and ADMIN roles
      return await annotationService.submitAnnotation(annotationPayload)
    } catch (error: any) {
      console.error('Annotation submission error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        taskId: task!.id,
        assignmentId: taskAssignment.id,
        assignmentType: taskAssignment.assignmentType,
        userRole: currentUser?.role
      })
      
      // Provide more specific error messages
      if (error.response?.status === 403) {
        const errorMsg = error.response?.data?.message || '无权限提交此标注'
        throw new Error(errorMsg)
      } else if (error.response?.status === 400) {
        throw new Error(error.response?.data?.message || '提交失败：数据格式错误')
      } else {
        throw error
      }
    }
  }

  const handleSubmit = async () => {
    try {
      dispatch(setLoading(true))
      const isResubmission = existingAnnotation?.status === 'SUBMITTED' || 
                            existingAnnotation?.status === 'APPROVED' || 
                            existingAnnotation?.status === 'REJECTED'
      
      // Check if this is the last document
      const isLastDocument = taskDocuments.length > 0 && currentDocumentIndex >= taskDocuments.length - 1
      
      const response = await submitCurrentAnnotation()

      if (isLastDocument) {
        message.success('任务已完成并提交！')
      } else {
        message.success(isResubmission ? '标注重新提交成功' : '标注提交成功')
      }
      
      dispatch(setCurrentAnnotation(response.annotation))
      
      // Update document annotation status
      setTaskDocuments(prev => prev.map((doc, idx) => ({
        ...doc,
        hasAnnotation: idx === currentDocumentIndex ? true : doc.hasAnnotation
      })))

      // Navigate back to task list
      setTimeout(() => {
        navigate('/my-tasks')
      }, 1500)

    } catch (error: any) {
      console.error('Failed to submit annotation:', error)
      message.error(error.message || '提交失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleNext = async () => {
    try {
      dispatch(setLoading(true))
      
      // 1. Submit current annotation
      await submitCurrentAnnotation()
      
      // Update document annotation status for current document
      setTaskDocuments(prev => prev.map((doc, idx) => ({
        ...doc,
        hasAnnotation: idx === currentDocumentIndex ? true : doc.hasAnnotation
      })))
      
      // 2. Check if this is the last document in the task
      const isLastDocument = taskDocuments.length > 0 && currentDocumentIndex >= taskDocuments.length - 1
      
      if (isLastDocument) {
        // This is the last document, complete the task
        message.success('任务已完成并提交！')
        
        // Update assignment status to COMPLETED if not already
        if (taskAssignment && taskAssignment.status !== 'COMPLETED') {
          try {
            // The backend should have already updated the assignment status when annotation was submitted
            // But we can explicitly mark it as completed here if needed
            console.log('Task completed, assignment status should be updated by backend')
          } catch (error) {
            console.error('Failed to update assignment status:', error)
          }
        }
        
        // Navigate back to task list after a short delay
        setTimeout(() => {
          navigate('/my-tasks')
        }, 1500)
      } else {
        // Switch to next document in the same task
        message.success('保存成功，正在切换下一个文档...')
        const nextDocIndex = currentDocumentIndex + 1
        setCurrentDocumentIndex(nextDocIndex)
        setSearchParams({ doc: nextDocIndex.toString() })
        
        // Reset form for next document
        form.resetFields()
        setAnnotationData({})
        setExistingAnnotation(null)
        
        // Reload PDF URL for the next document
        const nextDoc = taskDocuments[nextDocIndex]
        if (nextDoc?.id) {
          setPdfUrl(`/api/documents/${nextDoc.id}/preview`)
        }
        
        message.success(`已切换到第 ${nextDocIndex + 1} 个文档（共 ${taskDocuments.length} 个）`)
      }

    } catch (error: any) {
      console.error('Failed to process next document/task:', error)
      message.error(error.message || '操作失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  const renderFormField = (field: FormField) => {
    const commonProps = {
      placeholder: field.placeholder || `请输入${field.label}`,
    }

    switch (field.type) {
      case 'text':
        return <Input {...commonProps} />
      case 'number':
        return <Input type="number" {...commonProps} />
      case 'date':
        return <Input type="date" {...commonProps} />
      case 'select':
        return (
          <Select {...commonProps}>
            {field.options?.filter(option => option != null).map(option => (
              <Option key={option} value={option}>{option}</Option>
            ))}
          </Select>
        )
      case 'textarea':
        return <Input.TextArea rows={3} {...commonProps} />
      default:
        return <Input {...commonProps} />
    }
  }

  if (loading && !task) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!task || !taskAssignment) {
    return (
      <Alert
        message="任务未找到"
        description="您可能没有权限访问此任务，或任务不存在。"
        type="error"
        showIcon
        action={
          <Button size="small" onClick={() => navigate('/tasks')}>
            返回任务列表
          </Button>
        }
      />
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'APPROVED':
        return '#52c41a'
      case 'DRAFT':
        return '#faad14'
      case 'REJECTED':
        return '#ff4d4f'
      default:
        return '#d9d9d9'
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/tasks')}
          style={{ marginRight: 16 }}
        >
          返回任务列表
        </Button>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
          标注工作台 - {task.title}
        </span>
      </div>

      <Row gutter={[16, 16]}>
        {/* 左侧PDF预览区域 */}
        <Col xs={24} lg={taskDocuments.length > 1 ? 10 : 12}>
          <Card
            title={`PDF预览 - ${taskDocuments.length > 0 && currentDocumentIndex < taskDocuments.length 
              ? taskDocuments[currentDocumentIndex].originalFilename || taskDocuments[currentDocumentIndex].filename
              : task.document.filename}${taskDocuments.length > 1 ? ` (${currentDocumentIndex + 1}/${taskDocuments.length})` : ''}`}
            style={{ height: '700px' }}
          >
            <div 
              style={{ 
                height: '620px', 
                overflow: 'hidden',
                position: 'relative'
              }}
              onWheel={(e) => {
                // Prevent page scroll when wheel is used on image viewer
                const target = e.target as HTMLElement
                if (target.closest('[data-image-viewer]')) {
                  e.stopPropagation()
                }
              }}
            >
              {pdfUrl ? (
                <FileViewer
                  url={pdfUrl}
                  width={800}
                  height={600}
                />
              ) : (
                <div style={{
                  height: '600px',
                  background: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed #d9d9d9'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <Spin size="large" />
                    <p style={{ marginTop: 16, color: '#666' }}>
                      正在加载PDF...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* 中间标注表单区域 */}
        <Col xs={24} lg={taskDocuments.length > 1 ? 10 : 12}>
          <Card
            title="标注表单"
            style={{ height: '700px' }}
            extra={
              existingAnnotation ? (
                <div style={{
                  color: getStatusColor(existingAnnotation.status),
                  fontSize: '12px'
                }}>
                  状态: {
                    existingAnnotation.status === 'DRAFT' ? '草稿' :
                    existingAnnotation.status === 'SUBMITTED' ? '已提交' :
                    existingAnnotation.status === 'APPROVED' ? '已通过' :
                    existingAnnotation.status === 'REJECTED' ? '已拒绝' : existingAnnotation.status
                  }
                </div>
              ) : null
            }
          >
            <div style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
              {/* Document Type and Form Config Selection */}
              <div style={{ marginBottom: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>文档类型:</label>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="选择文档类型"
                      value={selectedDocumentTypeId}
                      onChange={handleDocumentTypeChange}
                      loading={loadingConfigs}
                      allowClear
                    >
                      {documentTypes.map(dt => (
                        <Option key={dt.id} value={dt.id}>{dt.name}</Option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>表单模板:</label>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="选择表单模板"
                      value={selectedFormConfigId}
                      onChange={handleFormConfigChange}
                      loading={loadingConfigs}
                      allowClear
                    >
                      {formConfigs.map(fc => (
                        <Option key={fc.id} value={fc.id}>{fc.name}</Option>
                      ))}
                    </Select>
                  </div>
                </Space>
              </div>
              
              <Form
                form={form}
                layout="vertical"
                style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}
              >
                {formFields.length > 0 ? (
                  formFields.map(field => (
                    <Form.Item
                      key={field.id}
                      name={field.name}
                      label={field.label}
                      rules={field.required ? [
                        { required: true, message: `请输入${field.label}` }
                      ] : []}
                    >
                      {renderFormField(field)}
                    </Form.Item>
                  ))
                ) : (
                  // Fallback form for when form config is not available
                  <>
                    <Form.Item
                      name="field1"
                      label="字段1"
                      rules={[{ required: true, message: '请输入字段1' }]}
                    >
                      <Input placeholder="请输入字段1" />
                    </Form.Item>

                    <Form.Item
                      name="field2"
                      label="字段2"
                      rules={[{ required: true, message: '请输入字段2' }]}
                    >
                      <Input placeholder="请输入字段2" />
                    </Form.Item>

                    <Form.Item
                      name="field3"
                      label="字段3"
                    >
                      <Input.TextArea rows={3} placeholder="请输入其他信息" />
                    </Form.Item>
                  </>
                )}
              </Form>

              <div>
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Button
                    onClick={handleSave}
                    icon={<SaveOutlined />}
                    loading={loading}
                    title="保存当前"
                  >
                    保存当前
                  </Button>
                  <div style={{ marginLeft: 'auto' }}>
                    <Space>
                      <Button
                        type="primary"
                        onClick={handleSaveDraft}
                        icon={<SaveOutlined />}
                        loading={loading}
                        title="暂存并退出"
                      >
                        暂存并退出
                      </Button>
                      <Button
                        onClick={handleNext}
                        icon={<StepForwardOutlined />}
                        loading={loading}
                        type={taskDocuments.length > 0 && currentDocumentIndex >= taskDocuments.length - 1 ? "primary" : "default"}
                        title={taskDocuments.length > 0 && currentDocumentIndex >= taskDocuments.length - 1
                          ? '完成任务并提交'
                          : '保存并下一个'}
                      >
                        {taskDocuments.length > 0 && currentDocumentIndex >= taskDocuments.length - 1
                          ? '完成任务并提交'
                          : '保存并下一个'}
                      </Button>
                    </Space>
                  </div>
                </div>
                {existingAnnotation?.status === 'SUBMITTED' && (
                  <div style={{ marginTop: 8, color: '#1890ff', fontSize: '12px' }}>
                    此标注已提交，可以修改后重新提交
                  </div>
                )}
                {existingAnnotation?.status === 'APPROVED' && (
                  <div style={{ marginTop: 8, color: '#52c41a', fontSize: '12px' }}>
                    此标注已通过审核，可以修改后重新提交
                  </div>
                )}
                {existingAnnotation?.status === 'REJECTED' && (
                  <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: '12px' }}>
                    此标注已被拒绝，请修改后重新提交
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Col>

        {/* 右侧文档列表（可收起） */}
        {taskDocuments.length > 1 && (
          <div
            style={{
              position: 'fixed',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000,
              width: documentListCollapsed ? '50px' : '280px',
              transition: 'width 0.3s ease',
            }}
          >
            <Card
              title={
                documentListCollapsed ? (
                  <Button
                    type="text"
                    icon={<MenuUnfoldOutlined />}
                    onClick={() => setDocumentListCollapsed(false)}
                    size="small"
                    style={{ padding: 0 }}
                  />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>文档列表</span>
                    <Button
                      type="text"
                      icon={<MenuFoldOutlined />}
                      onClick={() => setDocumentListCollapsed(true)}
                      size="small"
                    />
                  </div>
                )
              }
              style={{ 
                height: '600px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              size="small"
            >
              {!documentListCollapsed && (
                <List
                  dataSource={taskDocuments}
                  style={{ maxHeight: '500px', overflowY: 'auto' }}
                  renderItem={(doc, index) => (
                    <List.Item
                      style={{
                        cursor: 'pointer',
                        backgroundColor: index === currentDocumentIndex ? '#e6f7ff' : 'transparent',
                        padding: '12px',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        border: index === currentDocumentIndex ? '1px solid #1890ff' : '1px solid #f0f0f0'
                      }}
                      onClick={() => {
                        setCurrentDocumentIndex(index)
                        setSearchParams({ doc: index.toString() })
                        form.resetFields()
                        setAnnotationData({})
                        setExistingAnnotation(null)
                        
                        // Reload PDF URL for the selected document
                        if (doc?.id) {
                          setPdfUrl(`/api/documents/${doc.id}/preview`)
                        }
                        
                        // Reload annotation for the selected document
                        if (taskAssignment) {
                          loadExistingAnnotation()
                        }
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{ position: 'relative' }}>
                            <FileTextOutlined style={{ fontSize: '20px', color: index === currentDocumentIndex ? '#1890ff' : '#666' }} />
                            {doc.hasAnnotation && (
                              <CheckCircleOutlined 
                                style={{ 
                                  position: 'absolute',
                                  bottom: -2,
                                  right: -2,
                                  fontSize: '12px',
                                  color: '#52c41a',
                                  backgroundColor: '#fff',
                                  borderRadius: '50%'
                                }} 
                              />
                            )}
                          </div>
                        }
                        title={
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: index === currentDocumentIndex ? 'bold' : 'normal', fontSize: '13px' }}>
                                {doc.originalFilename || doc.filename}
                              </span>
                              {doc.hasAnnotation && (
                                <span style={{ 
                                  fontSize: '11px', 
                                  color: '#52c41a',
                                  backgroundColor: '#f6ffed',
                                  padding: '2px 6px',
                                  borderRadius: '2px',
                                  border: '1px solid #b7eb8f'
                                }}>
                                  已标注
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                              {index + 1} / {taskDocuments.length}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </div>
        )}
      </Row>

      {/* Task Information */}
      <Card title="任务信息" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="任务状态">
                <span style={{ color: getStatusColor(task.status) }}>
                  {task.status === 'CREATED' ? '已创建' :
                   task.status === 'ASSIGNED' ? '已分配' :
                   task.status === 'IN_PROGRESS' ? '进行中' :
                   task.status === 'COMPLETED' ? '已完成' :
                   task.status === 'REVIEWED' ? '已审核' :
                   task.status === 'CLOSED' ? '已关闭' : task.status}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={6}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="优先级">
                {task.priority === 'LOW' ? '低' :
                 task.priority === 'NORMAL' ? '普通' :
                 task.priority === 'HIGH' ? '高' :
                 task.priority === 'URGENT' ? '紧急' : task.priority}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={6}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="分配类型">
                {taskAssignment?.assignmentType === 'ANNOTATION' ? '标注任务' : '审核任务'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={6}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="创建时间">
                {new Date(task.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default AnnotationWorkbench
