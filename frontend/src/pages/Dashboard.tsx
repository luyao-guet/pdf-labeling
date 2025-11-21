import { useEffect } from 'react'
import { Row, Col, Card, Statistic, Progress } from 'antd'
import { FileTextOutlined, CheckSquareOutlined, UserOutlined, TrophyOutlined } from '@ant-design/icons'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { setDocuments, setLoading, setError } from '../store/slices/fileSlice'
import { setTasks } from '../store/slices/taskSlice'
import { documentService } from '../services/api'

const Dashboard = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { currentUser } = useSelector((state: RootState) => state.user)
  const { documents } = useSelector((state: RootState) => state.document)
  const { tasks } = useSelector((state: RootState) => state.task)

  // 加载统计数据
  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      dispatch(setLoading(true))

      // 加载文档数据
      const documentResult = await documentService.getDocuments({
        page: 0,
        size: 100, // 获取更多数据用于统计
        sortBy: 'createdAt',
        sortDir: 'desc'
      })
      dispatch(setDocuments(documentResult))

      // 这里可以添加任务数据的加载
      // const taskResult = await taskService.getTasks(...)
      // dispatch(setTasks(taskResult))

    } catch (error: any) {
      dispatch(setError(error.message || '加载数据失败'))
      console.error('Dashboard data loading error:', error)
    } finally {
      dispatch(setLoading(false))
    }
  }

  // 计算统计数据
  const totalFiles = documents.length
  const completedTasks = tasks.filter(task => task.status === 'completed').length
  const totalTasks = tasks.length
  const userScore = currentUser?.score || 0

  return (
    <div>
      <h2>仪表板</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总文件数"
              value={totalFiles}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={totalTasks}
              prefix={<CheckSquareOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="完成任务"
              value={completedTasks}
              prefix={<CheckSquareOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="我的积分"
              value={userScore}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="任务完成进度" style={{ height: 300 }}>
            <Progress
              type="circle"
              percent={totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}
              format={(percent) => `${percent}%`}
              size={200}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="用户角色信息" style={{ height: 300 }}>
            <div style={{ padding: '20px' }}>
              <p><strong>用户名:</strong> {currentUser?.username}</p>
              <p><strong>角色:</strong> {currentUser?.role === 'admin' ? '管理员' :
                                      currentUser?.role === 'annotator' ? '标注员' :
                                      currentUser?.role === 'reviewer' ? '检查员' : '专家'}</p>
              <p><strong>邮箱:</strong> {currentUser?.email}</p>
              <p><strong>积分:</strong> {currentUser?.score}</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
