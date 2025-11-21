import { useState } from 'react'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setUser, setLoading, setError } from '../store/slices/userSlice'
import { authService, LoginResponse } from '../services/api'

const { Title } = Typography

interface LoginForm {
  username: string
  password: string
}

const Login = () => {
  const [form] = Form.useForm()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleSubmit = async (values: LoginForm) => {
    dispatch(setLoading(true))

    try {
      // 后端测试环境密码统一为"password"
      const loginData = {
        username: values.username,
        password: 'password' // 所有用户统一使用password作为密码
      }

      const response: LoginResponse = await authService.login(loginData)

      // 保存token到localStorage
      localStorage.setItem('token', response.token)

      // 转换role字符串为正确的类型
      const roleMap: { [key: string]: 'admin' | 'annotator' | 'reviewer' | 'expert' } = {
        'ADMIN': 'admin',
        'ANNOTATOR': 'annotator',
        'REVIEWER': 'reviewer',
        'EXPERT': 'expert'
      }

      const user = {
        id: response.id,
        username: response.username,
        email: response.email,
        role: roleMap[response.role] || 'annotator',
        score: response.score,
      }

      // 保存用户信息到localStorage
      localStorage.setItem('user', JSON.stringify(user))

      dispatch(setUser(user))
      message.success('登录成功')
      navigate('/')
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '登录失败'
      dispatch(setError(errorMessage))
      message.error(errorMessage)
    } finally {
      dispatch(setLoading(false))
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 24 }}>
          数据标注平台
        </Title>
        <div style={{ textAlign: 'center', marginBottom: 16, color: '#666', fontSize: '14px' }}>
          测试环境：所有用户密码均为 <strong>password</strong>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <p>测试账号：<br />
            管理员: admin/password<br />
            标注员: annotator/password
          </p>
        </div>
      </Card>
    </div>
  )
}

export default Login
