import React from 'react'
import { Table, Empty, Card, Row, Col, Typography, Space, Image, Tag } from 'antd'
import {
  FolderOpenOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  EyeOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import type { Document } from '../../store/slices/fileSlice'
import type { Folder } from '../../services/api'

const { Text } = Typography

interface FileExplorerViewProps {
  viewMode: 'list' | 'grid'
  folders: Folder[]
  documents: Document[]
  selectedKeys: React.Key[]
  onSelect: (keys: React.Key[]) => void
  onEnterFolder: (folderId: number) => void
  onPreview?: (document: Document) => void
  onDownload?: (document: Document) => void
  onEditCategory?: (document: Document) => void
  onEditDocumentType?: (document: Document) => void
  onEditPriority?: (document: Document) => void
  onViewTemplateFields?: (document: Document) => void
  onViewAnnotation?: (document: Document) => void
  onDelete?: (document: Document) => void
  onDeleteFolder?: (folder: Folder) => void
  canDelete?: boolean
  loading?: boolean
}

const FileExplorerView: React.FC<FileExplorerViewProps> = ({
  viewMode,
  folders,
  documents,
  selectedKeys,
  onSelect,
  onEnterFolder,
  onPreview,
  onDownload,
  onEditCategory,
  onEditDocumentType,
  onEditPriority,
  onViewTemplateFields,
  onViewAnnotation,
  onDelete,
  onDeleteFolder,
  canDelete = false,
  loading = false
}) => {
  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileTextOutlined />
    if (mimeType === 'application/pdf') return <FilePdfOutlined style={{ color: '#ff4d4f' }} />
    if (mimeType.startsWith('image/')) return <FileImageOutlined style={{ color: '#52c41a' }} />
    return <FileTextOutlined />
  }

  const formatSize = (size?: number) => {
    if (!size || size === 0) return '-'
    const mbSize = size / 1024 / 1024
    if (mbSize < 1) {
      return `${(size / 1024).toFixed(1)} KB`
    }
    return `${mbSize.toFixed(2)} MB`
  }

  const formatDate = (date?: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('zh-CN')
  }

  // List View
  const listColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: any, record: any) => {
        if (record.type === 'folder') {
          return (
            <Space>
              <FolderOpenOutlined style={{ color: '#1890ff', fontSize: 16 }} />
              <Text
                style={{ cursor: 'pointer' }}
                onClick={() => onEnterFolder(record.id)}
              >
                {record.name}
              </Text>
            </Space>
          )
        }
        return (
          <Space>
            {getFileIcon(record.mimeType)}
            <Text>{record.name}</Text>
          </Space>
        )
      },
      ellipsis: true,
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 120,
      render: (size: number | undefined, record: any) => {
        if (record.type === 'folder') return '-'
        return formatSize(size)
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string | undefined, record: any) => {
        if (record.type === 'folder') return '-'
        const priorityMap: Record<string, { color: string; text: string }> = {
          LOW: { color: 'default', text: '低' },
          NORMAL: { color: 'blue', text: '普通' },
          HIGH: { color: 'orange', text: '高' },
          URGENT: { color: 'red', text: '紧急' }
        }
        const priorityInfo = priorityMap[priority || 'NORMAL'] || priorityMap.NORMAL
        return <Tag color={priorityInfo.color}>{priorityInfo.text}</Tag>
      },
    },
    {
      title: '修改日期',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 180,
      render: (date: string | undefined, record: any) => {
        return formatDate(date || record.createdAt)
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => {
        if (record.type === 'folder') {
          return canDelete && onDeleteFolder ? (
            <Space size="small">
              <Text
                type="danger"
                style={{ cursor: 'pointer' }}
                onClick={() => onDeleteFolder?.(record)}
              >
                删除
              </Text>
            </Space>
          ) : null
        }
        return (
          <Space size="small" wrap>
            {onPreview && (
              <Text
                type="link"
                onClick={() => onPreview(record)}
                style={{ fontSize: 12 }}
              >
                预览
              </Text>
            )}
            {onDownload && (
              <Text
                type="link"
                onClick={() => onDownload(record)}
                style={{ fontSize: 12 }}
              >
                下载
              </Text>
            )}
            {onEditDocumentType && (
              <Text
                type="link"
                onClick={() => onEditDocumentType(record)}
                style={{ fontSize: 12 }}
              >
                类型
              </Text>
            )}
            {onEditPriority && (
              <Text
                type="link"
                onClick={() => onEditPriority(record)}
                style={{ fontSize: 12 }}
              >
                优先级
              </Text>
            )}
            {onViewTemplateFields && record.documentType && (
              <Text
                type="link"
                onClick={() => onViewTemplateFields(record)}
                style={{ fontSize: 12 }}
              >
                模版
              </Text>
            )}
            {onViewAnnotation && (
              <Text
                type="link"
                onClick={() => onViewAnnotation(record)}
                style={{ fontSize: 12 }}
              >
                标注
              </Text>
            )}
            {canDelete && onDelete && (
              <Text
                type="danger"
                style={{ cursor: 'pointer', fontSize: 12 }}
                onClick={() => onDelete(record)}
              >
                删除
              </Text>
            )}
          </Space>
        )
      },
    },
  ]

  // Grid View
  const renderGridItem = (item: any) => {
    const isFolder = item.type === 'folder'
    const isSelected = selectedKeys.includes(item.key)

    return (
      <Col key={item.id} xs={6} sm={4} md={3} lg={2} xl={2}>
        <Card
          hoverable
          size="small"
          style={{
            textAlign: 'center',
            cursor: 'pointer',
            border: isSelected ? '2px solid #1890ff' : '1px solid #e8e8e8',
            marginBottom: 8,
            backgroundColor: isSelected ? '#e6f7ff' : '#fff'
          }}
          onClick={(e) => {
            // Handle selection on click
            e.stopPropagation()
            const newKeys = isSelected
              ? selectedKeys.filter(k => k !== item.key)
              : [...selectedKeys, item.key]
            onSelect(newKeys)
          }}
          onDoubleClick={() => {
            // Double click to open folder or preview document
            if (isFolder) {
              onEnterFolder(item.id)
            } else if (onPreview) {
              onPreview(item)
            }
          }}
          bodyStyle={{ padding: '12px 8px' }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>
            {isFolder ? (
              <FolderOpenOutlined style={{ color: '#1890ff' }} />
            ) : (
              getFileIcon(item.mimeType)
            )}
          </div>
          <Text
            ellipsis
            style={{
              fontSize: 12,
              display: 'block',
              wordBreak: 'break-word'
            }}
          >
            {item.name}
          </Text>
          {!isFolder && item.fileSize && (
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
              {formatSize(item.fileSize)}
            </Text>
          )}
        </Card>
      </Col>
    )
  }

  // Combine folders and documents
  const allItems = [
    ...folders.map(f => ({ ...f, type: 'folder', name: f.name, key: `folder-${f.id}` })),
    ...documents.map(d => ({ ...d, type: 'file', name: d.filename, key: `file-${d.id}` }))
  ]

  if (loading) {
    return <Empty description="加载中..." />
  }

  if (allItems.length === 0) {
    return <Empty description="当前文件夹为空" />
  }

  if (viewMode === 'list') {
    return (
      <Table
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: onSelect,
        }}
        columns={listColumns}
        dataSource={allItems}
        rowKey="key"
        pagination={false}
        size="small"
        style={{ background: '#fff' }}
      />
    )
  }

  return (
    <div style={{ padding: 16, background: '#fff', minHeight: 400 }}>
      <Row gutter={[8, 8]}>
        {allItems.map(renderGridItem)}
      </Row>
    </div>
  )
}

export default FileExplorerView

