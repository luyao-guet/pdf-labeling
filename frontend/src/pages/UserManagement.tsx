import { Table, Button, Modal, Form, Input, Select, message, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, LockOutlined } from '@ant-design/icons'
import { useState } from 'react'

const { Option } = Select

interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'annotator' | 'reviewer' | 'expert' | 'ai_annotator'
  score: number
  status: 'active' | 'inactive'
}

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([
    { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', score: 100, status: 'active' },
    { id: 2, username: 'annotator1', email: 'annotator1@example.com', role: 'annotator', score: 85, status: 'active' },
    { id: 3, username: 'annotator2', email: 'annotator2@example.com', role: 'annotator', score: 78, status: 'active' },
    { id: 4, username: 'reviewer1', email: 'reviewer1@example.com', role: 'reviewer', score: 92, status: 'active' },
    { id: 5, username: 'expert1', email: 'expert1@example.com', role: 'expert', score: 95, status: 'active' },
    { id: 6, username: 'ai_model_1', email: 'ai1@example.com', role: 'ai_annotator', score: 0, status: 'active' },
  ])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm()

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleMap = {
          admin: <Tag color="red">管理员</Tag>,
          annotator: <Tag color="blue">标注员</Tag>,
          reviewer: <Tag color="orange">检查员</Tag>,
          expert: <Tag color="purple">专家</Tag>,
          ai_annotator: <Tag color="cyan">AI标注员</Tag>,
        }
        return roleMap[role as keyof typeof roleMap] || <Tag>{role}</Tag>
      },
    },
    {
      title: '积分',
      dataIndex: 'score',
      key: 'score',
      sorter: (a: User, b: User) => a.score - b.score,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '正常' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<LockOutlined />}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue(user)
    setIsModalVisible(true)
  }

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    setUsers(users.map(u =>
      u.id === user.id
        ? { ...u, status: newStatus }
        : u
    ))
    message.success(`${newStatus === 'active' ? '启用' : '禁用'}成功`)
  }

  const handleModalOk = () => {
    form.validateFields().then(values => {
      if (editingUser) {
        // 编辑
        setUsers(users.map(u =>
          u.id === editingUser.id
            ? { ...u, ...values }
            : u
        ))
        message.success('编辑成功')
      } else {
        // 新增
        const newUser: User = {
          id: Math.max(...users.map(u => u.id)) + 1,
          ...values,
          score: 0,
          status: 'active',
        }
        setUsers([...users, newUser])
        message.success('添加成功')
      }
      setIsModalVisible(false)
      form.resetFields()
    })
  }

  const handleModalCancel = () => {
    setIsModalVisible(false)
    form.resetFields()
  }

  return (
    <div>
      <h2>用户管理</h2>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ marginBottom: 16 }}
      >
        添加用户
      </Button>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="选择用户角色">
              <Option value="admin">管理员</Option>
              <Option value="annotator">标注员</Option>
              <Option value="reviewer">检查员</Option>
              <Option value="expert">专家</Option>
              <Option value="ai_annotator">AI标注员</Option>
            </Select>
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="初始密码"
              rules={[{ required: true, message: '请输入初始密码' }]}
            >
              <Input.Password />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default UserManagement
