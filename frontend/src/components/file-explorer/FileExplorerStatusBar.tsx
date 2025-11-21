import React from 'react'
import { Space, Typography } from 'antd'
import { FileTextOutlined, FolderOutlined } from '@ant-design/icons'

const { Text } = Typography

interface FileExplorerStatusBarProps {
  totalItems?: number
  selectedCount?: number
  totalSize?: number
  folderCount?: number
  fileCount?: number
}

const FileExplorerStatusBar: React.FC<FileExplorerStatusBarProps> = ({
  totalItems = 0,
  selectedCount = 0,
  totalSize,
  folderCount = 0,
  fileCount = 0
}) => {
  const formatSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '-'
    const mbSize = bytes / 1024 / 1024
    if (mbSize < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${mbSize.toFixed(2)} MB`
  }

  return (
    <div style={{
      background: '#f5f5f5',
      borderTop: '1px solid #e8e8e8',
      padding: '4px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 28,
      fontSize: 12
    }}>
      <Space size="middle">
        {selectedCount > 0 ? (
          <Text type="secondary">
            {selectedCount} 个项目已选中
          </Text>
        ) : (
          <Text type="secondary">
            {totalItems} 个项目
          </Text>
        )}
        {folderCount > 0 && (
          <Space size={4}>
            <FolderOutlined style={{ color: '#1890ff' }} />
            <Text type="secondary">{folderCount} 个文件夹</Text>
          </Space>
        )}
        {fileCount > 0 && (
          <Space size={4}>
            <FileTextOutlined style={{ color: '#52c41a' }} />
            <Text type="secondary">{fileCount} 个文件</Text>
          </Space>
        )}
      </Space>
      {totalSize && (
        <Text type="secondary">
          总大小: {formatSize(totalSize)}
        </Text>
      )}
    </div>
  )
}

export default FileExplorerStatusBar

