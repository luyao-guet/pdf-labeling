import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Card, Descriptions, Pagination, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, PlayCircleOutlined, UserAddOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState, AppDispatch } from '../store'
import { Task, taskService, TaskAssignment } from '../services/api'
import { setTasks, setLoading, setError, addTask, updateTask } from '../store/slices/taskSlice'
import { documentService, categoryService, formConfigService, userService, Document, Category, FormConfig, User } from '../services/api'

const { Option } = Select

const TaskManagement = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { tasks, loading, error, pagination } = useSelector((state: RootState) => state.task)
  const { currentUser } = useSelector((state: RootState) => state.user)

  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [assigningTask, setAssigningTask] = useState<Task | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [taskDetail, setTaskDetail] = useState<Task | null>(null)
  const [batchDocuments, setBatchDocuments] = useState<Array<{
    documentId: number
    absolutePath: string
    filename: string
    folderPath?: string
    fileSize?: number
    mimeType?: string
  }>>([])
  const [loadingBatchTasks, setLoadingBatchTasks] = useState(false)

  // Form refs
  const [taskForm] = Form.useForm()
  const [assignForm] = Form.useForm()

  // Data for dropdowns
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [formConfigs, setFormConfigs] = useState<FormConfig[]>([])
  const [users, setUsers] = useState<User[]>([])

  // Load data on component mount
  useEffect(() => {
    loadTasks()
    loadReferenceData()
  }, [currentPage])

  const loadTasks = async () => {
    try {
      dispatch(setLoading(true))
      const response = await taskService.getTasks({
        page: currentPage,
        size: pageSize,
        sortBy: 'createdAt',
        sortDir: 'desc'
      })
      dispatch(setTasks(response))
    } catch (error) {
      console.error('Failed to load tasks:', error)
      dispatch(setError('加载任务列表失败'))
      message.error('加载任务列表失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  const loadReferenceData = async () => {
    try {
      const [documentsRes, categoriesRes, formConfigsRes, usersRes] = await Promise.all([
        documentService.getDocuments({ size: 1000 }),
        categoryService.getCategories(),
        formConfigService.getFormConfigs(),
        userService.getUsers()
      ])

      setDocuments(documentsRes.documents)
      setCategories(categoriesRes.categories)
      setFormConfigs(formConfigsRes.formConfigs)
      setUsers(usersRes)
    } catch (error) {
      console.error('Failed to load reference data:', error)
    }
  }

  const columns = [
    {
      title: '任务标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '文件数量',
      key: 'fileCount',
      width: 100,
      render: (_: any, record: Task) => {
        // Try to get file count from documentIndex
        if (record.documentIndex) {
          try {
            const docIndex = typeof record.documentIndex === 'string' 
              ? JSON.parse(record.documentIndex)
              : record.documentIndex
            if (docIndex.documents && Array.isArray(docIndex.documents)) {
              return <Tag color="blue">{docIndex.documents.length}</Tag>
            } else if (docIndex.totalCount) {
              return <Tag color="blue">{docIndex.totalCount}</Tag>
            }
          } catch (e) {
            // If parsing fails, fallback to 1
          }
        }
        // Default to 1 if no batch or documentIndex
        return <Tag color="blue">1</Tag>
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: { name: string } | null) => category ? category.name : <Tag color="default">未配置</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Task) => {
        // Get active annotators from assignments
        const activeAssignments = record.assignments?.filter(
          (a: any) => a.status === 'IN_PROGRESS' && 
          (a.assignmentType === 'ANNOTATION' || a.assignmentType === 'AI_ANNOTATION')
        ) || []
        
        const statusMap: Record<string, JSX.Element> = {
          CREATED: <Tag color="orange">已创建</Tag>,
          AI_PROCESSING: <Tag color="cyan">AI处理中</Tag>,
          AI_COMPLETED: <Tag color="cyan">AI完成</Tag>,
          ANNOTATING: activeAssignments.length > 0 
            ? <Tag color="blue">{activeAssignments.map((a: any) => a.user?.username || '未知').join(', ')} 正在标注</Tag>
            : <Tag color="blue">标注中</Tag>,
          ANNOTATED: <Tag color="green">已标注</Tag>,
          INSPECTING: <Tag color="purple">检查中</Tag>,
          INSPECTED: <Tag color="purple">已检查</Tag>,
          EXPERT_REVIEWING: <Tag color="gold">专家审核中</Tag>,
          EXPERT_REVIEWED: <Tag color="gold">专家已审</Tag>,
          ASSIGNED: <Tag color="blue">已分配</Tag>,
          IN_PROGRESS: activeAssignments.length > 0
            ? <Tag color="processing">{activeAssignments.map((a: any) => a.user?.username || '未知').join(', ')} 正在标注</Tag>
            : <Tag color="processing">进行中</Tag>,
          COMPLETED: <Tag color="green">已完成</Tag>,
          REVIEWED: <Tag color="purple">已审核</Tag>,
          CLOSED: <Tag color="default">已关闭</Tag>,
        }
        return statusMap[status] || <Tag>{status}</Tag>
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const priorityMap = {
          LOW: <Tag color="default">低</Tag>,
          NORMAL: <Tag color="blue">普通</Tag>,
          HIGH: <Tag color="orange">高</Tag>,
          URGENT: <Tag color="red">紧急</Tag>,
        }
        return priorityMap[priority as keyof typeof priorityMap] || <Tag>{priority}</Tag>
      },
    },
    {
      title: '分配人数',
      dataIndex: 'assignments',
      key: 'assignments',
      render: (assignments: TaskAssignment[]) => assignments ? `${assignments.length}人` : '0人',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Task) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            style={{ padding: '0 4px' }}
          >
            详情
          </Button>
          {(currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') && (
            <>
              <Button
                type="link"
                size="small"
                icon={<UserAddOutlined />}
                onClick={() => handleAssign(record)}
                style={{ padding: '0 4px' }}
              >
                分配
              </Button>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                style={{ padding: '0 4px' }}
              >
                编辑
              </Button>
            </>
          )}
          {((currentUser?.role === 'annotator' || currentUser?.role === 'ANNOTATOR') ||
            (currentUser?.role === 'reviewer' || currentUser?.role === 'REVIEWER') ||
            (currentUser?.role === 'expert' || currentUser?.role === 'EXPERT')) &&
           (record.status === 'ASSIGNED' || record.status === 'IN_PROGRESS') && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartAnnotation(record.id)}
              style={{ padding: '0 4px' }}
            >
              开始标注
            </Button>
          )}
          {(currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') && (
            <Popconfirm
              title="确定要删除这个任务吗？"
              description="此操作不可恢复，请谨慎操作"
              onConfirm={async () => {
                try {
                  await taskService.deleteTask(record.id)
                  message.success('任务删除成功')
                  loadTasks()
                } catch (error: any) {
                  message.error(error.response?.data?.message || '删除任务失败')
                }
              }}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                style={{ padding: '0 4px' }}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    setEditingTask(null)
    taskForm.resetFields()
    setIsModalVisible(true)
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    taskForm.setFieldsValue({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
    })
    setIsModalVisible(true)
  }

  const handleViewDetail = async (task: Task) => {
    try {
      const response = await taskService.getTaskById(task.id)
      setTaskDetail(response.task)
      setDetailModalVisible(true)
      
      // If task has batchId, load batch documents
      if (response.task.batchId) {
        setLoadingBatchTasks(true)
        try {
          const batchResponse = await taskService.getTasksByBatchId(response.task.batchId)
          setBatchDocuments(batchResponse.documents)
        } catch (error) {
          console.error('Failed to load batch documents:', error)
          message.warning('获取批次文件列表失败')
        } finally {
          setLoadingBatchTasks(false)
        }
      } else {
        // Try to parse documentIndex for single document
        if (response.task.documentIndex) {
          try {
            const docIndex = typeof response.task.documentIndex === 'string' 
              ? JSON.parse(response.task.documentIndex)
              : response.task.documentIndex
            if (docIndex.documents && Array.isArray(docIndex.documents)) {
              // New format with documents array
              setBatchDocuments(docIndex.documents.map((doc: any) => ({
                documentId: doc.id,
                absolutePath: doc.folderPath ? `${doc.folderPath}/${doc.originalFilename || doc.filename}` : `/${doc.originalFilename || doc.filename}`,
                filename: doc.originalFilename || doc.filename,
                folderPath: doc.folderPath,
                fileSize: doc.fileSize,
                mimeType: doc.mimeType
              })))
            } else {
              // Old format or single document
              setBatchDocuments([])
            }
          } catch (e) {
            setBatchDocuments([])
          }
        } else {
          setBatchDocuments([])
        }
      }
    } catch (error) {
      message.error('获取任务详情失败')
    }
  }

  const handleAssign = (task: Task) => {
    setAssigningTask(task)
    assignForm.resetFields()
    setIsAssignModalVisible(true)
  }

  const handleStartAnnotation = (taskId: number) => {
    navigate(`/annotation/${taskId}`)
  }

  const handleTaskModalOk = async () => {
    try {
      const values = await taskForm.validateFields()

      if (editingTask) {
        // 编辑任务
        const response = await taskService.updateTask(editingTask.id, {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
        })
        dispatch(updateTask(response.task))
        message.success('任务更新成功')
      } else {
        // 创建任务
        const response = await taskService.createTask({
          title: values.title,
          description: values.description,
          documentId: values.documentId,
          categoryId: values.categoryId,
          formConfigId: values.formConfigId,
        })
        dispatch(addTask(response.task))
        message.success('任务创建成功')
      }

      setIsModalVisible(false)
      taskForm.resetFields()
    } catch (error) {
      console.error('Task operation failed:', error)
      message.error(editingTask ? '更新任务失败' : '创建任务失败')
    }
  }

  const handleAssignModalOk = async () => {
    try {
      const values = await assignForm.validateFields()

      if (assigningTask) {
        await taskService.assignTask(assigningTask.id, {
          userIds: Array.isArray(values.userIds) ? values.userIds : [values.userIds],
          assignmentType: values.assignmentType,
        })
        message.success('任务分配成功')
        loadTasks() // 重新加载任务列表
      }

      setIsAssignModalVisible(false)
      assignForm.resetFields()
    } catch (error: any) {
      console.error('Task assignment failed:', error)
      const msg = error.response?.data?.message || '任务分配失败'
      const errors = error.response?.data?.errors
      if (errors && Array.isArray(errors)) {
        message.error(`${msg}: ${errors.join(', ')}`)
      } else {
        message.error(msg)
      }
    }
  }

  const handleModalCancel = () => {
    setIsModalVisible(false)
    setIsAssignModalVisible(false)
    taskForm.resetFields()
    assignForm.resetFields()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page - 1)
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一个任务')
      return
    }

    setBatchDeleteLoading(true)
    try {
      const taskIds = selectedRowKeys.map(key => Number(key))
      const result = await taskService.deleteBatchTasks(taskIds)

      let resultMessage = ''
      const parts: string[] = []
      
      if (result.successCount > 0) {
        parts.push(`成功删除 ${result.successCount} 个任务`)
      }
      if (result.failCount > 0) {
        parts.push(`失败 ${result.failCount} 个`)
      }
      
      resultMessage = parts.join('，')
      
      if (result.successCount > 0 && result.failCount === 0) {
        message.success(resultMessage)
        setSelectedRowKeys([])
        loadTasks() // Reload tasks
      } else if (result.successCount > 0) {
        message.warning(resultMessage)
        if (result.errors && result.errors.length > 0) {
          console.error('删除任务失败详情:', result.errors)
        }
        loadTasks() // Reload tasks
      } else {
        message.error(resultMessage)
        if (result.errors && result.errors.length > 0) {
          console.error('删除任务失败详情:', result.errors)
        }
      }
    } catch (error: any) {
      console.error('批量删除任务失败:', error)
      message.error(error.response?.data?.message || '批量删除任务失败')
    } finally {
      setBatchDeleteLoading(false)
    }
  }

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys)
    },
  }

  // Debug: log current user role
  console.log('TaskManagement - currentUser:', currentUser, 'role:', currentUser?.role)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMIN'
  console.log('TaskManagement - isAdmin:', isAdmin, 'selectedRowKeys:', selectedRowKeys.length)

  return (
    <div>
      {/* Toolbar similar to FileManagement - outside Card for better visibility */}
      {isAdmin && (
        <div style={{
          background: '#fff',
          border: '1px solid #d9d9d9',
          borderBottom: '1px solid #e8e8e8',
          borderRadius: '6px 6px 0 0',
          padding: '12px 16px',
          marginBottom: 0,
          marginTop: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: '48px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <Space size="small">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              size="small"
              >
                创建任务
              </Button>
          </Space>
          
          <div style={{ flex: 1 }} />
          
          <Space size="small">
            {selectedRowKeys.length > 0 ? (
              <Popconfirm
                title="确认删除"
                description={`确定要删除选中的 ${selectedRowKeys.length} 个任务吗？此操作不可恢复，请谨慎操作。`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true, loading: batchDeleteLoading }}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  loading={batchDeleteLoading}
                  size="small"
                  style={{ color: '#ff4d4f' }}
                >
                  删除 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            ) : (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled
                size="small"
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                删除
              </Button>
            )}
          </Space>
        </div>
      )}
      
      <Card 
        title="任务管理" 
        style={{ 
          marginBottom: 16,
          marginTop: (currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') ? 0 : 16,
          borderRadius: (currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') ? '0 0 6px 6px' : '6px',
          borderTop: (currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') ? 'none' : '1px solid #e8e8e8'
        }}
      >

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={false}
          rowSelection={(currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') ? rowSelection : undefined}
        />

        {pagination.totalPages > 1 && (
          <Pagination
            current={pagination.currentPage + 1}
            total={pagination.totalItems}
            pageSize={pageSize}
            onChange={handlePageChange}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
            style={{ marginTop: 16, textAlign: 'right' }}
          />
        )}
      </Card>

      {/* Task Creation/Edit Modal */}
      <Modal
        title={editingTask ? '编辑任务' : '创建任务'}
        open={isModalVisible}
        onOk={handleTaskModalOk}
        onCancel={handleModalCancel}
        width={600}
        confirmLoading={loading}
      >
        <Form
          form={taskForm}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="请输入任务标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="任务描述"
            rules={[{ required: true, message: '请输入任务描述' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入任务描述" />
          </Form.Item>

          {!editingTask && (
            <>
              <Form.Item
                name="documentId"
                label="选择文档"
                rules={[{ required: true, message: '请选择文档' }]}
              >
                <Select placeholder="选择要标注的文档">
                  {documents.map(doc => (
                    <Option key={doc.id} value={doc.id}>
                      {doc.filename}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="categoryId"
                label="选择分类"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select placeholder="选择文档分类">
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>
                      {cat.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="formConfigId"
                label="选择表单配置"
                rules={[{ required: true, message: '请选择表单配置' }]}
              >
                <Select placeholder="选择标注表单配置">
                  {formConfigs.map(config => (
                    <Option key={config.id} value={config.id}>
                      {config.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}

          {editingTask && (
            <>
              <Form.Item
                name="status"
                label="任务状态"
              >
                <Select placeholder="选择任务状态" allowClear>
                  <Option value="CREATED">已创建</Option>
                  <Option value="ASSIGNED">已分配</Option>
                  <Option value="IN_PROGRESS">进行中</Option>
                  <Option value="COMPLETED">已完成</Option>
                  <Option value="REVIEWED">已审核</Option>
                  <Option value="CLOSED">已关闭</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="priority"
                label="优先级"
              >
                <Select placeholder="选择优先级" allowClear>
                  <Option value="LOW">低</Option>
                  <Option value="NORMAL">普通</Option>
                  <Option value="HIGH">高</Option>
                  <Option value="URGENT">紧急</Option>
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Task Assignment Modal */}
      <Modal
        title="分配任务"
        open={isAssignModalVisible}
        onOk={handleAssignModalOk}
        onCancel={handleModalCancel}
        width={500}
        confirmLoading={loading}
      >
        <Form
          form={assignForm}
          layout="vertical"
        >
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.assignmentType !== currentValues.assignmentType}
          >
            {({ getFieldValue }) => {
              const assignmentType = getFieldValue('assignmentType')
              return (
                <>
                  <Form.Item
                    name="assignmentType"
                    label="分配类型"
                    rules={[{ required: true, message: '请选择分配类型' }]}
                  >
                    <Select placeholder="选择分配类型" allowClear onChange={() => assignForm.setFieldsValue({ userIds: undefined })}>
                      <Option value="AI_ANNOTATION">AI标注</Option>
                      <Option value="ANNOTATION">人工标注</Option>
                      <Option value="INSPECTION">质量检查</Option>
                      <Option value="EXPERT_REVIEW">专家审核</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="userIds"
                    label="选择用户"
                    rules={[{ required: true, message: '请选择用户' }]}
                  >
                    <Select 
                      mode="multiple" 
                      placeholder="选择要分配的用户" 
                      disabled={!assignmentType}
                      optionFilterProp="children"
                      maxTagCount="responsive"
                    >
                      {users
                        .filter(user => {
                          if (!assignmentType) return false
                          const role = (user.role || '').toUpperCase()
                          // Admins can be assigned any task type
                          if (role === 'ADMIN') return true
                          
                          if (assignmentType === 'AI_ANNOTATION') return role === 'AI_ANNOTATOR'
                          if (assignmentType === 'ANNOTATION') return role === 'ANNOTATOR'
                          if (assignmentType === 'INSPECTION') return role === 'REVIEWER'
                          if (assignmentType === 'EXPERT_REVIEW') return role === 'EXPERT'
                          return false
                        })
                        .map(user => (
                          <Option key={user.id} value={user.id}>
                            {user.username} ({user.role})
                          </Option>
                        ))}
                    </Select>
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        title={
          <div>
            <EyeOutlined style={{ marginRight: 8 }} />
            任务详情
            {taskDetail?.batchName && (
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {taskDetail.batchName}
              </Tag>
            )}
          </div>
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setTaskDetail(null)
          setBatchDocuments([])
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailModalVisible(false)
            setTaskDetail(null)
            setBatchDocuments([])
          }}>
            关闭
          </Button>
        ]}
        width={800}
        destroyOnHidden
      >
        {taskDetail && (
          <div>
            <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="任务标题">{taskDetail.title}</Descriptions.Item>
              {taskDetail.description && (
                <Descriptions.Item label="任务描述">{taskDetail.description}</Descriptions.Item>
              )}
              <Descriptions.Item label="任务状态">
                <Tag color={
                  taskDetail.status === 'CREATED' ? 'default' :
                  taskDetail.status === 'ASSIGNED' ? 'blue' :
                  taskDetail.status === 'IN_PROGRESS' ? 'orange' :
                  taskDetail.status === 'COMPLETED' ? 'green' : 'default'
                }>
                  {taskDetail.status === 'CREATED' ? '已创建' :
                   taskDetail.status === 'ASSIGNED' ? '已分配' :
                   taskDetail.status === 'IN_PROGRESS' ? '进行中' :
                   taskDetail.status === 'COMPLETED' ? '已完成' :
                   taskDetail.status === 'REVIEWED' ? '已审核' :
                   taskDetail.status === 'CLOSED' ? '已关闭' : taskDetail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={
                  taskDetail.priority === 'LOW' ? 'default' :
                  taskDetail.priority === 'NORMAL' ? 'blue' :
                  taskDetail.priority === 'HIGH' ? 'orange' :
                  taskDetail.priority === 'URGENT' ? 'red' : 'blue'
                }>
                  {taskDetail.priority === 'LOW' ? '低' :
                   taskDetail.priority === 'NORMAL' ? '普通' :
                   taskDetail.priority === 'HIGH' ? '高' :
                   taskDetail.priority === 'URGENT' ? '紧急' : taskDetail.priority}
                </Tag>
              </Descriptions.Item>
              {taskDetail.batchId && (
                <Descriptions.Item label="批次ID">{taskDetail.batchId}</Descriptions.Item>
              )}
              {taskDetail.batchName && (
                <Descriptions.Item label="批次名称">{taskDetail.batchName}</Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                {new Date(taskDetail.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            {/* Show batch documents list if task has batchId or documents in documentIndex */}
            {(taskDetail.batchId || batchDocuments.length > 0) && (
              <div style={{ marginTop: 16 }}>
                <h3>子任务文件列表（共 {batchDocuments.length} 个文件）</h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <Table
                    dataSource={batchDocuments}
                    loading={loadingBatchTasks}
                    rowKey="documentId"
                    pagination={false}
                    size="small"
                    scroll={{ y: 350 }}
                    columns={[
                      {
                        title: '序号',
                        key: 'index',
                        width: 60,
                        render: (_: any, __: any, index: number) => index + 1,
                      },
                      {
                        title: '文件绝对路径',
                        dataIndex: 'absolutePath',
                        key: 'absolutePath',
                        ellipsis: true,
                      },
                      {
                        title: '文件大小',
                        dataIndex: 'fileSize',
                        key: 'fileSize',
                        width: 100,
                        render: (size?: number) => {
                          if (!size) return '-'
                          if (size < 1024) return `${size} B`
                          if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
                          return `${(size / (1024 * 1024)).toFixed(2)} MB`
                        },
                      },
                      {
                        title: '经手人员',
                        key: 'assignments',
                        width: 200,
                        render: () => {
                          // Show all task assignments for this task
                          if (taskDetail.assignments && taskDetail.assignments.length > 0) {
                            const aiAnnotators = taskDetail.assignments
                              .filter((a: TaskAssignment) => a.assignmentType === 'AI_ANNOTATION')
                              .map((a: TaskAssignment) => a.user.username)
                            const annotators = taskDetail.assignments
                              .filter((a: TaskAssignment) => a.assignmentType === 'ANNOTATION')
                              .map((a: TaskAssignment) => a.user.username)
                            const inspectors = taskDetail.assignments
                              .filter((a: TaskAssignment) => a.assignmentType === 'INSPECTION' || a.assignmentType === 'REVIEW')
                              .map((a: TaskAssignment) => a.user.username)
                            const experts = taskDetail.assignments
                              .filter((a: TaskAssignment) => a.assignmentType === 'EXPERT_REVIEW')
                              .map((a: TaskAssignment) => a.user.username)
                            
                            return (
                              <div>
                                {aiAnnotators.length > 0 && (
                                  <div style={{ marginBottom: 4 }}>
                                    <Tag color="cyan">AI: {aiAnnotators.join(', ')}</Tag>
                                  </div>
                                )}
                                {annotators.length > 0 && (
                                  <div style={{ marginBottom: 4 }}>
                                    <Tag color="green">标注: {annotators.join(', ')}</Tag>
                                  </div>
                                )}
                                {inspectors.length > 0 && (
                                  <div style={{ marginBottom: 4 }}>
                                    <Tag color="purple">检查: {inspectors.join(', ')}</Tag>
                                  </div>
                                )}
                                {experts.length > 0 && (
                                  <div>
                                    <Tag color="gold">专家: {experts.join(', ')}</Tag>
                                  </div>
                                )}
                                {aiAnnotators.length === 0 && annotators.length === 0 && inspectors.length === 0 && experts.length === 0 && (
                                  <Tag color="default">未分配</Tag>
                                )}
                              </div>
                            )
                          }
                          return <Tag color="default">未分配</Tag>
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Show single document path if no batchId */}
            {!taskDetail.batchId && taskDetail.documentIndex && (
              <div style={{ marginTop: 16 }}>
                <h3>文档路径</h3>
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="文件绝对路径">
                    {(() => {
                      try {
                        const docIndex = typeof taskDetail.documentIndex === 'string' 
                          ? JSON.parse(taskDetail.documentIndex)
                          : taskDetail.documentIndex
                        const folderPath = docIndex.folderPath || ''
                        const filename = docIndex.originalFilename || docIndex.filename || ''
                        return folderPath ? `${folderPath}/${filename}` : `/${filename}`
                      } catch (e) {
                        return taskDetail.document?.filename || '未知'
                      }
                    })()}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TaskManagement
