import { useState, useEffect, useMemo, useRef } from 'react'
import { Layout, message, Modal, Tag, Select, TreeSelect, Popconfirm, Button, Descriptions, Table, Input } from 'antd'
import { DeleteOutlined, EditOutlined, FileTextOutlined, EyeOutlined } from '@ant-design/icons'
import type { TreeProps } from 'antd/es/tree'
import type { UploadProps } from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { Document, setDocuments, addDocument, removeDocument, setLoading, setError } from '../store/slices/fileSlice'
import { documentService, folderService, documentTypeService, formConfigService, taskService, annotationService, Folder, DocumentType, FormConfig, Annotation } from '../services/api'
import useDocumentPreview from '../hooks/useDocumentPreview'
import FileViewer from '../components/FileViewer'
import FolderTreePanel from '../components/folders/FolderTreePanel'
import type { FolderTreeNode } from '../components/folders/FolderTree'
import FileExplorerToolbar from '../components/file-explorer/FileExplorerToolbar'
import FileExplorerAddressBar from '../components/file-explorer/FileExplorerAddressBar'
import FileExplorerView from '../components/file-explorer/FileExplorerView'
import FileExplorerStatusBar from '../components/file-explorer/FileExplorerStatusBar'
import QuickAccessPanel from '../components/file-explorer/QuickAccessPanel'

const { Option } = Select
const { Sider, Content } = Layout

type FolderSummary = Folder

