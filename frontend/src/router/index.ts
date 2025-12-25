import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 路由懒加载
const Login = () => import('@/pages/Login.vue')
const MainLayout = () => import('@/layouts/MainLayout.vue')
const Dashboard = () => import('@/pages/Dashboard.vue')
const FileManagement = () => import('@/pages/FileManagement.vue')
const CategoryManagement = () => import('@/pages/CategoryManagement.vue')
const TaskManagement = () => import('@/pages/TaskManagement.vue')
const MyTasks = () => import('@/pages/MyTasks.vue')
const AnnotationWorkbench = () => import('@/pages/AnnotationWorkbench.vue')
const QualityReview = () => import('@/pages/QualityReview.vue')
const UserManagement = () => import('@/pages/UserManagement.vue')
const Statistics = () => import('@/pages/Statistics.vue')
const ScoreRanking = () => import('@/pages/ScoreRanking.vue')
const FormDesigner = () => import('@/pages/FormDesigner.vue')
const DataManagement = () => import('@/pages/DataManagement.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: Dashboard,
        meta: { title: '仪表板' }
      },
      {
        path: 'files',
        name: 'FileManagement',
        component: FileManagement,
        meta: { title: '文件管理', roles: ['admin', 'annotator', 'reviewer', 'expert'] }
      },
      {
        path: 'categories',
        name: 'CategoryManagement',
        component: CategoryManagement,
        meta: { title: '类别管理', roles: ['admin'] }
      },
      {
        path: 'tasks',
        name: 'TaskManagement',
        component: TaskManagement,
        meta: { title: '任务管理', roles: ['admin'] }
      },
      {
        path: 'my-tasks',
        name: 'MyTasks',
        component: MyTasks,
        meta: { title: '我的任务', roles: ['admin', 'annotator', 'reviewer', 'expert'] }
      },
      {
        path: 'annotation/:taskId',
        name: 'AnnotationWorkbench',
        component: AnnotationWorkbench,
        meta: { title: '标注工作台', roles: ['admin', 'annotator', 'reviewer', 'expert'] }
      },
      {
        path: 'quality-review',
        name: 'QualityReview',
        component: QualityReview,
        meta: { title: '质量审核', roles: ['admin', 'reviewer', 'expert'] }
      },
      {
        path: 'users',
        name: 'UserManagement',
        component: UserManagement,
        meta: { title: '用户管理', roles: ['admin'] }
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: Statistics,
        meta: { title: '统计分析', roles: ['admin'] }
      },
      {
        path: 'score-ranking',
        name: 'ScoreRanking',
        component: ScoreRanking,
        meta: { title: '积分排行', roles: ['admin', 'annotator', 'reviewer', 'expert'] }
      },
      {
        path: 'form-designer/:id?',
        name: 'FormDesigner',
        component: FormDesigner,
        meta: { title: '表单设计器', roles: ['admin'] }
      },
      {
        path: 'data-management',
        name: 'DataManagement',
        component: DataManagement,
        meta: { title: '数据管理', roles: ['admin', 'annotator', 'reviewer', 'expert'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')

  // 需要认证的页面
  if (to.meta.requiresAuth !== false) {
    if (!token || !userStr) {
      next('/login')
      return
    }

    // 检查角色权限
    const user = JSON.parse(userStr)
    const allowedRoles = to.meta.roles as string[] | undefined
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      next('/')
      return
    }
  }

  // 已登录用户访问登录页，重定向到首页
  if (to.path === '/login' && token) {
    next('/')
    return
  }

  next()
})

export default router

