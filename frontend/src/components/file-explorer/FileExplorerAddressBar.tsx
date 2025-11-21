import React, { useState } from 'react'
import { Breadcrumb, Input, Space } from 'antd'
import { HomeOutlined, FolderOpenOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'

export interface BreadcrumbItem {
  id: number | null
  name: string
}

interface FileExplorerAddressBarProps {
  items: BreadcrumbItem[]
  onNavigate?: (folderId: number | null) => void
  onPathChange?: (path: string) => void
}

const FileExplorerAddressBar: React.FC<FileExplorerAddressBarProps> = ({
  items,
  onNavigate,
  onPathChange
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editPath, setEditPath] = useState('')

  const handleEdit = () => {
    const path = items.length > 0
      ? items.map(item => item.name).join(' > ')
      : '根目录'
    setEditPath(path)
    setIsEditing(true)
  }

  const handleConfirm = () => {
    setIsEditing(false)
    if (onPathChange && editPath.trim()) {
      onPathChange(editPath.trim())
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditPath('')
  }

  const breadcrumbItems = [
    {
      title: (
        <span onClick={() => onNavigate?.(null)} style={{ cursor: 'pointer' }}>
          <HomeOutlined style={{ marginRight: 4 }} />
          根目录
        </span>
      ),
    },
    ...items.map(folder => ({
      title: (
        <span onClick={() => onNavigate?.(folder.id)} style={{ cursor: 'pointer' }}>
          <FolderOpenOutlined style={{ marginRight: 4 }} />
          {folder.name}
        </span>
      ),
    })),
  ]

  if (isEditing) {
    return (
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <Input
          value={editPath}
          onChange={(e) => setEditPath(e.target.value)}
          onPressEnter={handleConfirm}
          autoFocus
          style={{ flex: 1 }}
          suffix={
            <Space size="small">
              <CheckOutlined
                onClick={handleConfirm}
                style={{ cursor: 'pointer', color: '#52c41a' }}
              />
              <CloseOutlined
                onClick={handleCancel}
                style={{ cursor: 'pointer', color: '#ff4d4f' }}
              />
            </Space>
          }
        />
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff',
      borderBottom: '1px solid #e8e8e8',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }}>
      <Breadcrumb
        separator=">"
        items={breadcrumbItems}
        style={{ flex: 1 }}
      />
      <EditOutlined
        onClick={handleEdit}
        style={{ cursor: 'pointer', color: '#1890ff' }}
      />
    </div>
  )
}

export default FileExplorerAddressBar

