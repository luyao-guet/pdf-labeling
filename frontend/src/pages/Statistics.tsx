import { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Progress, Table, Spin, DatePicker, Select, Button, Space, Tabs, Typography } from 'antd'
import { FileTextOutlined, CheckSquareOutlined, UserOutlined, TrophyOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { taskService } from '../services/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { Title } = Typography

const Statistics = () => {
  const [stats, setStats] = useState<any>({})
  const [userPerformance, setUserPerformance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [timeRange, setTimeRange] = useState<string>('30d')

  useEffect(() => {
    loadStatistics()
  }, [dateRange, timeRange])

  const loadStatistics = async () => {
    try {
      setLoading(true)
      const [statsResponse, performanceResponse] = await Promise.all([
        taskService.getTaskStatistics(),
        taskService.getUserPerformance()
      ])

      setStats(statsResponse.statistics)
      setUserPerformance(performanceResponse.userPerformance || [])
    } catch (error) {
      console.error('Failed to load statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates)
  }

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value)
    if (value !== 'custom') {
      setDateRange(null)
    }
  }

  const exportReport = () => {
    // 导出报告功能
    const reportData = {
      stats,
      userPerformance,
      generatedAt: new Date().toISOString(),
      timeRange: timeRange
    }

    const dataStr = JSON.stringify(reportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `statistics-report-${dayjs().format('YYYY-MM-DD')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Process user performance data for ranking
  const userRanking = userPerformance
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 10) // Top 10 users
    .map((user, index) => ({
      rank: index + 1,
      username: user.username,
      score: Math.round(user.completionRate),
      role: user.role === 'ANNOTATOR' ? '标注员' :
            user.role === 'REVIEWER' ? '检查员' :
            user.role === 'EXPERT' ? '专家' : user.role,
      totalAssignments: user.totalAssignments,
      completedAssignments: user.completedAssignments
    }))

  // 图表配置
  const getTaskStatusChartOption = () => ({
    title: {
      text: '任务状态分布',
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '任务状态',
        type: 'pie',
        radius: '50%',
        data: [
          { value: stats.totalCREATED || 0, name: '已创建' },
          { value: stats.totalASSIGNED || 0, name: '已分配' },
          { value: stats.totalIN_PROGRESS || 0, name: '进行中' },
          { value: stats.totalCOMPLETED || 0, name: '已完成' }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  })

  const getUserRoleChartOption = () => ({
    title: {
      text: '用户角色分布',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    xAxis: {
      type: 'category',
      data: ['标注员', '检查员', '专家', '管理员']
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '用户数量',
        type: 'bar',
        data: [
          stats.annotators || 0,
          stats.reviewers || 0,
          stats.experts || 0,
          (stats.totalUsers || 0) - (stats.annotators || 0) - (stats.reviewers || 0) - (stats.experts || 0)
        ],
        itemStyle: {
          color: function(params: any) {
            const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d']
            return colors[params.dataIndex]
          }
        }
      }
    ]
  })

  const getUserPerformanceChartOption = () => ({
    title: {
      text: '用户绩效分布',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: userRanking.map(user => user.username)
    },
    yAxis: {
      type: 'value',
      name: '完成率 (%)'
    },
    series: [
      {
        name: '完成率',
        type: 'bar',
        data: userRanking.map(user => user.score),
        itemStyle: {
          color: '#52c41a'
        }
      }
    ]
  })

  const getTaskTrendChartOption = () => ({
    title: {
      text: '任务完成趋势',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月']
    },
    yAxis: {
      type: 'value',
      name: '任务数量'
    },
    series: [
      {
        name: '已完成',
        type: 'line',
        data: [12, 18, 22, 15, 28, 35],
        smooth: true,
        itemStyle: { color: '#52c41a' }
      },
      {
        name: '总任务',
        type: 'line',
        data: [15, 20, 25, 18, 30, 40],
        smooth: true,
        itemStyle: { color: '#1890ff' }
      }
    ]
  })


  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: '完成率',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => `${score}%`,
      sorter: (a: any, b: any) => a.score - b.score,
    },
    {
      title: '总任务',
      dataIndex: 'totalAssignments',
      key: 'totalAssignments',
    },
    {
      title: '完成任务',
      dataIndex: 'completedAssignments',
      key: 'completedAssignments',
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>加载统计数据中...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>深度统计分析</Title>
          <Space>
            <Select value={timeRange} onChange={handleTimeRangeChange} style={{ width: 120 }}>
              <Option value="7d">最近7天</Option>
              <Option value="30d">最近30天</Option>
              <Option value="90d">最近90天</Option>
              <Option value="custom">自定义</Option>
            </Select>
            {timeRange === 'custom' && (
              <RangePicker onChange={handleDateRangeChange} />
            )}
            <Button icon={<ReloadOutlined />} onClick={loadStatistics}>
              刷新
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={exportReport}>
              导出报告
            </Button>
          </Space>
        </div>

        {/* 总体统计 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总文档数"
                value={stats.totalDocuments || 0}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总任务数"
                value={(stats.totalCREATED || 0) + (stats.totalASSIGNED || 0) + (stats.totalIN_PROGRESS || 0) + (stats.totalCOMPLETED || 0)}
                prefix={<CheckSquareOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="活跃用户"
                value={stats.activeUsers || 0}
                suffix={`/ ${stats.totalUsers || 0}`}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="任务完成率"
                value={stats.totalCOMPLETED && stats.totalCREATED ?
                  Math.round((stats.totalCOMPLETED / (stats.totalCREATED + stats.totalASSIGNED + stats.totalIN_PROGRESS + stats.totalCOMPLETED)) * 100) : 0}
                suffix="%"
                prefix={<TrophyOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Tabs
          defaultActiveKey="overview"
          size="large"
          items={[
            {
              key: 'overview',
              label: '数据概览',
              children: (
                <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card>
                  {!loading && <ReactECharts key="task-status" option={getTaskStatusChartOption()} style={{ height: '400px' }} />}
                  {loading && <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card>
                  {!loading && <ReactECharts key="user-role" option={getUserRoleChartOption()} style={{ height: '400px' }} />}
                  {loading && <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}
                </Card>
              </Col>
                </Row>
              )
            },
            {
              key: 'performance',
              label: '用户绩效',
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Card>
                      {!loading && <ReactECharts key="user-performance" option={getUserPerformanceChartOption()} style={{ height: '400px' }} />}
                      {loading && <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}
                    </Card>
                  </Col>
                </Row>
              )
            },
            {
              key: 'trends',
              label: '趋势分析',
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Card>
                      {!loading && <ReactECharts key="task-trends" option={getTaskTrendChartOption()} style={{ height: '400px' }} />}
                      {loading && <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>}
                    </Card>
                  </Col>
                </Row>
              )
            },
            {
              key: 'details',
              label: '详细数据',
              children: (
                <>
                  {/* 保留原有的详细数据表格 */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Card title="任务状态分布">
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>已创建</span>
                            <span>{stats.totalCREATED || 0}</span>
                          </div>
                          <Progress percent={stats.totalCREATED ? Math.round((stats.totalCREATED / ((stats.totalCREATED || 0) + (stats.totalASSIGNED || 0) + (stats.totalIN_PROGRESS || 0) + (stats.totalCOMPLETED || 0))) * 100) : 0} />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>已分配</span>
                            <span>{stats.totalASSIGNED || 0}</span>
                          </div>
                          <Progress percent={stats.totalASSIGNED ? Math.round((stats.totalASSIGNED / ((stats.totalCREATED || 0) + (stats.totalASSIGNED || 0) + (stats.totalIN_PROGRESS || 0) + (stats.totalCOMPLETED || 0))) * 100) : 0} status="active" />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>进行中</span>
                            <span>{stats.totalIN_PROGRESS || 0}</span>
                          </div>
                          <Progress percent={stats.totalIN_PROGRESS ? Math.round((stats.totalIN_PROGRESS / ((stats.totalCREATED || 0) + (stats.totalASSIGNED || 0) + (stats.totalIN_PROGRESS || 0) + (stats.totalCOMPLETED || 0))) * 100) : 0} status="active" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>已完成</span>
                            <span>{stats.totalCOMPLETED || 0}</span>
                          </div>
                          <Progress percent={stats.totalCOMPLETED ? Math.round((stats.totalCOMPLETED / ((stats.totalCREATED || 0) + (stats.totalASSIGNED || 0) + (stats.totalIN_PROGRESS || 0) + (stats.totalCOMPLETED || 0))) * 100) : 0} status="success" />
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} md={12}>
                      <Card title="用户角色分布">
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>标注员</span>
                            <span>{stats.annotators || 0}</span>
                          </div>
                          <Progress percent={stats.annotators && stats.totalUsers ? Math.round((stats.annotators / stats.totalUsers) * 100) : 0} />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>检查员</span>
                            <span>{stats.reviewers || 0}</span>
                          </div>
                          <Progress percent={stats.reviewers && stats.totalUsers ? Math.round((stats.reviewers / stats.totalUsers) * 100) : 0} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>专家</span>
                            <span>{stats.experts || 0}</span>
                          </div>
                          <Progress percent={stats.experts && stats.totalUsers ? Math.round((stats.experts / stats.totalUsers) * 100) : 0} />
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* 用户绩效排行榜 */}
                  <Card title="用户绩效排行榜" style={{ marginTop: 24 }}>
                    <Table
                      columns={columns}
                      dataSource={userRanking}
                      rowKey="rank"
                      pagination={false}
                    />
                  </Card>
                </>
              )
            }
          ]}
        />
      </Space>
    </div>
  )
}

export default Statistics
