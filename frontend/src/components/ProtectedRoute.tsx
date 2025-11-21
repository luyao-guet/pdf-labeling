import { ReactNode } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: string[]
  requireAuth?: boolean
}

const ProtectedRoute = ({ children, allowedRoles = [], requireAuth = true }: ProtectedRouteProps) => {
  const navigate = useNavigate()
  const { currentUser, isAuthenticated } = useSelector((state: RootState) => state.user)

  // Check authentication - also check localStorage as fallback
  // This handles cases where Redux state might not be initialized yet
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  const hasToken = !!token
  const hasUser = !!userStr
  
  // Consider authenticated if either Redux says so OR localStorage has both token and user
  const isAuth = isAuthenticated || (hasToken && hasUser)

  if (requireAuth && !isAuth) {
    return (
      <Result
        status="403"
        title="需要登录"
        subTitle="请先登录以访问此页面"
        extra={
          <Button type="primary" onClick={() => navigate('/login')}>
            去登录
          </Button>
        }
      />
    )
  }

  // Check role-based access
  // Try to get user from Redux first, fallback to localStorage
  let userForRoleCheck = currentUser
  if (!userForRoleCheck && userStr) {
    try {
      userForRoleCheck = JSON.parse(userStr)
    } catch (e) {
      console.error('Failed to parse user from localStorage:', e)
    }
  }

  if (allowedRoles.length > 0 && userForRoleCheck) {
    const userRole = userForRoleCheck.role?.toLowerCase() || ''
    const hasAccess = allowedRoles.some(role => role.toLowerCase() === userRole)

    if (!hasAccess) {
      return (
        <Result
          status="403"
          title="权限不足"
          subTitle={`您的角色(${userForRoleCheck.role || '未知'})无权访问此页面`}
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              返回首页
            </Button>
          }
        />
      )
    }
  }

  return <>{children}</>
}

export default ProtectedRoute




