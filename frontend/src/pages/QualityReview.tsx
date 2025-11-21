import { useState, useEffect } from 'react'
import { Card, Button, Modal, Form, Input, message, Space, Tag, Descriptions, Row, Col, Tree, Spin, Badge, Select } from 'antd'
import { FileOutlined, FolderOutlined, ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { folderService, documentService, annotationService, taskService, Folder, Document, FormConfig, formConfigService } from '../services/api'
import type { DataNode } from 'antd/es/tree'

const { TextArea } = Input
const { Option } = Select

interface TreeNode extends DataNode {
  key: string
  title: React.ReactNode
  isLeaf?: boolean
  children?: TreeNode[]
  folder?: Folder
  document?: Document
  conflictCount?: number
}

const QualityReview = () => {
  const { currentUser } = useSelector((state: RootState) => state.user)

  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedArchive, setSelectedArchive] = useState<any>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)
  const [archiveModalVisible, setArchiveModalVisible] = useState(false)
  const [createTaskModalVisible, setCreateTaskModalVisible] = useState(false)
  const [createTaskForm] = Form.useForm()
  const [formConfigs, setFormConfigs] = useState<FormConfig[]>([])
  const [conflictMap, setConflictMap] = useState<Record<number, number>>({})

  useEffect(() => {
    loadFolderTree()
    loadFormConfigs()
  }, [])

  const loadFormConfigs = async () => {
    try {
      const response = await formConfigService.getFormConfigs({ activeOnly: true })
      setFormConfigs(response.formConfigs || [])
    } catch (error) {
      console.error('Failed to load form configs:', error)
    }
  }

  const loadFolderTree = async () => {
    try {
      setLoading(true)
      const rootFolders = await folderService.getFolders()
      const rootDocuments = await documentService.getDocuments({ root: true, size: 1000 })
      
      const treeNodes: TreeNode[] = []
      
      // 添加根文件夹
      for (const folder of rootFolders.folders) {
        const node = await buildFolderNode(folder)
        treeNodes.push(node)
      }
      
      // 添加根文档
      for (const doc of rootDocuments.documents) {
        const conflictCount = await getDocumentConflictCount(doc.id)
        treeNodes.push({
          key: `doc-${doc.id}`,
          title: (
            <span>
              <FileOutlined /> {doc.originalFilename}
              {conflictCount > 0 && (
                <Badge count={conflictCount} style={{ marginLeft: 8 }} />
              )}
            </span>
          ),
          isLeaf: true,
          document: doc,
          conflictCount
        })
      }
      
      setTreeData(treeNodes)
      
      // 加载所有文档的冲突数量
      const allDocIds = getAllDocumentIds(treeNodes)
      if (allDocIds.length > 0) {
        loadBatchConflicts(allDocIds)
      }
    } catch (error) {
      console.error('Failed to load folder tree:', error)
      message.error('加载文件夹结构失败')
    } finally {
      setLoading(false)
    }
  }

  const getAllDocumentIds = (nodes: TreeNode[]): number[] => {
    const ids: number[] = []
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.document) {
          ids.push(node.document.id)
        }
        if (node.children) {
          traverse(node.children)
        }
      }
    }
    traverse(nodes)
    return ids
  }

  const loadBatchConflicts = async (documentIds: number[]) => {
    try {
      const response = await annotationService.getBatchDocumentConflicts(documentIds)
      setConflictMap(response.conflicts)
      // 更新树节点中的冲突数量
      updateTreeConflictCounts(response.conflicts)
    } catch (error) {
      console.error('Failed to load batch conflicts:', error)
    }
  }

  const updateTreeConflictCounts = (conflicts: Record<number, number>) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        const updated: TreeNode = { ...node }
        if (node.document && conflicts[node.document.id] !== undefined) {
          updated.conflictCount = conflicts[node.document.id]
          updated.title = (
            <span>
              <FileOutlined /> {node.document.originalFilename}
              {conflicts[node.document.id] > 0 && (
                <Badge count={conflicts[node.document.id]} style={{ marginLeft: 8 }} />
              )}
            </span>
          )
        }
        if (node.children) {
          updated.children = updateNode(node.children)
          // 计算文件夹的冲突总数
          const folderConflictCount = calculateFolderConflictCount(updated.children, conflicts)
          if (folderConflictCount > 0) {
            updated.conflictCount = folderConflictCount
            updated.title = (
              <span>
                <FolderOutlined /> {node.folder?.name}
                <Badge count={folderConflictCount} style={{ marginLeft: 8 }} />
              </span>
            )
          }
        }
        return updated
      })
    }
    setTreeData(prev => updateNode(prev))
  }

  const calculateFolderConflictCount = (children: TreeNode[], conflicts: Record<number, number>): number => {
    let total = 0
    for (const child of children) {
      if (child.document && conflicts[child.document.id]) {
        total += conflicts[child.document.id]
      }
      if (child.children) {
        total += calculateFolderConflictCount(child.children, conflicts)
      }
    }
    return total
  }

  const getDocumentConflictCount = async (documentId: number): Promise<number> => {
    try {
      const response = await annotationService.getDocumentConflicts(documentId)
      return response.conflictCount
    } catch (error) {
      console.error('Failed to get document conflicts:', error)
      return 0
    }
  }

  const buildFolderNode = async (folder: Folder): Promise<TreeNode> => {
    const children: TreeNode[] = []
    
    // 加载子文件夹
    const childFolders = await folderService.getFolders(folder.id)
    for (const childFolder of childFolders.folders) {
      children.push(await buildFolderNode(childFolder))
    }
    
    // 加载文件夹中的文档
    const documents = await documentService.getDocuments({ folderId: folder.id, size: 1000 })
    for (const doc of documents.documents) {
      const conflictCount = await getDocumentConflictCount(doc.id)
      children.push({
        key: `doc-${doc.id}`,
        title: (
          <span>
            <FileOutlined /> {doc.originalFilename}
            {conflictCount > 0 && (
              <Badge count={conflictCount} style={{ marginLeft: 8 }} />
            )}
          </span>
        ),
        isLeaf: true,
        document: doc,
        conflictCount
      })
    }
    
    // 计算文件夹的冲突总数
    const folderConflictCount = children.reduce((sum, child) => {
      if (child.document && child.conflictCount) {
        return sum + child.conflictCount
      }
      if (child.conflictCount) {
        return sum + child.conflictCount
      }
      return sum
    }, 0)
    
    return {
      key: `folder-${folder.id}`,
      title: (
        <span>
          <FolderOutlined /> {folder.name}
          {folderConflictCount > 0 && (
            <Badge count={folderConflictCount} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
      isLeaf: false,
      folder,
      conflictCount: folderConflictCount,
      children: children.length > 0 ? children : undefined
    }
  }

  const onLoadData = async ({ key, children }: any) => {
    if (children) {
      return Promise.resolve()
    }

    const folderId = parseInt(key.toString().replace('folder-', ''))
    if (isNaN(folderId)) {
      return Promise.resolve()
    }

    try {
      const childFolders = await folderService.getFolders(folderId)
      const documents = await documentService.getDocuments({ folderId, size: 1000 })
      
      const newChildren: TreeNode[] = []
      
      for (const folder of childFolders.folders) {
        newChildren.push(await buildFolderNode(folder))
      }
      
      for (const doc of documents.documents) {
        const conflictCount = await getDocumentConflictCount(doc.id)
        newChildren.push({
          key: `doc-${doc.id}`,
          title: (
            <span>
              <FileOutlined /> {doc.originalFilename}
              {conflictCount > 0 && (
                <Badge count={conflictCount} style={{ marginLeft: 8 }} />
              )}
            </span>
          ),
          isLeaf: true,
          document: doc,
          conflictCount
        })
      }

      const updateTreeData = (list: TreeNode[], nodeKey: React.Key, children: TreeNode[]): TreeNode[] => {
        return list.map(node => {
          if (node.key === nodeKey) {
            return { ...node, children }
          }
          if (node.children) {
            return { ...node, children: updateTreeData(node.children, nodeKey, children) }
          }
          return node
        })
      }

      setTreeData(prev => updateTreeData(prev, key, newChildren))
    } catch (error) {
      console.error('Failed to load folder children:', error)
      message.error('加载子节点失败')
    }
  }

  const handleSelect = async (selectedKeys: React.Key[]) => {
    setSelectedKeys(selectedKeys)
    
    if (selectedKeys.length === 0) {
      return
    }

    const key = selectedKeys[0].toString()
    if (key.startsWith('doc-')) {
      const documentId = parseInt(key.replace('doc-', ''))
      if (!isNaN(documentId)) {
        await loadDocumentArchive(documentId)
      }
    }
  }

  const loadDocumentArchive = async (documentId: number) => {
    try {
      setLoading(true)
      const response = await annotationService.getDocumentArchive(documentId)
      if (response.hasArchive) {
        setSelectedArchive(response.archive)
        setSelectedDocumentId(documentId)
        setArchiveModalVisible(true)
      } else {
        message.info('该文档暂无标注档案')
      }
    } catch (error) {
      console.error('Failed to load document archive:', error)
      message.error('加载标注档案失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReviewTasks = () => {
    if (selectedKeys.length === 0) {
      message.warning('请至少选择一个文档或文件夹')
      return
    }

    const selectedDocumentIds = getSelectedDocumentIds(selectedKeys, treeData)
    if (selectedDocumentIds.length === 0) {
      message.warning('选中的项目中没有文档')
      return
    }

    setCreateTaskModalVisible(true)
    createTaskForm.resetFields()
  }

  const getSelectedDocumentIds = (keys: React.Key[], nodes: TreeNode[]): number[] => {
    const ids: number[] = []
    
    const traverse = (nodes: TreeNode[], keys: React.Key[]) => {
      for (const node of nodes) {
        if (keys.includes(node.key)) {
          if (node.document) {
            ids.push(node.document.id)
          } else if (node.children) {
            // 如果是文件夹，收集所有子文档
            collectDocumentIds(node.children, ids)
          }
        }
        if (node.children) {
          traverse(node.children, keys)
        }
      }
    }
    
    traverse(nodes, keys)
    return ids
  }

  const collectDocumentIds = (nodes: TreeNode[], ids: number[]) => {
    for (const node of nodes) {
      if (node.document) {
        ids.push(node.document.id)
      }
      if (node.children) {
        collectDocumentIds(node.children, ids)
      }
    }
  }

  const handleCreateTaskSubmit = async () => {
    try {
      const values = await createTaskForm.validateFields()
      const selectedDocumentIds = getSelectedDocumentIds(selectedKeys, treeData)
      
      if (selectedDocumentIds.length === 0) {
        message.warning('选中的项目中没有文档')
        return
      }

      const response = await taskService.createReviewTasks({
        documentIds: selectedDocumentIds,
        taskTitle: values.taskTitle,
        description: values.description,
        formConfigId: values.formConfigId
      })

      if (response.errors && response.errors.length > 0) {
        message.warning(`成功创建 ${response.createdCount} 个任务，但有 ${response.errors.length} 个错误`)
        console.error('Errors:', response.errors)
      } else {
        message.success(`成功创建 ${response.createdCount} 个审核任务`)
      }

      setCreateTaskModalVisible(false)
      createTaskForm.resetFields()
      setSelectedKeys([])
    } catch (error: any) {
      console.error('Failed to create review tasks:', error)
      message.error(error.message || '创建审核任务失败')
    }
  }

  const renderArchiveContent = () => {
    if (!selectedArchive) {
      return <div>暂无标注档案</div>
    }

    const annotationRecords = selectedArchive.annotation_records || {}
    const fields = Object.keys(annotationRecords)

    return (
      <div>
        <Descriptions title="文件信息" bordered column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="文件ID">{selectedArchive.file_info?.file_id || '-'}</Descriptions.Item>
          <Descriptions.Item label="文件名">{selectedArchive.file_info?.file_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="模板ID">{selectedArchive.file_info?.template_id || '-'}</Descriptions.Item>
          <Descriptions.Item label="最后修改时间">{selectedArchive.last_modified_time || '-'}</Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: 16 }}>
          <h3>标注字段详情</h3>
          {fields.map(fieldName => {
            const entries = annotationRecords[fieldName] || []
            const uniqueValues = new Set(entries.map((e: any) => JSON.stringify(e.annotation_content)))
            const hasConflict = uniqueValues.size > 1

            return (
              <Card
                key={fieldName}
                title={
                  <span>
                    {fieldName}
                    {hasConflict && (
                      <Tag color="red" style={{ marginLeft: 8 }}>
                        <ExclamationCircleOutlined /> 冲突
                      </Tag>
                    )}
                  </span>
                }
                style={{ marginBottom: 16 }}
              >
                {entries.map((entry: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: 8,
                      marginBottom: 8,
                      backgroundColor: hasConflict ? '#fff2f0' : '#f6ffed',
                      border: `1px solid ${hasConflict ? '#ffccc7' : '#b7eb8f'}`,
                      borderRadius: 4
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
                      {entry.username} ({entry.role_type}) - {entry.operation_time}
                    </div>
                    <div style={{ fontWeight: 'bold' }}>
                      {typeof entry.annotation_content === 'object'
                        ? JSON.stringify(entry.annotation_content)
                        : String(entry.annotation_content)}
                    </div>
                    {entry.adjustment_reason && (
                      <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                        调整原因: {entry.adjustment_reason}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Card
        title="质量审核"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateReviewTasks}
            disabled={selectedKeys.length === 0}
          >
            生成审核任务
          </Button>
        }
      >
        <Row gutter={16}>
          <Col span={8}>
            <Card title="文档结构" size="small" style={{ height: '600px', overflow: 'auto' }}>
              {loading && treeData.length === 0 ? (
                <Spin />
              ) : (
                <Tree
                  showLine={{ showLeafIcon: false }}
                  showIcon
                  treeData={treeData}
                  selectedKeys={selectedKeys}
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  onSelect={handleSelect}
                  loadData={onLoadData}
                  blockNode
                />
              )}
            </Card>
          </Col>
          <Col span={16}>
            <Card title="操作说明" size="small">
              <p>1. 点击左侧树中的文档可以查看标注档案详情</p>
              <p>2. 标注冲突会在文档和文件夹后显示红色徽章，显示冲突数量</p>
              <p>3. 选中文档或文件夹后，点击"生成审核任务"按钮可以创建审核任务</p>
              <p>4. 审核任务创建后会在任务管理中等待分配</p>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 标注档案详情Modal */}
      <Modal
        title={`标注档案详情 - 文档ID: ${selectedDocumentId}`}
        open={archiveModalVisible}
        onCancel={() => {
          setArchiveModalVisible(false)
          setSelectedArchive(null)
          setSelectedDocumentId(null)
        }}
        width={1000}
        footer={[
          <Button key="close" onClick={() => {
            setArchiveModalVisible(false)
            setSelectedArchive(null)
            setSelectedDocumentId(null)
          }}>
            关闭
          </Button>
        ]}
      >
        {loading ? <Spin /> : renderArchiveContent()}
      </Modal>

      {/* 创建审核任务Modal */}
      <Modal
        title="创建审核任务"
        open={createTaskModalVisible}
        onOk={handleCreateTaskSubmit}
        onCancel={() => {
          setCreateTaskModalVisible(false)
          createTaskForm.resetFields()
        }}
        width={600}
      >
        <Form form={createTaskForm} layout="vertical">
          <Form.Item
            name="taskTitle"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="请输入任务标题" />
          </Form.Item>
          <Form.Item
            name="description"
            label="任务描述"
          >
            <TextArea rows={4} placeholder="请输入任务描述（可选）" />
          </Form.Item>
          <Form.Item
            name="formConfigId"
            label="表单模板"
          >
            <Select placeholder="选择表单模板（可选）" allowClear>
              {formConfigs.map(config => (
                <Option key={config.id} value={config.id}>
                  {config.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <div style={{ color: '#666', fontSize: '12px' }}>
              将为选中的 {getSelectedDocumentIds(selectedKeys, treeData).length} 个文档创建审核任务
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default QualityReview
