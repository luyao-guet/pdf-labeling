import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, message, Space, Popconfirm, Tree, Card, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { Category, setCategories, addCategory, updateCategory, removeCategory, setLoading, setError } from '../store/slices/categorySlice'
import { categoryService } from '../services/api'

interface CategoryFormData {
  name: string
  description?: string
  parentId?: number
}

interface CategoryWithStats extends Category {
  documentCount?: number
  subcategoryCount?: number
}

const CategoryManagement = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { categories, loading } = useSelector((state: RootState) => state.category)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryStats, setCategoryStats] = useState<Record<number, { documentCount: number; subcategoryCount: number }>>({})
  const [form] = Form.useForm<CategoryFormData>()

  // Load initial data
  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      dispatch(setLoading(true))
      const result = await categoryService.getCategories()
      dispatch(setCategories(result.categories))

      // Load stats for each category
      const stats: Record<number, { documentCount: number; subcategoryCount: number }> = {}
      for (const category of result.categories) {
        try {
          const categoryStats = await categoryService.getCategoryStats(category.id)
          stats[category.id] = categoryStats
        } catch (error) {
          console.error(`Failed to load stats for category ${category.id}:`, error)
        }
      }
      setCategoryStats(stats)
    } catch (error: any) {
      dispatch(setError(error.message || '加载分类失败'))
      message.error('加载分类失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleAdd = () => {
    setEditingCategory(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    form.setFieldsValue({
      name: category.name,
      description: category.description,
      parentId: category.parentId,
    })
    setIsModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await categoryService.deleteCategory(id)
      dispatch(removeCategory(id))
      message.success('分类删除成功')
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败')
    }
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      if (editingCategory) {
        // 编辑分类
        const result = await categoryService.updateCategory(editingCategory.id, values)
        dispatch(updateCategory(result.category))
        message.success(result.message)
      } else {
        // 新增分类
        const result = await categoryService.createCategory(values)
        dispatch(addCategory(result.category))
        message.success(result.message)
      }

      setIsModalVisible(false)
      form.resetFields()
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.message || '操作失败')
      } else {
        message.error('操作失败')
      }
    }
  }

  const handleModalCancel = () => {
    setIsModalVisible(false)
    form.resetFields()
  }

  // Convert categories to tree data for display
  const buildTreeData = (categories: Category[]): any[] => {
    const categoryMap = new Map<number, Category & { children?: any[]; documentCount?: number; subcategoryCount?: number }>()
    const rootCategories: any[] = []

    // First pass: create all category objects
    categories.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        key: cat.id,
        title: cat.name,
        children: [],
        documentCount: categoryStats[cat.id]?.documentCount || 0,
        subcategoryCount: categoryStats[cat.id]?.subcategoryCount || 0,
      })
    })

    // Second pass: build tree structure
    categories.forEach(cat => {
      const categoryNode = categoryMap.get(cat.id)!
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId)
        if (parent) {
          parent.children!.push(categoryNode)
        }
      } else {
        rootCategories.push(categoryNode)
      }
    })

    return rootCategories
  }

  const treeData = buildTreeData(categories)

  const columns = [
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '层级',
      dataIndex: 'level',
      key: 'level',
      width: 80,
    },
    {
      title: '文档数量',
      key: 'documentCount',
      render: (_: any, record: Category) => categoryStats[record.id]?.documentCount || 0,
      width: 100,
    },
    {
      title: '子分类数量',
      key: 'subcategoryCount',
      render: (_: any, record: Category) => categoryStats[record.id]?.subcategoryCount || 0,
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Category) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个分类吗？删除后不可恢复。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
      width: 120,
    },
  ]

  return (
    <div style={{ padding: '24px 0' }}>
      <Card
        title="分类管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加分类
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card
              title="分类树状结构"
              size="small"
              style={{ height: '100%', minHeight: 400 }}
            >
              <Tree
                treeData={treeData}
                defaultExpandAll
                showLine
                titleRender={(node: any) => (
                  <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {node.name}
                    </div>
                    {node.description && (
                      <div style={{ color: '#666', fontSize: '12px', marginBottom: 4 }}>
                        {node.description}
                      </div>
                    )}
                    <div style={{ color: '#1890ff', fontSize: '12px' }}>
                      文档: {node.documentCount} | 子类: {node.subcategoryCount}
                    </div>
                  </div>
                )}
              />
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card
              title="分类列表"
              size="small"
              style={{ height: '100%', minHeight: 400 }}
            >
              <Table
                columns={columns}
                dataSource={categories}
                loading={loading}
                rowKey="id"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                }}
                scroll={{ x: 800 }}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Modal
        title={editingCategory ? '编辑分类' : '添加分类'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入分类描述（可选）"
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="parentId"
            label="父分类"
            extra="输入父分类ID创建子分类，可留空创建顶级分类"
          >
            <Input
              type="number"
              placeholder="输入父分类ID（可选）"
              min={1}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CategoryManagement
