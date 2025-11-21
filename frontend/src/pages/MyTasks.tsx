import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, message, Descriptions, Row, Col, Statistic } from 'antd'
import { EyeOutlined, PlayCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { RootState } from '../store'
import { taskService, annotationService } from '../services/api'

interface TaskItem {
  assignment: {
    id: number
    assignmentType: 'ANNOTATION' | 'REVIEW'
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
  task: {
    id: number
    title: string
    description?: string
    status: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'CLOSED'
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    deadline?: string
    createdAt: string
    document: {
      id: number
      filename: string
    }
    category: {
      id: number
      name: string
    }
  }
  annotation?: {
    id: number
    annotationData: string
    version: number
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
    submittedAt?: string
    reviewedAt?: string
    confidenceScore?: number
    reviewNotes?: string
  }
}

const MyTasks = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useSelector((state: RootState) => state.user)

  const [taskItems, setTaskItems] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10)
  const [pagination, setPagination] = useState({
    currentPage: 0,
    totalItems: 0,
    totalPages: 0,
  })

  // Statistics
  const [stats, setStats] = useState({
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
  })

  useEffect(() => {
    loadMyTasks()
  }, [currentPage])

  // Refresh tasks when navigating to this page
  useEffect(() => {
    if (location.pathname === '/my-tasks') {
      loadMyTasks()
    }
  }, [location.pathname])

  // Refresh tasks when returning from annotation page
  useEffect(() => {
    const handleFocus = () => {
      loadMyTasks()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMyTasks()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [currentPage])

  const loadMyTasks = async () => {
    try {
      setLoading(true)
      const response = await taskService.getMyTasks({
        page: currentPage,
        size: pageSize,
        sortBy: 'assignedAt',
        sortDir: 'desc'
      })

      const assignments = response.assignments || []
      console.log('Loaded tasks:', assignments)
      console.log('First task sample:', assignments[0])
      
      setTaskItems(assignments)
      setPagination({
        currentPage: response.currentPage,
        totalItems: response.totalItems,
        totalPages: response.totalPages,
      })

      // Calculate statistics
      const totalTasks = response.totalItems
      const pendingTasks = assignments.filter(item => item.assignment && item.assignment.status === 'ASSIGNED').length
      const completedTasks = assignments.filter(item => item.assignment && item.assignment.status === 'COMPLETED').length
      const inProgressTasks = assignments.filter(item => item.assignment && item.assignment.status === 'IN_PROGRESS').length

      setStats({
        totalTasks,
        pendingTasks,
        completedTasks,
        inProgressTasks,
      })

    } catch (error) {
      console.error('Failed to load my tasks:', error)
      message.error('加载任务列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleStartTask = (taskId: number) => {
    navigate(`/annotation/${taskId}`)
  }

  const handleViewAnnotation = async (taskId: number, assignmentId: number) => {
    try {
      const response = await annotationService.getTaskAnnotations(taskId)
      const userAnnotation = response.annotations.find(
        (ann: any) => ann.taskAssignmentId === assignmentId
      )

      if (userAnnotation) {
        // Show annotation details modal or navigate to view
        message.info('标注详情功能待实现')
      } else {
        message.info('暂无标注记录')
      }
    } catch (error) {
      message.error('获取标注详情失败')
    }
  }

  const handleSubmitAnnotation = async (record: TaskItem) => {
    if (!record.annotation || !record.annotation.annotationData) {
      message.warning('标注数据不存在，请先进行标注')
      return
    }

    if (!record.assignment || !record.assignment.id) {
      message.error('任务分配信息不存在')
      return
    }

    try {
      // 解析annotationData（它可能是JSON字符串或已经是对象）
      let annotationDataObj
      const annotationData = record.annotation.annotationData
      
      if (typeof annotationData === 'string') {
        try {
          annotationDataObj = JSON.parse(annotationData)
        } catch (e) {
          message.error('标注数据格式错误，请重新标注')
          return
        }
      } else if (typeof annotationData === 'object') {
        annotationDataObj = annotationData
      } else {
        message.error('标注数据格式错误，请重新标注')
        return
      }

      // 调用提交API
      await annotationService.submitAnnotation({
        taskId: record.task.id,
        taskAssignmentId: record.assignment.id,
        annotationData: annotationDataObj,
        confidenceScore: record.annotation.confidenceScore
      })

      message.success('标注提交成功，已同步到文件档案')
      
      // 刷新任务列表
      await loadMyTasks()
    } catch (error: any) {
      console.error('Failed to submit annotation:', error)
      message.error(error.response?.data?.message || '提交标注失败')
    }
  }

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'task',
      key: 'taskId',
      width: 80,
      render: (task: TaskItem['task']) => {
        if (!task) return <span>-</span>
        return <span style={{ fontFamily: 'monospace', color: '#666' }}>#{task.id}</span>
      },
    },
    {
      title: '任务标题',
      dataIndex: 'task',
      key: 'task',
      render: (task: TaskItem['task'], record: TaskItem) => {
        if (!task) return <span>未知任务</span>
        
        // 判断是否可以点击开始标注
        const assignment = record.assignment
        const canClick = !assignment || 
          (assignment.status === 'ASSIGNED' || assignment.status === 'IN_PROGRESS') &&
          (assignment.assignmentType !== 'REVIEW' && assignment.assignmentType !== null)
        
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 'bold' }}>
                {/* Make task title clickable to start/view task */}
                {canClick && task.status !== 'COMPLETED' && task.status !== 'CLOSED' ? (
                  <a 
                    onClick={(e) => {
                      e.preventDefault()
                      handleStartTask(task.id)
                    }}
                    title="点击开始标注"
                    style={{ cursor: 'pointer', color: '#1890ff' }}
                  >
                    {task.title || '未知任务'}
                  </a>
                ) : (
                  <span>{task.title || '未知任务'}</span>
                )}
              </div>
            </div>
            {task.description && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                {task.description}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: '分类',
      dataIndex: 'task',
      key: 'category',
      render: (task: TaskItem['task']) => (
        <Tag color="blue">{task?.category?.name || '未配置'}</Tag>
      ),
    },
    {
      title: '任务类型',
      dataIndex: 'assignment',
      key: 'assignmentType',
      render: (assignment: TaskItem['assignment']) => {
        if (!assignment) return <Tag color="default">未知</Tag>
        const typeMap = {
          ANNOTATION: <Tag color="green">标注任务</Tag>,
          REVIEW: <Tag color="orange">审核任务</Tag>,
        }
        return typeMap[assignment.assignmentType] || <Tag>{assignment.assignmentType}</Tag>
      },
    },
    {
      title: '分配状态',
      dataIndex: 'assignment',
      key: 'assignmentStatus',
      render: (assignment: TaskItem['assignment']) => {
        // Check if assignment is null or has null/undefined status
        if (!assignment || assignment.status === null || assignment.status === undefined) {
          return <Tag color="default">未分配</Tag>
        }
        
        const statusMap = {
          ASSIGNED: <Tag color="orange">已分配给 {assignment.user?.username || '未知用户'}</Tag>,
          IN_PROGRESS: <Tag color="processing">{assignment.user?.username || '未知用户'} 正在标注</Tag>,
          COMPLETED: <Tag color="green">已完成 ({assignment.user?.username || '未知用户'})</Tag>,
          REJECTED: <Tag color="red">已拒绝 ({assignment.user?.username || '未知用户'})</Tag>,
        }
        return statusMap[assignment.status] || <Tag>{assignment.status || '未知状态'}</Tag>
      },
    },
    {
      title: '标注状态',
      dataIndex: 'annotation',
      key: 'annotationStatus',
      render: (annotation?: TaskItem['annotation']) => {
        if (!annotation) {
          return <Tag color="default">未开始</Tag>
        }

        const statusMap = {
          DRAFT: <Tag color="default">草稿</Tag>,
          SUBMITTED: <Tag color="blue">已提交</Tag>,
          APPROVED: <Tag color="green">已通过</Tag>,
          REJECTED: <Tag color="red">已拒绝</Tag>,
        }
        return statusMap[annotation.status] || <Tag>{annotation.status}</Tag>
      },
    },
    {
      title: '分配时间',
      dataIndex: 'assignment',
      key: 'assignedAt',
      render: (assignment: TaskItem['assignment']) => {
        if (!assignment || !assignment.assignedAt) return '-'
        return new Date(assignment.assignedAt).toLocaleString('zh-CN')
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: TaskItem) => {
        if (!record || !record.task) {
          console.log('Missing record or task:', { record, task: record?.task })
          return <span>数据不完整</span>
        }
        
        // 调试信息
        const assignment = record.assignment
        const assignmentType = assignment?.assignmentType
        const assignmentStatus = assignment?.status
        const taskStatus = record.task.status
        const taskId = record.task.id
        
        console.log('Task button render:', {
          taskId,
          assignmentType,
          assignmentStatus,
          taskStatus,
          hasAnnotation: !!record.annotation,
          annotationStatus: record.annotation?.status,
          hasAssignment: !!assignment
        })
        
        // 判断是否为标注任务（非审核任务）
        // 如果没有 assignment，默认认为是标注任务
        // 如果有 assignment，只要不是 REVIEW 类型，就是标注任务
        const isAnnotationTask = !assignmentType || assignmentType !== 'REVIEW'
        
        // 判断是否可以开始/继续标注
        // 条件：1. 是标注任务 2. 任务状态不是已完成或已关闭
        // 如果没有 assignment，基于任务状态判断
        const canStartAnnotation = isAnnotationTask && 
          taskId && // 确保任务ID存在
          taskStatus !== 'COMPLETED' && 
          taskStatus !== 'CLOSED' &&
          (!assignmentStatus || (assignmentStatus !== 'COMPLETED' && assignmentStatus !== 'REJECTED'))
        
        // 判断是否有未完成的标注（草稿或已拒绝）
        const hasIncompleteAnnotation = record.annotation && 
          (record.annotation.status === 'DRAFT' || record.annotation.status === 'REJECTED')
        
        // 判断是否可以提交（有草稿或已拒绝的标注，且有标注数据）
        const canSubmit = record.annotation && 
          (record.annotation.status === 'DRAFT' || record.annotation.status === 'REJECTED') &&
          record.annotation.annotationData &&
          assignment && assignment.id
        
        return (
        <Space size="middle">
          {/* 开始/继续标注按钮 - 只要有任务就可以开始标注 */}
          {canStartAnnotation ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartTask(taskId)}
              size="small"
            >
              {hasIncompleteAnnotation ? '继续标注' : '开始标注'}
            </Button>
          ) : (
            // 显示为什么不能开始标注
            <span style={{ fontSize: '12px', color: '#999' }}>
              {!isAnnotationTask ? '审核任务' : 
               taskStatus === 'COMPLETED' || assignmentStatus === 'COMPLETED' ? '已完成' : 
               taskStatus === 'CLOSED' ? '已关闭' :
               assignmentStatus === 'REJECTED' ? '已拒绝' : 
               `状态: ${taskStatus || assignmentStatus || '未知'}`}
            </span>
          )}

          {/* 提交按钮 - 如果有草稿或已拒绝的标注 */}
          {canSubmit && (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => handleSubmitAnnotation(record)}
              size="small"
              danger={record.annotation.status === 'REJECTED'}
            >
              提交
            </Button>
          )}

          {/* 编辑标注按钮 - 如果已有标注（包括已提交的） */}
          {record.annotation && (
            <Button
              type="default"
              icon={<EditOutlined />}
              onClick={() => handleStartTask(taskId)}
              size="small"
            >
              编辑标注
            </Button>
          )}

          {/* 已完成状态 */}
          {(taskStatus === 'COMPLETED' || assignmentStatus === 'COMPLETED') && (
            <Button type="default" disabled size="small">
              <CheckCircleOutlined /> 已完成
            </Button>
          )}
        </Space>
      )},
    },
  ]

  return (
    <div>
      <Card title="我的任务" style={{ marginBottom: 16 }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic
              title="总任务数"
              value={stats.totalTasks}
              prefix={<ClockCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="待处理"
              value={stats.pendingTasks}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="进行中"
              value={stats.inProgressTasks}
              valueStyle={{ color: '#1890ff' }}
              prefix={<PlayCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已完成"
              value={stats.completedTasks}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={taskItems}
          rowKey={(record) => {
            if (!record || !record.task || !record.assignment) {
              return `unknown-${Math.random()}`
            }
            return `${record.task.id}-${record.assignment.id}`
          }}
          loading={loading}
          pagination={false}
        />

        {pagination.totalPages > 1 && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                上一页
              </Button>
              <span>
                第 {pagination.currentPage + 1} 页，共 {pagination.totalPages} 页
              </span>
              <Button
                disabled={currentPage >= pagination.totalPages - 1}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                下一页
              </Button>
            </Space>
          </div>
        )}
      </Card>

      {/* User Info */}
      <Card title="用户信息" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="用户名">{currentUser?.username}</Descriptions.Item>
          <Descriptions.Item label="角色">
            {(currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') && '管理员'}
            {(currentUser?.role === 'annotator' || currentUser?.role === 'ANNOTATOR') && '标注员'}
            {(currentUser?.role === 'reviewer' || currentUser?.role === 'REVIEWER') && '检查员'}
            {(currentUser?.role === 'expert' || currentUser?.role === 'EXPERT') && '专家'}
          </Descriptions.Item>
          <Descriptions.Item label="用户ID">{currentUser?.id}</Descriptions.Item>
          <Descriptions.Item label="注册时间">暂无</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

export default MyTasks
