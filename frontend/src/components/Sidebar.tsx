import { Layout, Menu } from 'antd'
import { useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  DatabaseOutlined,
  CheckSquareOutlined,
  UserOutlined,
  BarChartOutlined,
  SafetyOutlined,
  ProfileOutlined,
  TrophyOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { RootState } from '../store'

const { Sider } = Layout

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useSelector((state: RootState) => state.user)

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/my-tasks',
      icon: <ProfileOutlined />,
      label: '我的任务',
      roles: ['admin', 'annotator', 'reviewer', 'expert'],
    },
    {
      key: '/data-management',
      icon: <DatabaseOutlined />,
      label: '数据管理',
    },
    {
      key: '/files',
      icon: <FileTextOutlined />,
      label: '文件管理',
    },
    {
      key: '/tasks',
      icon: <CheckSquareOutlined />,
      label: '任务管理',
    },
    {
      key: '/quality-review',
      icon: <SafetyOutlined />,
      label: '质量审核',
      roles: ['admin', 'reviewer', 'expert'],
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
      roles: ['admin'],
    },
    {
      key: '/statistics',
      icon: <BarChartOutlined />,
      label: '统计分析',
    },
    {
      key: '/score-ranking',
      icon: <TrophyOutlined />,
      label: '积分排行榜',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const filteredMenuItems = menuItems.filter(item => {
    if (item.roles && currentUser) {
      // Convert backend role enum to lowercase for comparison
      const userRole = currentUser.role.toLowerCase()
      return item.roles.includes(userRole)
    }
    return true
  })

  return (
    <Sider width={200} className="site-layout-background">
      <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0 }}
        items={filteredMenuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  )
}

export default Sidebar