const FileManagement = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { documents, loading, pagination } = useSelector((state: RootState) => state.document)
  const { currentUser } = useSelector((state: RootState) => state.user)

  // Debug logging for development
  // console.log('FileManagement state:', { documents: documents.length, loading, currentFolderId })
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10)
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
  const [folderBreadcrumb, setFolderBreadcrumb] = useState<FolderSummary[]>([])
  const [folderTreeData, setFolderTreeData] = useState<FolderTreeNode[]>([])
  const [folderMap, setFolderMap] = useState<Record<number, FolderSummary>>({})
  const [folderChildrenCache, setFolderChildrenCache] = useState<Record<string, FolderSummary[]>>({})
  const [selectedTreeKeys, setSelectedTreeKeys] = useState<React.Key[]>([])
  const [editDocumentTypeVisible, setEditDocumentTypeVisible] = useState(false)
  const [editPriorityVisible, setEditPriorityVisible] = useState(false)
  const [viewTemplateFieldsVisible, setViewTemplateFieldsVisible] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [templateFields, setTemplateFields] = useState<any[]>([])
  const [selectedFormConfigs, setSelectedFormConfigs] = useState<FormConfig[]>([])
  const [batchCreateTasksVisible, setBatchCreateTasksVisible] = useState(false)
  const [batchCreateTasksLoading, setBatchCreateTasksLoading] = useState(false)
  const [batchTaskName, setBatchTaskName] = useState('')
  const [uploadingFolder, setUploadingFolder] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [folders, setFolders] = useState<FolderSummary[]>([])
  const [treeSearchValue, setTreeSearchValue] = useState('')
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<React.Key[]>([])
  const [isInlineCreatingFolder, setIsInlineCreatingFolder] = useState(false)
  const [inlineFolderName, setInlineFolderName] = useState('')
  const [inlineCreateLoading, setInlineCreateLoading] = useState(false)
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null)
  const [renamingFolderName, setRenamingFolderName] = useState('')
  const [renameFolderLoading, setRenameFolderLoading] = useState(false)
  const [moveFolderModalVisible, setMoveFolderModalVisible] = useState(false)
  const [movingFolder, setMovingFolder] = useState<FolderSummary | null>(null)
  const [moveTargetParentKey, setMoveTargetParentKey] = useState<string>('root')
  const [moveFolderLoading, setMoveFolderLoading] = useState(false)
  const [annotationModalVisible, setAnnotationModalVisible] = useState(false)
  const [currentAnnotations, setCurrentAnnotations] = useState<Annotation[]>([])
  const [loadingAnnotations, setLoadingAnnotations] = useState(false)
  const [annotationHistoryModalVisible, setAnnotationHistoryModalVisible] = useState(false)
  const [currentDocumentForHistory, setCurrentDocumentForHistory] = useState<Document | null>(null)
  const [annotationHistory, setAnnotationHistory] = useState<Array<{
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
  }>>([])
  const [loadingAnnotationHistory, setLoadingAnnotationHistory] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [navigationHistory, setNavigationHistory] = useState<(number | null)[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const {
    previewVisible,
    previewDocument,
    previewModalSize,
    openPreview,
    closePreview,
    updatePreviewSize
  } = useDocumentPreview()

  const cacheKey = (parentId: number | null) => (parentId ?? 'root').toString()

  const updateFolderMap = (entries: FolderSummary[]) => {
    if (!entries || entries.length === 0) return
    setFolderMap(prev => {
      const next = { ...prev }
      entries.forEach(folder => {
        next[folder.id] = folder
      })
      return next
    })
  }

  const updateFolderCache = (parentId: number | null, children: FolderSummary[]) => {
    const key = cacheKey(parentId)
    setFolderChildrenCache(prev => ({
      ...prev,
      [key]: children
    }))
  }

  const getCachedChildren = (parentId: number | null) => {
    const key = cacheKey(parentId)
    return folderChildrenCache[key]
  }

  // Load documents when folder or page changes
  useEffect(() => {
    loadDocuments()
  }, [currentPage, currentFolderId])

  useEffect(() => {
    loadDocumentTypes()
  }, [])

  useEffect(() => {
    loadCurrentFolderChildren()
  }, [currentFolderId])

  useEffect(() => {
    initializeFolderTree()
  }, [])

  useEffect(() => {
    setFolderBreadcrumb(buildBreadcrumb(currentFolderId))
  }, [currentFolderId, folderMap])

  const loadDocuments = async () => {
    try {
      dispatch(setLoading(true))
      const params = {
        page: currentPage,
        size: pageSize,
        sortBy: 'createdAt',
        sortDir: 'desc',
        folderId: currentFolderId ?? undefined,
        root: currentFolderId === null
      }
      console.log('Loading documents with params:', params)
      const result = await documentService.getDocuments(params)
      console.log('Loaded documents result:', result)
      dispatch(setDocuments(result))
    } catch (error: any) {
      dispatch(setError(error.message || '加载文档失败'))
      message.error('加载文档失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  const loadDocumentTypes = async () => {
    try {
      const result = await documentTypeService.getDocumentTypes({ activeOnly: true })
      setDocumentTypes(result.documentTypes)
    } catch (error) {
      console.error('加载文档类型失败:', error)
    }
  }


  const fetchFolderChildren = async (parentId: number | null) => {
    try {
      const response = await folderService.getFolders(parentId ?? undefined)
      const children = response.folders || []
      updateFolderMap(children)
      updateFolderCache(parentId, children)
      return children
    } catch (error) {
      console.error('加载文件夹失败:', error)
      throw error
    }
  }

  const loadCurrentFolderChildren = async () => {
    try {
      const children = await fetchFolderChildren(currentFolderId)
      setFolders(children)
    } catch (error) {
      message.error('加载文件夹失败')
    }
  }

  const initializeFolderTree = async () => {
    try {
      const rootChildren = await fetchFolderChildren(null)
      setFolderTreeData(rootChildren.map(toTreeNode))
    } catch (error) {
      console.error('初始化文件夹树失败:', error)
    }
  }

  const loadTreeBranch = async (parentId: number | null) => {
    try {
      const children = await fetchFolderChildren(parentId)
      const nodes = children.map(toTreeNode)
      if (parentId === null) {
        setFolderTreeData(nodes)
      } else {
        setFolderTreeData(prev => updateTreeData(prev, parentId.toString(), nodes))
      }
    } catch (error) {
      console.error('刷新目录树失败:', error)
    }
  }

  const buildBreadcrumb = (folderId: number | null) => {
    if (folderId === null) {
      return []
    }
    const crumbs: FolderSummary[] = []
    let current: FolderSummary | undefined = folderMap[folderId]
    const visited = new Set<number>()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      crumbs.unshift(current)
      if (current.parentId === null) {
        break
      }
      current = current.parentId !== null ? folderMap[current.parentId] : undefined
    }
    return crumbs
  }

  const toTreeNode = (folder: FolderSummary): FolderTreeNode => ({
    key: folder.id.toString(),
    title: folder.name,
    folder
  })

  const updateTreeData = (list: FolderTreeNode[], key: React.Key, children: FolderTreeNode[]): FolderTreeNode[] =>
    list.map(node => {
      if (node.key === key) {
        return {
          ...node,
          children
        }
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children)
        }
      }
      return node
    })

  const handleTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (!selectedKeys || selectedKeys.length === 0) {
      enterFolder(null)
      return
    }
    const key = selectedKeys[0] as string
    const folderId = Number(key)
    if (!Number.isNaN(folderId)) {
      enterFolder(folderId)
    }
  }

  const handleTreeLoadData: TreeProps['loadData'] = async (node) => {
    const folderId = Number(node.key)
    if (Number.isNaN(folderId)) {
      return
    }
    const cachedChildren = getCachedChildren(folderId)
    if (cachedChildren) {
      if (!node.children || node.children.length === 0) {
        const childNodes = cachedChildren.map(toTreeNode)
        setFolderTreeData(prev => updateTreeData(prev, node.key as string, childNodes))
      }
      return
    }
    const children = await fetchFolderChildren(folderId)
    const nodes = children.map(toTreeNode)
    setFolderTreeData(prev => updateTreeData(prev, node.key as string, nodes))
  }

  const handleTreeExpand: TreeProps['onExpand'] = (expandedKeys) => {
    setTreeExpandedKeys(expandedKeys as React.Key[])
  }

  // Folder navigation functions
  const expandTreeToFolder = (folderId: number) => {
    const ancestors: React.Key[] = []
    const visited = new Set<number>()
    let current: FolderSummary | undefined = folderMap[folderId]
    while (current && !visited.has(current.id)) {
      ancestors.unshift(current.id.toString())
      visited.add(current.id)
      if (current.parentId === null) {
        break
      }
      current = current.parentId !== null ? folderMap[current.parentId] : undefined
    }
    if (ancestors.length > 0) {
      setTreeExpandedKeys(prev => {
        const merged = new Set(prev)
        ancestors.forEach(key => merged.add(key))
        return Array.from(merged)
      })
    }
  }

  const enterFolder = (folderId: number | null, addToHistory = true) => {
    setCurrentFolderId(folderId)
    setCurrentPage(0)
    if (folderId === null) {
      setSelectedTreeKeys([])
    } else {
      setSelectedTreeKeys([folderId.toString()])
      expandTreeToFolder(folderId)
    }
    
    // Add to navigation history
    if (addToHistory) {
      const newHistory = navigationHistory.slice(0, historyIndex + 1)
      newHistory.push(folderId)
      setNavigationHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
  }

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const folderId = navigationHistory[newIndex]
      setCurrentFolderId(folderId)
      setCurrentPage(0)
      if (folderId === null) {
        setSelectedTreeKeys([])
      } else {
        setSelectedTreeKeys([folderId.toString()])
        expandTreeToFolder(folderId)
      }
    }
  }

  const goForward = () => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const folderId = navigationHistory[newIndex]
      setCurrentFolderId(folderId)
      setCurrentPage(0)
      if (folderId === null) {
        setSelectedTreeKeys([])
      } else {
        setSelectedTreeKeys([folderId.toString()])
        expandTreeToFolder(folderId)
      }
    }
  }

  const goToParentFolder = () => {
    if (currentFolderId === null) {
      return
    }
    const parentId = folderMap[currentFolderId]?.parentId ?? null
    enterFolder(parentId)
  }

  const ensureFolderHierarchy = async (relativePath: string, baseFolderId: number | null = currentFolderId): Promise<number | null> => {
    if (!relativePath) {
      return baseFolderId
    }
    const segments = relativePath.split('/').filter(Boolean)
    let parentId = baseFolderId

    for (const segment of segments) {
      const folder = await findOrCreateChildFolder(parentId, segment)
      parentId = folder?.id ?? parentId
    }

    return parentId
  }

  const findExistingFolder = async (parentId: number | null, name: string) => {
    const cache = getCachedChildren(parentId)
    if (cache) {
      const match = cache.find(folder => folder.name === name)
      if (match) {
        return match
      }
    }
    const children = await fetchFolderChildren(parentId)
    return children.find(folder => folder.name === name)
  }

  // Track folder creation in progress to prevent duplicates
  const folderCreationInProgress = useRef<Set<string>>(new Set())
  // Track folder upload in progress to prevent duplicate calls
  const folderUploadInProgress = useRef<boolean>(false)
  // Track root folder creation for current upload session
  const currentUploadRootFolder = useRef<FolderSummary | null>(null)
  // Track processed file lists to prevent duplicate processing
  const processedFileLists = useRef<Set<string>>(new Set())

  const findOrCreateChildFolder = async (parentId: number | null, name: string) => {
    const cacheKey = `${parentId ?? 'root'}-${name}`
    
    // Check if folder creation is already in progress
    if (folderCreationInProgress.current.has(cacheKey)) {
      // Wait and retry multiple times
      for (let retry = 0; retry < 10; retry++) {
        await new Promise(resolve => setTimeout(resolve, 100 + retry * 50)) // Increasing wait time
        
        // Check cache first
        const cache = getCachedChildren(parentId)
        const existing = (cache || []).find(folder => folder.name === name)
        if (existing) {
          return existing
        }
        
        // If not in cache, refresh from server
        const refreshed = await fetchFolderChildren(parentId)
        const found = refreshed.find(folder => folder.name === name)
        if (found) {
          return found
        }
        
        // If creation is no longer in progress, break and try to create
        if (!folderCreationInProgress.current.has(cacheKey)) {
          break
        }
      }
    }

    // Check cache first
    const cache = getCachedChildren(parentId)
    let siblings = cache
    if (!siblings) {
      siblings = await fetchFolderChildren(parentId)
    }

    const existing = (siblings || []).find(folder => folder.name === name)
    if (existing) {
      return existing
    }

    // Mark creation as in progress
    folderCreationInProgress.current.add(cacheKey)

    try {
      // Double-check before creating (another process might have created it)
      const refreshedChildren = await fetchFolderChildren(parentId)
      const existingFolder = refreshedChildren.find(folder => folder.name === name)
      if (existingFolder) {
        folderCreationInProgress.current.delete(cacheKey)
        return existingFolder
      }

      const created = await folderService.createFolder(name, parentId ?? null)
      const updatedChildren = [...(siblings || []), created.folder]
      updateFolderCache(parentId, updatedChildren)
      updateFolderMap([created.folder])

      if (parentId === currentFolderId) {
        setFolders(updatedChildren)
      }

      await loadTreeBranch(parentId)
      folderCreationInProgress.current.delete(cacheKey)
      return created.folder
    } catch (error: any) {
      folderCreationInProgress.current.delete(cacheKey)
      
      const errorMessage = error.response?.data?.message ||
        error.response?.statusText ||
        error.message ||
        ''

      // Check for duplicate folder errors (400 or 500 with constraint violation)
      const duplicateFolder =
        (error.response?.status === 400 || error.response?.status === 500) &&
        (errorMessage.includes('同名') || 
         errorMessage.includes('already exists') ||
         errorMessage.includes('同级文件夹名称不能重复') ||
         errorMessage.includes('ConstraintViolation') ||
         errorMessage.includes('UK') ||
         errorMessage.includes('constraint'))

      if (duplicateFolder) {
        // Folder was created by another process, wait a bit and fetch it
        await new Promise(resolve => setTimeout(resolve, 200))
        const refreshedChildren = await fetchFolderChildren(parentId)
        const existingFolder = refreshedChildren.find(folder => folder.name === name)
        if (existingFolder) {
          console.log(`Folder ${name} was created by another process, using existing folder`)
          return existingFolder
        }
        // If still not found, retry once more
        await new Promise(resolve => setTimeout(resolve, 300))
        const retryChildren = await fetchFolderChildren(parentId)
        const retryFolder = retryChildren.find(folder => folder.name === name)
        if (retryFolder) {
          console.log(`Folder ${name} found on retry`)
          return retryFolder
        }
      }

      throw error
    }
  }

  const getUploadRootFolderName = (files: File[]): string => {
    for (const file of files) {
      const relativePath = (file as any).webkitRelativePath
      if (relativePath && relativePath.includes('/')) {
        const [root] = relativePath.split('/')
        if (root) {
          return root
        }
      }
    }
    if (files.length === 1) {
      const name = files[0].name
      const dotIndex = name.lastIndexOf('.')
      return dotIndex > 0 ? name.substring(0, dotIndex) : name
    }
    return '上传的文件夹'
  }

  const createUploadRootFolder = async (desiredName?: string): Promise<FolderSummary> => {
    const parentId = currentFolderId ?? null
    const baseName = (desiredName && desiredName.trim()) || '上传的文件夹'
    const maxAttempts = 5

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const suffix = attempt === 0 ? '' : `-${new Date().toISOString().replace(/[-T:.Z]/g, '').slice(-6)}${attempt > 1 ? `-${attempt}` : ''}`
      const nameCandidate = `${baseName}${suffix}`
      const cacheKey = `${parentId ?? 'root'}-${nameCandidate}`

      // Check if creation is in progress
      if (folderCreationInProgress.current.has(cacheKey)) {
        await new Promise(resolve => setTimeout(resolve, 200))
        const existing = await findExistingFolder(parentId, nameCandidate)
        if (existing) {
          return existing
        }
        continue
      }

      const existing = await findExistingFolder(parentId, nameCandidate)
      if (existing) {
        if (attempt === 0) {
          console.log('Found existing root folder:', existing.name, 'ID:', existing.id)
          return existing
        }
        continue
      }

      // Mark creation as in progress
      folderCreationInProgress.current.add(cacheKey)

      try {
        // Double-check before creating
        const doubleCheck = await findExistingFolder(parentId, nameCandidate)
        if (doubleCheck) {
          folderCreationInProgress.current.delete(cacheKey)
          return doubleCheck
        }

        const response = await folderService.createFolder(nameCandidate, parentId)
        const createdFolder = response.folder
        updateFolderMap([createdFolder])

        setFolderChildrenCache(prev => {
          const key = (parentId ?? 'root').toString()
          const siblings = prev[key] || []
          return {
            ...prev,
            [key]: [...siblings, createdFolder]
          }
        })

        if (parentId === currentFolderId) {
          setFolders(prev => [...prev, createdFolder])
        }

        folderCreationInProgress.current.delete(cacheKey)
        return createdFolder
      } catch (error: any) {
        folderCreationInProgress.current.delete(cacheKey)
        
        const errorMessage = error.response?.data?.message || error.message || ''
        const duplicate =
          (error.response?.status === 400 || error.response?.status === 500) &&
          (errorMessage.includes('同名') ||
            errorMessage.includes('存在同名') ||
            errorMessage.includes('存在') ||
            errorMessage.includes('ConstraintViolation') ||
            errorMessage.includes('UK'))
        if (duplicate) {
          // Folder was created by another process, fetch it
          const existing = await findExistingFolder(parentId, nameCandidate)
          if (existing) {
            return existing
          }
        }
        if (!duplicate) {
          throw error
        }
      }
    }

    throw new Error('未能创建目标文件夹，请稍后重试')
  }

  const handleUpload = async (file: File) => {
    try {
      const result = await documentService.uploadDocument(file, {
        folderId: currentFolderId ?? undefined
      })
      dispatch(addDocument(result.document))
      message.success(result.message)
      return false // Prevent default upload
    } catch (error: any) {
      console.error('上传文件失败:', file.name, error)
      const errorMessage = error.response?.data?.message ||
                          error.response?.statusText ||
                          error.message ||
                          '上传失败'

      // Handle duplicate file case
      if (errorMessage && errorMessage.includes('文件已存在')) {
        message.warning(`文件 ${file.name} 已存在`)
        // Refresh document list to show existing files
        await loadDocuments()
        return false
      } else {
        message.error(`上传文件 ${file.name} 失败: ${errorMessage}`)
        return false
      }
    }
  }

  const handleDelete = async (documentId: number) => {
    console.log('handleDelete called with documentId:', documentId, 'type:', typeof documentId)
    try {
      await documentService.deleteDocument(documentId)
      dispatch(removeDocument(documentId))
      message.success('文档删除成功')
    } catch (error: any) {
      console.error('Delete failed:', error)
      message.error(error.response?.data?.message || '删除失败')
      // Refresh document list to ensure state consistency
      loadDocuments()
    }
  }

  const handleBatchDelete = async () => {
    console.log('handleBatchDelete called with selectedRowKeys:', selectedRowKeys, 'types:', selectedRowKeys.map(k => typeof k))
    try {
      // Separate folders and documents
      const folderKeys: string[] = []
      const documentKeys: string[] = []
      
      selectedRowKeys.forEach(key => {
        const keyStr = String(key)
        if (keyStr.startsWith('folder-')) {
          folderKeys.push(keyStr)
        } else if (keyStr.startsWith('file-')) {
          documentKeys.push(keyStr)
        } else {
          // Legacy format: assume it's a document ID if it's a number
          if (typeof key === 'number') {
            documentKeys.push(`file-${key}`)
          }
        }
      })

      const successfulFolderDeletions: number[] = []
      const successfulDocumentDeletions: number[] = []

      // Delete folders
      for (const key of folderKeys) {
        const folderId = parseInt(key.replace('folder-', ''), 10)
        if (!isNaN(folderId)) {
          try {
            await handleDeleteFolder(folderId)
            successfulFolderDeletions.push(folderId)
          } catch (error: any) {
            console.error(`Failed to delete folder ${folderId}:`, error)
            message.error(`文件夹 ${folderId} 删除失败`)
          }
        }
      }

      // Delete documents
      for (const key of documentKeys) {
        const docId = parseInt(key.replace('file-', ''), 10)
        if (!isNaN(docId)) {
          try {
            await documentService.deleteDocument(docId)
            successfulDocumentDeletions.push(docId)
          } catch (error: any) {
            console.error(`Failed to delete document ${docId}:`, error)
            message.error(`文档 ${docId} 删除失败`)
          }
        }
      }

      // Update state for successfully deleted documents
      successfulDocumentDeletions.forEach(id => dispatch(removeDocument(id)))
      setSelectedRowKeys([])

      const totalDeleted = successfulFolderDeletions.length + successfulDocumentDeletions.length
      if (totalDeleted > 0) {
        const parts: string[] = []
        if (successfulFolderDeletions.length > 0) {
          parts.push(`${successfulFolderDeletions.length} 个文件夹`)
        }
        if (successfulDocumentDeletions.length > 0) {
          parts.push(`${successfulDocumentDeletions.length} 个文档`)
        }
        message.success(`成功删除 ${parts.join('和')}`)
      }

      if (totalDeleted < selectedRowKeys.length) {
        message.warning('部分项目删除失败，请重试')
        // Refresh lists to show current state
        loadDocuments()
        loadCurrentFolderChildren()
      } else if (totalDeleted > 0) {
        // Refresh lists after successful deletion
        loadDocuments()
        loadCurrentFolderChildren()
      }
    } catch (error: any) {
      message.error('批量删除失败')
      // Refresh document list to show current state
      loadDocuments()
      loadCurrentFolderChildren()
    }
  }

  const handleDeleteFolder = async (folderId: number) => {
    try {
      const folder = folderMap[folderId]
      const result = await folderService.deleteFolder(folderId)
      message.success(`文件夹删除成功，删除了 ${result.deletedCount} 个文件`)

      setFolderMap(prev => {
        const next = { ...prev }
        delete next[folderId]
        return next
      })

      const parentId = folder?.parentId ?? null
      setFolderChildrenCache(prev => {
        const key = cacheKey(parentId)
        const siblings = prev[key]?.filter(item => item.id !== folderId) || []
        return { ...prev, [key]: siblings }
      })

      if (currentFolderId === folderId) {
        enterFolder(parentId)
      } else {
        loadCurrentFolderChildren()
      }
      await loadTreeBranch(parentId)
    } catch (error: any) {
      console.error('删除文件夹失败:', error)
      message.error(error.response?.data?.message || '删除文件夹失败')
    }
  }

  const renderTreeTitle = (node: FolderTreeNode) => {
    const folder = node.folder
    if (!folder) {
      return node.title
    }

    const canDeleteFolder = currentUser?.role === 'admin'

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
        {canDeleteFolder && (
          <Popconfirm
            title={`确认删除文件夹 "${folder.name}"？`}
            description="这将删除该文件夹及其所有内容，操作不可恢复。"
            onConfirm={(e?: React.MouseEvent) => {
              e?.stopPropagation?.()
              handleDeleteFolder(folder.id)
            }}
            onCancel={(e?: React.MouseEvent) => e?.stopPropagation?.()}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        )}
      </div>
    )
  }

  const startInlineCreateFolder = () => {
    setIsInlineCreatingFolder(true)
    setInlineFolderName('')
    setRenamingFolderId(null)
  }

  const cancelInlineCreateFolder = () => {
    setIsInlineCreatingFolder(false)
    setInlineFolderName('')
  }

  const submitInlineCreateFolder = async () => {
    const name = inlineFolderName.trim()
    if (!name) {
      message.warning('请输入文件夹名称')
      return
    }
    setInlineCreateLoading(true)
    try {
      await folderService.createFolder(name, currentFolderId ?? null)
      message.success('文件夹创建成功')
      setInlineFolderName('')
      setIsInlineCreatingFolder(false)
      await loadCurrentFolderChildren()
      await loadTreeBranch(currentFolderId ?? null)
    } catch (error: any) {
      console.error('创建文件夹失败:', error)
      message.error(error.response?.data?.message || '创建文件夹失败')
    } finally {
      setInlineCreateLoading(false)
    }
  }

  const startRenameFolder = (folder: FolderSummary) => {
    setRenamingFolderId(folder.id)
    setRenamingFolderName(folder.name)
    setIsInlineCreatingFolder(false)
  }

  const cancelRenameFolder = () => {
    setRenamingFolderId(null)
    setRenamingFolderName('')
  }

  const submitRenameFolder = async () => {
    if (!renamingFolderId) {
      return
    }
    const name = renamingFolderName.trim()
    if (!name) {
      message.warning('请输入文件夹名称')
      return
    }

    setRenameFolderLoading(true)
    try {
      const parentId = folderMap[renamingFolderId]?.parentId ?? null
      const result = await folderService.renameFolder(renamingFolderId, name)
      message.success(result.message || '文件夹重命名成功')
      setRenamingFolderId(null)
      setRenamingFolderName('')
      await loadCurrentFolderChildren()
      await loadTreeBranch(parentId)
    } catch (error: any) {
      console.error('重命名文件夹失败:', error)
      message.error(error.response?.data?.message || '重命名文件夹失败')
    } finally {
      setRenameFolderLoading(false)
    }
  }

  const openMoveFolderModal = (folder: FolderSummary) => {
    setMovingFolder(folder)
    setMoveTargetParentKey(folder.parentId !== null ? folder.parentId.toString() : 'root')
    setMoveFolderModalVisible(true)
    setIsInlineCreatingFolder(false)
    setRenamingFolderId(null)
  }

  const closeMoveFolderModal = () => {
    setMoveFolderModalVisible(false)
    setMovingFolder(null)
  }

  const submitMoveFolder = async () => {
    if (!movingFolder) {
      return
    }
    const targetParentId = moveTargetParentKey === 'root' ? null : Number(moveTargetParentKey)
    const previousParentId = movingFolder.parentId ?? null

    setMoveFolderLoading(true)
    try {
      const result = await folderService.moveFolder(movingFolder.id, targetParentId)
      message.success(result.message || '文件夹移动成功')
      closeMoveFolderModal()
      await loadCurrentFolderChildren()
      const parentsToRefresh = Array.from(new Set([previousParentId, targetParentId]))
      await Promise.all(parentsToRefresh.map(parentId => loadTreeBranch(parentId)))
    } catch (error: any) {
      console.error('移动文件夹失败:', error)
      message.error(error.response?.data?.message || '移动文件夹失败')
    } finally {
      setMoveFolderLoading(false)
    }
  }

  const handleViewAnnotationHistory = async (document: Document) => {
    setCurrentDocumentForHistory(document)
    setAnnotationHistoryModalVisible(true)
    setLoadingAnnotationHistory(true)
    
    try {
      const response = await annotationService.getDocumentAnnotationHistory(document.id)
      setAnnotationHistory(response.history || [])
    } catch (error: any) {
      console.error('Failed to load annotation history:', error)
      message.error('加载标注记录失败: ' + (error.response?.data?.message || error.message))
      setAnnotationHistory([])
    } finally {
      setLoadingAnnotationHistory(false)
    }
  }

  const handleViewAnnotation = async (document: Document) => {
    setLoadingAnnotations(true)
    setAnnotationModalVisible(true)
    setCurrentAnnotations([])
    try {
      // 1. Find tasks for document
      const tasksResult = await taskService.getTasks({ documentId: document.id, size: 100 })
      const tasks = tasksResult.tasks
      
      if (tasks.length === 0) {
        // No tasks found
      } else {
        // 2. Get annotations for all tasks
        const allAnnotations: Annotation[] = []
        for (const task of tasks) {
          try {
            const annotationsResult = await annotationService.getTaskAnnotations(task.id)
            allAnnotations.push(...annotationsResult.annotations)
          } catch (e) {
            console.error(`Failed to load annotations for task ${task.id}`, e)
          }
        }
        setCurrentAnnotations(allAnnotations)
      }
    } catch (error) {
      message.error('获取标注信息失败')
    } finally {
      setLoadingAnnotations(false)
    }
  }

  const handlePreviewSizeChange = (width: number, height: number) => {
    updatePreviewSize(width, height)
  }

  const handleEditDocumentType = (document: Document) => {
    setEditingDocument(document)
    setEditDocumentTypeVisible(true)
  }

  const handleEditPriority = (document: Document) => {
    setEditingDocument(document)
    setEditPriorityVisible(true)
  }

  const handleUpdatePriority = async (priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') => {
    if (!editingDocument) return

    try {
      await documentService.updateDocumentPriority(editingDocument.id, priority)
      message.success('优先级更新成功')

      // Update local state
      const updatedDocuments = documents.map(doc =>
        doc.id === editingDocument.id
          ? { ...doc, priority }
          : doc
      )
      dispatch(setDocuments({ ...pagination, documents: updatedDocuments }))

      setEditPriorityVisible(false)
      setEditingDocument(null)
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新优先级失败')
    }
  }

  const handleUpdateDocumentType = async (documentTypeId?: number) => {
    if (!editingDocument) return

    try {
      await documentService.updateDocumentType(editingDocument.id, documentTypeId)
      message.success('文档类型更新成功')

      // Update local state
      const updatedDocuments = documents.map(doc =>
        doc.id === editingDocument.id
          ? { ...doc, documentType: documentTypes.find(dt => dt.id === documentTypeId) }
          : doc
      )
      dispatch(setDocuments({ ...pagination, documents: updatedDocuments }))

      setEditDocumentTypeVisible(false)
      setEditingDocument(null)
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新文档类型失败')
    }
  }

  const handleViewTemplateFields = async (document: Document) => {
    if (!document.documentType) {
      message.warning('该文档未配置文档类型')
      return
    }

    try {
      // 获取文档类型关联的表单配置
      const formConfigsResult = await documentTypeService.getDocumentTypeFormConfigs(document.documentType.id)
      setSelectedFormConfigs(formConfigsResult.formConfigs)

      // 获取所有表单配置的字段
      const allFields: any[] = []
      for (const formConfig of formConfigsResult.formConfigs) {
        try {
          const fieldsResult = await formConfigService.getFormFields(formConfig.id)
          allFields.push(...fieldsResult.fields.map((field: any) => ({
            ...field,
            formConfigName: formConfig.name
          })))
        } catch (error) {
          console.error(`获取表单配置 ${formConfig.id} 的字段失败:`, error)
        }
      }

      setTemplateFields(allFields)
      setEditingDocument(document)
      setViewTemplateFieldsVisible(true)
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取模版字段失败')
    }
  }

  const handleFolderUpload = async (files: File[]) => {
    console.log('Processing folder upload with files:', files)

    if (!files || files.length === 0) {
      message.warning('未选择任何文件')
      return
    }

    // Prevent duplicate calls
    if (folderUploadInProgress.current) {
      console.warn('Folder upload already in progress, ignoring duplicate call')
      return
    }

    folderUploadInProgress.current = true
    setUploadingFolder(true)

    // Log all files found
    console.log(`Found ${files.length} files in folder:`)
    files.forEach((file, index) => {
      const relativePath = (file as any).webkitRelativePath || file.name
      console.log(`${index + 1}. ${relativePath} (${file.type || 'unknown type'}, ${file.size} bytes)`)
    })

    const supportedFiles = files.filter(file => {
      const isSupported = file.type === 'application/pdf' ||
                         file.type === 'image/jpeg' ||
                         file.type === 'image/jpg' ||
                         file.type === 'image/png'
      if (!isSupported) {
        console.log(`Skipping unsupported file: ${file.name} (${file.type})`)
      }
      return isSupported
    })

    console.log(`Found ${supportedFiles.length} supported files out of ${files.length} total files`)

    if (supportedFiles.length === 0) {
      message.warning(`所选文件夹中没有找到支持的文件（PDF、JPG、PNG）。共发现 ${files.length} 个文件，但都不支持。`)
      setUploadingFolder(false)
      return
    }

    const originalRootFolderName = getUploadRootFolderName(supportedFiles)

    // Create root folder once before processing files
    let uploadRootFolder: FolderSummary | null = null
    
    // Check if we already have a root folder for this upload session
    if (currentUploadRootFolder.current) {
      uploadRootFolder = currentUploadRootFolder.current
      console.log('Reusing root folder from current session:', uploadRootFolder.name, 'ID:', uploadRootFolder.id)
    } else {
      try {
        uploadRootFolder = await createUploadRootFolder(originalRootFolderName)
        currentUploadRootFolder.current = uploadRootFolder
        console.log('Created root folder:', uploadRootFolder.name, 'ID:', uploadRootFolder.id)
      } catch (error: any) {
        console.error('创建上传文件夹失败:', error)
        message.error(error.response?.data?.message || error.message || '创建上传文件夹失败')
        setUploadingFolder(false)
        folderUploadInProgress.current = false
        return
      }
    }

    const uploadBaseFolderId = uploadRootFolder.id

    message.info(`开始上传到「${uploadRootFolder.name}」的 ${supportedFiles.length} 个文件...（共发现 ${files.length} 个文件）`)

    // Process files sequentially to avoid race conditions in folder creation
    const uploadPromises = supportedFiles.map(async (file, index) => {
      try {
        const progressKey = `${file.name}_${index}`
        setUploadProgress(prev => ({ ...prev, [progressKey]: 0 }))

        // Extract folder path from webkitRelativePath
        const relativePath = (file as any).webkitRelativePath || file.name
        const folderPath = relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : ''
        
        // Normalize path: remove root folder name if present
        const normalizedPath = (() => {
          if (!folderPath) return ''
          const segments = folderPath.split('/').filter(Boolean)
          // Remove the root folder name from the path since we already created it
          if (segments.length > 0 && originalRootFolderName && segments[0] === originalRootFolderName) {
            segments.shift()
          }
          return segments.join('/')
        })()
        
        console.log(`File: ${file.name}, Original path: ${folderPath}, Normalized path: ${normalizedPath}`)
        
        // Ensure subfolder hierarchy exists (relative to the root folder we created)
        const targetFolderId = await ensureFolderHierarchy(normalizedPath, uploadBaseFolderId)

        const result = await documentService.uploadDocument(file, {
          folderId: targetFolderId ?? currentFolderId ?? undefined
        })

        // Check if file already exists (backend returns 200 with "文件已存在" message)
        if (result.message && result.message.includes('文件已存在')) {
          console.log(`文件 ${file.name} 已存在，跳过上传`)
          // Refresh document list to show existing files
          await loadDocuments()
          return { skipped: true, filename: file.name, reason: 'duplicate', document: result.document }
        }

        setUploadProgress(prev => ({ ...prev, [progressKey]: 100 }))
        if (result.document) {
          dispatch(addDocument(result.document))
        }

        return result
      } catch (error: any) {
        const errorMessage = error.response?.data?.message ||
                            error.response?.statusText ||
                            error.message ||
                            '未知错误'

        // Handle duplicate file case with better user feedback
        if (errorMessage && errorMessage.includes('文件已存在')) {
          console.log(`文件 ${file.name} 已存在，跳过上传`)
          await loadDocuments()
          return { skipped: true, filename: file.name, reason: 'duplicate' }
        } else {
          console.error(`上传文件 ${file.name} 失败:`, errorMessage)
          message.error(`上传文件 ${file.name} 失败: ${errorMessage}`)
          throw new Error(`上传文件 ${file.name} 失败: ${errorMessage}`) // Re-throw to make Promise rejected
        }
      }
    })

    try {
      const results = await Promise.allSettled(uploadPromises)

      // Debug: Log all results
      console.log('Upload results:', results)

      const successfulUploads = results.filter(result =>
        result.status === 'fulfilled' &&
        result.value !== null &&
        typeof result.value === 'object' &&
        'document' in result.value // Successful uploads have a 'document' property
      ).length

      const skippedUploads = results.filter(result =>
        result.status === 'fulfilled' &&
        result.value !== null &&
        typeof result.value === 'object' &&
        'skipped' in result.value &&
        result.value.skipped === true
      ).length

      const failedUploads = results.filter(result =>
        result.status === 'rejected'
      ).length

      let successMessage = ''
      if (successfulUploads > 0) {
        successMessage += `成功上传 ${successfulUploads} 个文件`
      }
      if (skippedUploads > 0) {
        successMessage += `${successMessage ? '，' : ''}跳过 ${skippedUploads} 个重复文件`
      }
      if (failedUploads > 0) {
        successMessage += `${successMessage ? '，' : ''}失败 ${failedUploads} 个`
      }

      if (successMessage) {
        if (failedUploads > 0) {
          message.warning(successMessage)
        } else {
          message.success(successMessage)
        }
      } else {
        message.warning('所有文件上传失败')
      }

      await loadCurrentFolderChildren()
      await loadTreeBranch(currentFolderId ?? null)
    } catch (error) {
      message.error('批量上传过程中出现错误')
    } finally {
      setUploadingFolder(false)
      setUploadProgress({})
      folderUploadInProgress.current = false
      currentUploadRootFolder.current = null // Clear session folder reference
    }
  }

  const handleDeleteFolderWrapper = (folder: Folder) => {
    handleDeleteFolder(folder.id)
  }

  const uploadProps = {
    beforeUpload: handleUpload,
    multiple: true,
    accept: '.pdf,.jpg,.jpeg,.png',
    showUploadList: false,
  }

  const folderUploadProps: UploadProps = {
    directory: true,
    multiple: true,
    accept: '.pdf,.jpg,.jpeg,.png',
    showUploadList: false,
    beforeUpload: (_file, _fileList) => {
      // Prevent default upload behavior, handle in custom function
      return false
    },
    onChange: (info) => {
      // Prevent duplicate processing
      if (folderUploadInProgress.current) {
        return
      }

      // Create a unique key for this file list based on file names and sizes
      const fileListKey = info.fileList
        .map(file => `${file.name}-${file.size || 0}`)
        .sort()
        .join('|')
      
      // Skip if we've already processed this exact file list
      if (processedFileLists.current.has(fileListKey)) {
        return
      }

      // Only process when we have files and they're all ready (not uploading)
      const hasFiles = info.fileList.length > 0
      const allFilesReady = info.fileList.every(file => 
        file.status === 'done' || file.status === 'removed' || !file.status
      )

      if (hasFiles && allFilesReady) {
        // Mark this file list as processed
        processedFileLists.current.add(fileListKey)
        
        console.log('Folder upload info:', info)
        console.log('File list:', info.fileList)

        // Get all files from the folder - use webkitRelativePath to identify folder structure
        const allFiles = info.fileList
          .map(item => item.originFileObj)
          .filter(Boolean) as File[]

        console.log('All files found:', allFiles.length)
        allFiles.forEach(file => {
          console.log('File:', file.name, 'Type:', file.type, 'Path:', (file as any).webkitRelativePath)
        })

        if (allFiles.length > 0) {
          handleFolderUpload(allFiles).finally(() => {
            // Clear the processed list after upload completes to allow re-upload
            setTimeout(() => {
              processedFileLists.current.delete(fileListKey)
            }, 1000)
          })
        } else {
          message.warning('未找到任何文件')
          processedFileLists.current.delete(fileListKey)
        }
      }
    },
  }

  const currentFolderName = currentFolderId
    ? folderMap[currentFolderId]?.name || '未知文件夹'
    : '根目录'

  const isSearchingTree = treeSearchValue.trim().length > 0

  const { filteredTreeData, searchExpandedKeys } = useMemo(() => {
    if (!isSearchingTree) {
      return { filteredTreeData: folderTreeData, searchExpandedKeys: [] as React.Key[] }
    }
    const lower = treeSearchValue.trim().toLowerCase()
    const filterNodes = (nodes: FolderTreeNode[]): { nodes: FolderTreeNode[]; keys: Set<React.Key> } => {
      const filtered: FolderTreeNode[] = []
      const keys = new Set<React.Key>()
      nodes.forEach(node => {
        const titleStr = (node.folder?.name ?? (typeof node.title === 'string' ? node.title : '')).toLowerCase()
        const childResult = node.children ? filterNodes(node.children) : { nodes: [], keys: new Set<React.Key>() }
        const match = titleStr.includes(lower)
        if (match || childResult.nodes.length > 0) {
          filtered.push({
            ...node,
            children: childResult.nodes
          })
          keys.add(node.key)
        }
        childResult.keys.forEach(key => keys.add(key))
      })
      return { nodes: filtered, keys }
    }
    const { nodes, keys } = filterNodes(folderTreeData)
    return { filteredTreeData: nodes, searchExpandedKeys: Array.from(keys) }
  }, [folderTreeData, treeSearchValue, isSearchingTree])

  const treeExpandedKeysToUse = isSearchingTree ? searchExpandedKeys : treeExpandedKeys

  const moveTreeSelectData = useMemo(() => {
    const disabledKey = movingFolder ? movingFolder.id.toString() : null
    const buildNodes = (nodes: FolderTreeNode[]): any[] =>
      nodes.map(node => ({
        title: node.folder?.name || node.title,
        value: node.key,
        key: node.key,
        disabled: node.key === disabledKey,
        children: node.children ? buildNodes(node.children) : undefined
      }))

    return [
      {
        title: '根目录',
        value: 'root',
        key: 'root',
        disabled: false
      },
      ...buildNodes(folderTreeData)
    ]
  }, [folderTreeData, movingFolder])

  // Initialize navigation history on mount
  useEffect(() => {
    if (navigationHistory.length === 0) {
      setNavigationHistory([null])
      setHistoryIndex(0)
    }
  }, [])

  const handlePreview = (document: Document) => {
    openPreview(document)
  }

  const handleDownload = async (document: Document) => {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = document.filename
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      message.error('下载失败')
    }
  }

  const handleDeleteDocument = async (document: Document) => {
    try {
      await documentService.deleteDocument(document.id)
      dispatch(removeDocument(document.id))
      message.success('文档删除成功')
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败')
    }
  }

  const handleBatchCreateTasks = () => {
    // Check if there are any folder selections that might still be loading
    const folderKeys = selectedRowKeys.filter(key => {
      const keyStr = String(key)
      return keyStr.startsWith('folder-')
    })

    // Extract document IDs from selected keys (only files, not folders)
    const documentIds = selectedRowKeys
      .filter(key => {
        const keyStr = String(key)
        return keyStr.startsWith('file-')
      })
      .map(key => {
        const keyStr = String(key)
        return parseInt(keyStr.replace('file-', ''), 10)
      })
      .filter(id => !isNaN(id))

    if (documentIds.length === 0) {
      if (folderKeys.length > 0) {
        message.warning('已选择文件夹，但文件夹中可能没有文件，或者文件夹内容还在加载中。请稍候再试，或直接选择文件。')
      } else {
        message.warning('请至少选择一个文件')
      }
      return
    }

    // Generate default batch name based on current date and file count
    const defaultName = `标注任务批次 - ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} (${documentIds.length}个文件)`
    setBatchTaskName(defaultName)
    setBatchCreateTasksVisible(true)
  }

  const handleBatchCreateTasksSubmit = async () => {
    // Validate batch name
    if (!batchTaskName || batchTaskName.trim().length === 0) {
      message.warning('请输入任务批次名称')
      return
    }

    // Extract document IDs from selected keys (only files, not folders)
    const documentIds = selectedRowKeys
      .filter(key => {
        const keyStr = String(key)
        return keyStr.startsWith('file-')
      })
      .map(key => {
        const keyStr = String(key)
        return parseInt(keyStr.replace('file-', ''), 10)
      })
      .filter(id => !isNaN(id))

    if (documentIds.length === 0) {
      message.warning('请至少选择一个文件。如果选择了文件夹，请等待文件夹内容加载完成后再创建任务。')
      return
    }

    setBatchCreateTasksLoading(true)

    try {
      // Get category from first document if available
      // Try to find in current documents first, if not found, fetch from API
      let firstDocument = documents.find(d => documentIds.includes(d.id))
      let categoryId: number | undefined = firstDocument?.category?.id

      // If document not found in current page, try to fetch it by ID
      if (!firstDocument && documentIds.length > 0) {
        try {
          firstDocument = await documentService.getDocument(documentIds[0])
          categoryId = firstDocument?.category?.id
        } catch (error) {
          console.warn('Failed to fetch document for category, proceeding without category:', error)
          // Continue without category - it's optional
        }
      }

      // Use batch API to create tasks
      const result = await taskService.createBatchTasks({
        batchName: batchTaskName.trim(),
        documentIds,
        categoryId: categoryId
      })

      // Show result message
      let resultMessage = ''
      const parts: string[] = []
      
      if (result.successCount > 0) {
        parts.push(`成功创建 ${result.successCount} 个任务`)
      }
      if (result.skipCount > 0) {
        parts.push(`跳过 ${result.skipCount} 个已有任务的文档`)
      }
      if (result.failCount > 0) {
        parts.push(`失败 ${result.failCount} 个`)
      }
      
      resultMessage = parts.join('，')
      
      if (result.successCount > 0 && result.failCount === 0) {
        if (result.skipCount > 0) {
          message.warning(resultMessage)
        } else {
          message.success(`任务"${result.batchName}"创建成功，包含 ${result.successCount} 个文件`)
          setBatchCreateTasksVisible(false)
          setBatchTaskName('')
          setSelectedRowKeys([])
        }
      } else if (result.successCount > 0) {
        message.warning(resultMessage)
        if (result.errors && result.errors.length > 0) {
          console.error('创建任务失败详情:', result.errors)
        }
      } else if (result.skipCount > 0 && result.failCount === 0) {
        message.info(resultMessage)
      } else {
        message.error(resultMessage)
        if (result.errors && result.errors.length > 0) {
          console.error('创建任务失败详情:', result.errors)
          // Show detailed error messages
          const errorDetails = result.errors.map((err: string, idx: number) => `${idx + 1}. ${err}`).join('\n')
          Modal.error({
            title: '批量创建任务失败',
            content: (
              <div>
                <p>{resultMessage}</p>
                <div style={{ marginTop: 16, maxHeight: 300, overflow: 'auto' }}>
                  <strong>错误详情：</strong>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{errorDetails}</pre>
                </div>
              </div>
            ),
            width: 600
          })
        }
      }
    } catch (error: any) {
      console.error('批量创建任务失败:', error)
      message.error(error.response?.data?.message || '批量创建任务失败')
    } finally {
      setBatchCreateTasksLoading(false)
    }
  }

  const handleBatchCreateTasksCancel = () => {
    setBatchCreateTasksVisible(false)
  }

  // Recursively get all documents and subfolders in a folder
  const getAllFolderContents = async (folderId: number): Promise<{
    documentKeys: string[]
    folderKeys: string[]
  }> => {
    const documentKeys: string[] = []
    const folderKeys: string[] = []
    const processedFolders = new Set<number>()

    const processFolder = async (folderId: number) => {
      if (processedFolders.has(folderId)) {
        return // Avoid infinite loops
      }
      processedFolders.add(folderId)

      try {
        // Get all documents in this folder (need to fetch all pages)
        let page = 0
        let hasMore = true
        while (hasMore) {
          const result = await documentService.getDocuments({
            page,
            size: 100, // Large page size to reduce API calls
            folderId,
            root: false
          })
          
          result.documents.forEach(doc => {
            documentKeys.push(`file-${doc.id}`)
          })

          hasMore = result.currentPage < result.totalPages - 1
          page++
        }

        // Get all subfolders
        const foldersResult = await folderService.getFolders(folderId)
        foldersResult.folders.forEach(folder => {
          folderKeys.push(`folder-${folder.id}`)
        })

        // Recursively process subfolders
        for (const folder of foldersResult.folders) {
          await processFolder(folder.id)
        }
      } catch (error) {
        console.error(`Error processing folder ${folderId}:`, error)
      }
    }

    await processFolder(folderId)
    return { documentKeys, folderKeys }
  }

  // Handle selection with folder expansion
  const handleSelect = async (keys: React.Key[]) => {
    const newKeys = new Set(keys)
    const previousKeys = new Set(selectedRowKeys)

    // Find newly selected folders
    const newlySelectedFolders: number[] = []
    keys.forEach(key => {
      const keyStr = String(key)
      if (keyStr.startsWith('folder-') && !previousKeys.has(key)) {
        const folderId = parseInt(keyStr.replace('folder-', ''), 10)
        if (!isNaN(folderId)) {
          newlySelectedFolders.push(folderId)
        }
      }
    })

    // Find newly deselected folders
    const newlyDeselectedFolders: number[] = []
    previousKeys.forEach(key => {
      const keyStr = String(key)
      if (keyStr.startsWith('folder-') && !newKeys.has(key)) {
        const folderId = parseInt(keyStr.replace('folder-', ''), 10)
        if (!isNaN(folderId)) {
          newlyDeselectedFolders.push(folderId)
        }
      }
    })

    // If folders were selected, add all their contents
    if (newlySelectedFolders.length > 0) {
      // Show loading message if multiple folders or large operation
      const hideLoading = newlySelectedFolders.length > 1 
        ? message.loading('正在获取文件夹内容...', 0)
        : null

      try {
        for (const folderId of newlySelectedFolders) {
          try {
            const contents = await getAllFolderContents(folderId)
            contents.documentKeys.forEach(key => newKeys.add(key))
            contents.folderKeys.forEach(key => newKeys.add(key))
          } catch (error) {
            console.error(`Error getting contents for folder ${folderId}:`, error)
            message.warning(`获取文件夹内容失败: ${folderId}`)
          }
        }
      } finally {
        if (hideLoading) {
          hideLoading()
        }
      }
    }

    // If folders were deselected, remove all their contents
    if (newlyDeselectedFolders.length > 0) {
      for (const folderId of newlyDeselectedFolders) {
        try {
          const contents = await getAllFolderContents(folderId)
          contents.documentKeys.forEach(key => newKeys.delete(key))
          contents.folderKeys.forEach(key => newKeys.delete(key))
        } catch (error) {
          console.error(`Error getting contents for folder ${folderId}:`, error)
        }
      }
    }

    setSelectedRowKeys(Array.from(newKeys))
  }

  const totalSize = useMemo(() => {
    return documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0)
  }, [documents])

  return (
    <Layout style={{ height: 'calc(100vh - 112px)', background: '#fff' }}>
      {/* Left Sidebar */}
      <Sider
        width={280}
        style={{
          background: '#fff',
          borderRight: '1px solid #e8e8e8',
          overflow: 'auto'
        }}
      >
        <QuickAccessPanel
          onNavigate={enterFolder}
        />
        <div style={{ borderTop: '1px solid #e8e8e8', marginTop: 8 }}>
          <FolderTreePanel
            treeData={filteredTreeData}
            selectedKeys={selectedTreeKeys}
            expandedKeys={treeExpandedKeysToUse}
            autoExpandParent={isSearchingTree}
            onSelect={handleTreeSelect}
            onExpand={handleTreeExpand}
            onLoadData={handleTreeLoadData}
            onRefresh={() => loadTreeBranch(currentFolderId ?? null)}
            searchValue={treeSearchValue}
            onSearchChange={setTreeSearchValue}
            isSearching={isSearchingTree}
            titleRender={renderTreeTitle}
          />
        </div>
      </Sider>

      {/* Main Content */}
      <Layout style={{ background: '#fff' }}>
        {/* Toolbar */}
        <FileExplorerToolbar
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < navigationHistory.length - 1}
          canGoUp={Boolean(currentFolderId)}
          onGoBack={goBack}
          onGoForward={goForward}
          onGoUp={goToParentFolder}
          onRefresh={() => {
            loadDocuments()
            loadCurrentFolderChildren()
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCreateFolder={startInlineCreateFolder}
          uploadProps={uploadProps}
          folderUploadProps={folderUploadProps}
          uploadingFolder={uploadingFolder}
          enableBatchDelete={currentUser?.role === 'admin'}
          selectedCount={selectedRowKeys.length}
          onBatchDelete={handleBatchDelete}
          onBatchCreateTasks={handleBatchCreateTasks}
          onSearch={(value) => {
            setSearchVisible(true)
            setSearchValue(value)
          }}
        />

        {/* Address Bar */}
        <FileExplorerAddressBar
          items={folderBreadcrumb.map(folder => ({
            id: folder.id,
            name: folder.name
          }))}
          onNavigate={enterFolder}
        />

        {/* File View */}
        <Content style={{ overflow: 'auto', background: '#fff' }}>
          <FileExplorerView
            viewMode={viewMode}
            folders={folders}
            documents={documents}
            selectedKeys={selectedRowKeys}
            onSelect={handleSelect}
            onEnterFolder={enterFolder}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onEditDocumentType={handleEditDocumentType}
            onEditPriority={handleEditPriority}
            onViewTemplateFields={handleViewTemplateFields}
            onViewAnnotation={handleViewAnnotationHistory}
            onDelete={handleDeleteDocument}
            onDeleteFolder={currentUser?.role === 'admin' ? handleDeleteFolderWrapper : undefined}
            canDelete={currentUser?.role === 'admin'}
            loading={loading}
          />
        </Content>

        {/* Status Bar */}
        <FileExplorerStatusBar
          totalItems={folders.length + documents.length}
          selectedCount={selectedRowKeys.length}
          totalSize={totalSize}
          folderCount={folders.length}
          fileCount={documents.length}
        />
      </Layout>

      {/* File Preview Modal */}
      <Modal
        title={
          <div>
            <FileTextOutlined style={{ marginRight: 8 }} />
            {previewDocument?.filename}
          </div>
        }
        open={previewVisible}
        onCancel={closePreview}
        width={previewModalSize.width}
        style={{ top: 20 }}
        styles={{ body: { height: previewModalSize.height - 110, padding: 0 } }} // Adjust for modal header
        footer={null}
        destroyOnHidden
      >
        {previewDocument && (
          <FileViewer
            url={`/api/documents/${previewDocument.id}/download`}
            width={previewModalSize.width - 48} // Account for modal padding
            height={previewModalSize.height - 160} // Account for modal header and padding
            onSizeChange={handlePreviewSizeChange}
          />
        )}
      </Modal>

      <Modal
        title="移动文件夹"
        open={moveFolderModalVisible}
        onCancel={closeMoveFolderModal}
        onOk={submitMoveFolder}
        okText="移动"
        confirmLoading={moveFolderLoading}
      >
        <div style={{ marginBottom: 12 }}>
          将 <Tag color="blue">{movingFolder?.name}</Tag> 移动到：
        </div>
        <TreeSelect
          style={{ width: '100%' }}
          value={moveTargetParentKey}
          treeData={moveTreeSelectData}
          placeholder="选择目标文件夹"
          onChange={(value) => {
            if (!value) {
              setMoveTargetParentKey('root')
            } else {
              setMoveTargetParentKey(value as string)
            }
          }}
          treeDefaultExpandAll
          showSearch
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          根目录代表最顶层。无法将文件夹移动到自身或其子目录。
        </div>
      </Modal>

      {/* Edit Document Type Modal */}
      <Modal
        title={
          <div>
            <EditOutlined style={{ marginRight: 8 }} />
            编辑文档类型
          </div>
        }
        open={editDocumentTypeVisible}
        onCancel={() => {
          setEditDocumentTypeVisible(false)
          setEditingDocument(null)
        }}
        onOk={() => handleUpdateDocumentType(editingDocument?.documentType?.id)}
        width={500}
        destroyOnHidden
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <strong>文档：</strong>{editingDocument?.filename}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>当前文档类型：</strong>
            <Tag color="green">
              {editingDocument?.documentType?.name || '未配置'}
            </Tag>
          </div>
          <Select
            placeholder="选择文档类型"
            style={{ width: '100%' }}
            allowClear
            value={editingDocument?.documentType?.id}
            onChange={(value) => {
              if (editingDocument) {
                setEditingDocument({
                  ...editingDocument,
                  documentType: value ? documentTypes.find(dt => dt.id === value) : undefined
                })
              }
            }}
          >
            {documentTypes.map(docType => (
              <Option key={docType.id} value={docType.id}>
                {docType.name}
              </Option>
            ))}
          </Select>
          {editingDocument?.documentType && (
            <div style={{ marginTop: 16 }}>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => {
                  setEditDocumentTypeVisible(false)
                  handleViewTemplateFields(editingDocument)
                }}
              >
                查看模版字段
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Priority Modal */}
      <Modal
        title={
          <div>
            <EditOutlined style={{ marginRight: 8 }} />
            编辑优先级
          </div>
        }
        open={editPriorityVisible}
        onCancel={() => {
          setEditPriorityVisible(false)
          setEditingDocument(null)
        }}
        onOk={() => {
          if (editingDocument?.priority) {
            handleUpdatePriority(editingDocument.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT')
          }
        }}
        width={500}
        destroyOnHidden
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <strong>文档：</strong>{editingDocument?.filename}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>当前优先级：</strong>
            <Tag color={
              editingDocument?.priority === 'LOW' ? 'default' :
              editingDocument?.priority === 'NORMAL' ? 'blue' :
              editingDocument?.priority === 'HIGH' ? 'orange' :
              editingDocument?.priority === 'URGENT' ? 'red' : 'blue'
            }>
              {editingDocument?.priority === 'LOW' ? '低' :
               editingDocument?.priority === 'NORMAL' ? '普通' :
               editingDocument?.priority === 'HIGH' ? '高' :
               editingDocument?.priority === 'URGENT' ? '紧急' : '普通'}
            </Tag>
          </div>
          <Select
            placeholder="选择优先级"
            style={{ width: '100%' }}
            value={editingDocument?.priority || 'NORMAL'}
            onChange={(value) => {
              if (editingDocument) {
                setEditingDocument({
                  ...editingDocument,
                  priority: value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
                })
              }
            }}
          >
            <Option value="LOW">
              <Tag color="default">低</Tag>
            </Option>
            <Option value="NORMAL">
              <Tag color="blue">普通</Tag>
            </Option>
            <Option value="HIGH">
              <Tag color="orange">高</Tag>
            </Option>
            <Option value="URGENT">
              <Tag color="red">紧急</Tag>
            </Option>
          </Select>
        </div>
      </Modal>

      {/* View Template Fields Modal */}
      <Modal
        title={
          <div>
            <EyeOutlined style={{ marginRight: 8 }} />
            查看模版字段 - {editingDocument?.documentType?.name}
          </div>
        }
        open={viewTemplateFieldsVisible}
        onCancel={() => {
          setViewTemplateFieldsVisible(false)
          setEditingDocument(null)
          setTemplateFields([])
          setSelectedFormConfigs([])
        }}
        footer={[
          <Button key="close" onClick={() => {
            setViewTemplateFieldsVisible(false)
            setEditingDocument(null)
            setTemplateFields([])
            setSelectedFormConfigs([])
          }}>
            关闭
          </Button>
        ]}
        width={800}
        destroyOnHidden
      >
        <div style={{ padding: '16px 0' }}>
          <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="文档">{editingDocument?.filename}</Descriptions.Item>
            <Descriptions.Item label="文档类型">{editingDocument?.documentType?.name}</Descriptions.Item>
            <Descriptions.Item label="关联表单配置">
              {selectedFormConfigs.length > 0 ? (
                selectedFormConfigs.map(fc => (
                  <Tag key={fc.id} color="blue" style={{ marginRight: 8, marginBottom: 4 }}>
                    {fc.name}
                  </Tag>
                ))
              ) : (
                <span style={{ color: '#999' }}>无关联表单配置</span>
              )}
            </Descriptions.Item>
          </Descriptions>

          {templateFields.length > 0 ? (
            <Table
              dataSource={templateFields}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: '表单配置',
                  dataIndex: 'formConfigName',
                  key: 'formConfigName',
                  width: 150,
                },
                {
                  title: '字段名称',
                  dataIndex: 'fieldName',
                  key: 'fieldName',
                  width: 150,
                },
                {
                  title: '字段标签',
                  dataIndex: 'label',
                  key: 'label',
                  width: 150,
                },
                {
                  title: '字段类型',
                  dataIndex: 'fieldType',
                  key: 'fieldType',
                  width: 120,
                  render: (type: string) => {
                    const typeMap: Record<string, string> = {
                      TEXT: '文本',
                      NUMBER: '数字',
                      DATE: '日期',
                      SELECT: '单选',
                      MULTI_SELECT: '多选',
                      BOOLEAN: '布尔值'
                    }
                    return typeMap[type] || type
                  }
                },
                {
                  title: '是否必填',
                  dataIndex: 'required',
                  key: 'required',
                  width: 100,
                  render: (required: boolean) => (
                    <Tag color={required ? 'red' : 'default'}>
                      {required ? '是' : '否'}
                    </Tag>
                  )
                },
                {
                  title: '占位符',
                  dataIndex: 'placeholder',
                  key: 'placeholder',
                  ellipsis: true,
                },
              ]}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              该文档类型暂无模版字段
            </div>
          )}
        </div>
      </Modal>

      {/* Batch Create Tasks Modal */}
      <Modal
        title="批量生成标注任务"
        open={batchCreateTasksVisible}
        onCancel={() => {
          setBatchCreateTasksVisible(false)
          setBatchTaskName('')
        }}
        onOk={handleBatchCreateTasksSubmit}
        okText="创建"
        cancelText="取消"
        confirmLoading={batchCreateTasksLoading}
        width={500}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16, fontSize: 16 }}>
            <strong>创建标注任务批次</strong>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>任务批次名称：</strong>
            </div>
            <Input
              placeholder="请输入任务批次名称"
              value={batchTaskName}
              onChange={(e) => setBatchTaskName(e.target.value)}
              maxLength={200}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>已选择文件数量：</strong>
            <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px', marginLeft: 8 }}>
              {selectedRowKeys.filter(key => String(key).startsWith('file-')).length} 个文件
            </Tag>
          </div>
          <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: 14, color: '#666' }}>
            <div style={{ marginBottom: 8 }}>提示：</div>
            <div>• 所有选中的文件将作为一个批次进行管理</div>
            <div>• 文档类型和表单配置可在后续的标注任务中进行配置</div>
            <div>• 系统将为每个选中的文件创建一个标注任务，这些任务属于同一个批次</div>
          </div>
        </div>
      </Modal>
      {/* Annotation Modal */}
      <Modal
        title="标注信息"
        open={annotationModalVisible}
        onCancel={() => setAnnotationModalVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          loading={loadingAnnotations}
          dataSource={currentAnnotations}
          rowKey="id"
          columns={[
            { title: '任务ID', dataIndex: 'taskId', key: 'taskId', width: 80 },
            { 
              title: '版本', 
              dataIndex: 'version', 
              key: 'version', 
              width: 80,
              render: (v: number) => <Tag>v{v}</Tag> 
            },
            { 
              title: '状态', 
              dataIndex: 'status', 
              key: 'status',
              width: 100,
              render: (status: string) => {
                const color = status === 'APPROVED' ? 'green' : status === 'REJECTED' ? 'red' : 'blue'
                return <Tag color={color}>{status}</Tag>
              }
            },
            { 
              title: '提交时间', 
              dataIndex: 'submittedAt', 
              key: 'submittedAt',
              width: 180,
              render: (t: string) => t ? new Date(t).toLocaleString() : '-' 
            },
            { 
              title: '标注内容', 
              dataIndex: 'annotationData', 
              key: 'data',
              render: (d: string) => {
                try {
                  const obj = JSON.parse(d || '{}')
                  return (
                    <pre style={{ maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
                      {JSON.stringify(obj, null, 2)}
                    </pre>
                  )
                } catch (e) {
                  return d
                }
              } 
            }
          ]}
          locale={{ emptyText: '暂无标注记录' }}
        />
      </Modal>

      {/* Annotation History Modal */}
      <Modal
        title={`标注记录 - ${currentDocumentForHistory?.filename || ''}`}
        open={annotationHistoryModalVisible}
        onCancel={() => {
          setAnnotationHistoryModalVisible(false)
          setCurrentDocumentForHistory(null)
          setAnnotationHistory([])
        }}
        footer={null}
        width={1000}
      >
        <Table
          loading={loadingAnnotationHistory}
          dataSource={annotationHistory}
          rowKey={(record) => `${record.task.id}-${record.fieldName}-${record.version}-${record.createdAt}-${record.id}`}
          pagination={{ pageSize: 20 }}
          scroll={{ y: 500 }}
          columns={[
            {
              title: '任务',
              key: 'task',
              width: 150,
              render: (_: any, record: typeof annotationHistory[0]) => (
                <div>
                  <div style={{ fontWeight: 500 }}>#{record.task.id}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{record.task.title}</div>
                </div>
              )
            },
            {
              title: '字段',
              key: 'field',
              width: 150,
              render: (_: any, record: typeof annotationHistory[0]) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{record.fieldLabel || record.fieldName}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{record.fieldName}</div>
                </div>
              )
            },
            {
              title: '操作类型',
              dataIndex: 'actionType',
              key: 'actionType',
              width: 100,
              render: (type: string) => {
                const typeMap: Record<string, { color: string; text: string }> = {
                  CREATE: { color: 'green', text: '创建' },
                  UPDATE: { color: 'blue', text: '更新' },
                  DELETE: { color: 'red', text: '删除' }
                }
                const info = typeMap[type] || { color: 'default', text: type }
                return <Tag color={info.color}>{info.text}</Tag>
              }
            },
            {
              title: '旧值',
              dataIndex: 'oldValue',
              key: 'oldValue',
              width: 200,
              ellipsis: true,
              render: (value: string) => value || <span style={{ color: '#999' }}>-</span>
            },
            {
              title: '新值',
              dataIndex: 'newValue',
              key: 'newValue',
              width: 200,
              ellipsis: true
            },
            {
              title: '标注人',
              key: 'user',
              width: 120,
              render: (_: any, record: typeof annotationHistory[0]) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{record.user.username}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>ID: {record.user.id}</div>
                </div>
              )
            },
            {
              title: '版本',
              dataIndex: 'version',
              key: 'version',
              width: 80,
              render: (v: number) => <Tag>v{v}</Tag>
            },
            {
              title: '时间',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 180,
              render: (date: string) => new Date(date).toLocaleString('zh-CN')
            }
          ]}
          locale={{ emptyText: '暂无标注记录' }}
        />
      </Modal>
    </Layout>
  )
}

export default FileManagement

