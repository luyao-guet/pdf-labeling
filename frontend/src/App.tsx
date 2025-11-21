import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { setUser } from './store/slices/userSlice'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import FileManagement from './pages/FileManagement'
import CategoryManagement from './pages/CategoryManagement'
import TaskManagement from './pages/TaskManagement'
import AnnotationWorkbench from './pages/AnnotationWorkbench'
import QualityReview from './pages/QualityReview'
import MyTasks from './pages/MyTasks'
import UserManagement from './pages/UserManagement'
import Statistics from './pages/Statistics'
import ScoreRanking from './pages/ScoreRanking'
import FormDesigner from './pages/FormDesigner'
import DataManagement from './pages/DataManagement'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

const { Content } = Layout

// 主要应用程序布局组件
function AppLayout() {
  const dispatch = useDispatch()

  // 从localStorage恢复用户状态
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        // 确保用户信息完整
        if (user && user.id && user.username) {
          dispatch(setUser(user))
          console.log('User state restored from localStorage:', user)
        } else {
          console.warn('Invalid user data in localStorage, clearing...')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        }
      } catch (error) {
        console.error('Failed to parse user data from localStorage:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    } else {
      console.log('No token or user in localStorage')
    }
  }, [dispatch])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header />
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
          <Routes>
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/files" element={
              <ProtectedRoute allowedRoles={['admin', 'annotator', 'reviewer', 'expert']}>
                <FileManagement />
              </ProtectedRoute>
            } />
            <Route path="/categories" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CategoryManagement />
              </ProtectedRoute>
            } />
            <Route path="/tasks" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <TaskManagement />
              </ProtectedRoute>
            } />
            <Route path="/my-tasks" element={
              <ProtectedRoute allowedRoles={['admin', 'annotator', 'reviewer', 'expert']}>
                <MyTasks />
              </ProtectedRoute>
            } />
            <Route path="/annotation/:taskId" element={
              <ProtectedRoute allowedRoles={['admin', 'annotator', 'reviewer', 'expert']}>
                <AnnotationWorkbench />
              </ProtectedRoute>
            } />
            <Route path="/quality-review" element={
              <ProtectedRoute allowedRoles={['admin', 'reviewer', 'expert']}>
                <QualityReview />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/statistics" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Statistics />
              </ProtectedRoute>
            } />
            <Route path="/score-ranking" element={
              <ProtectedRoute allowedRoles={['admin', 'annotator', 'reviewer', 'expert']}>
                <ScoreRanking />
              </ProtectedRoute>
            } />
            <Route path="/data-management" element={
              <ProtectedRoute allowedRoles={['admin', 'annotator', 'reviewer', 'expert']}>
                <DataManagement />
              </ProtectedRoute>
            } />
            <Route path="/form-designer/:id?" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <FormDesigner />
              </ProtectedRoute>
            } />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<AppLayout />} />
    </Routes>
  )
}

export default App
