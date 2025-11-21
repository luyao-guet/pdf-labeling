import { Layout, Avatar, Dropdown, Typography } from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { RootState } from '../store'
import { clearUser } from '../store/slices/userSlice'

const { Header: AntHeader } = Layout
const { Text } = Typography

const Header = () => {
  const dispatch = useDispatch()
  const { currentUser } = useSelector((state: RootState) => state.user)

  const handleLogout = () => {
    dispatch(clearUser())
    // 这里可以添加清除本地存储token的逻辑
  }

  const menuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <AntHeader style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text strong style={{ fontSize: '18px' }}>数据标注平台</Text>

      {currentUser && (
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar icon={<UserOutlined />} />
            <Text>{currentUser.username}</Text>
            <Text type="secondary">({currentUser.role})</Text>
          </div>
        </Dropdown>
      )}
    </AntHeader>
  )
}

export default Header
