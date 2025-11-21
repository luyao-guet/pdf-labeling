import React from 'react'
import { Button, Dropdown, Popconfirm, Space, Tag, Tooltip, Upload, Typography } from 'antd'
import type { UploadProps } from 'antd'
import { FolderAddOutlined, UploadOutlined, FolderOpenOutlined, ArrowUpOutlined, InboxOutlined, DeleteOutlined } from '@ant-design/icons'

interface FolderToolbarProps {
  currentFolderName: string
  uploadProps: UploadProps
  folderUploadProps: UploadProps
  uploadingFolder: boolean
  uploadProgress?: Record<string, number>
  onCreateFolder: () => void
  onGoUp?: () => void
  canGoUp?: boolean
  enableBatchDelete?: boolean
  selectedRowCount?: number
  onBatchDelete?: () => void
  helpContent?: React.ReactNode
}

const defaultHelpContent = (
  <div style={{ padding: 8 }}>
    <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
      支持功能：
    </div>
    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
      • 使用左侧目录树切换文件夹<br />
      • 支持上传 PDF、JPG、PNG 格式的文件<br />
      • 单个或批量上传文件到当前文件夹<br />
      • 上传文件夹：选择整个文件夹，系统会自动筛选其中的 PDF、JPG、PNG 文件<br />
      • 文件自动保存到当前目录中<br />
      • 支持文档预览和下载<br />
      • 可编辑文档分类
    </div>
  </div>
)

const FolderToolbar: React.FC<FolderToolbarProps> = ({
  currentFolderName,
  uploadProps,
  folderUploadProps,
  uploadingFolder,
  uploadProgress,
  onCreateFolder,
  onGoUp,
  canGoUp,
  enableBatchDelete,
  selectedRowCount = 0,
  onBatchDelete,
  helpContent = defaultHelpContent
}) => {
  const activeUploads = Object.keys(uploadProgress || {}).length

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
      <Space align="center" size="middle">
        <div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>当前位置</div>
          <Tag color="blue" style={{ marginTop: 4 }}>
            {currentFolderName}
          </Tag>
        </div>
        {onGoUp && (
          <Tooltip title="返回上级">
            <Button
              type="link"
              icon={<ArrowUpOutlined />}
              onClick={onGoUp}
              disabled={!canGoUp}
            >
              返回上级
            </Button>
          </Tooltip>
        )}
        {activeUploads > 0 && (
          <Typography.Text type="secondary">
            正在上传 {activeUploads} 个文件…
          </Typography.Text>
        )}
      </Space>

      <Space wrap>
        <Button
          icon={<FolderAddOutlined />}
          onClick={onCreateFolder}
        >
          创建文件夹
        </Button>

        <Upload {...uploadProps}>
          <Button
            icon={<UploadOutlined />}
            type="primary"
          >
            上传文件
          </Button>
        </Upload>

        <Upload {...folderUploadProps}>
          <Button
            icon={<FolderOpenOutlined />}
            loading={uploadingFolder}
            disabled={uploadingFolder}
          >
            {uploadingFolder ? '上传中...' : '上传文件夹'}
          </Button>
        </Upload>

        <Dropdown
          menu={{ items: [{ key: 'help', label: helpContent }] }}
          placement="bottomRight"
          trigger={['hover']}
        >
          <Button icon={<InboxOutlined />}>
            帮助
          </Button>
        </Dropdown>

        {enableBatchDelete && onBatchDelete && (
          <Tooltip title={selectedRowCount === 0 ? '先选择要删除的文档' : undefined}>
            <Popconfirm
              title="确认批量删除"
              description={`确定要删除选中的 ${selectedRowCount} 个文档吗？`}
              onConfirm={onBatchDelete}
              okText="确定"
              cancelText="取消"
              disabled={selectedRowCount === 0}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowCount === 0}
              >
                批量删除 ({selectedRowCount})
              </Button>
            </Popconfirm>
          </Tooltip>
        )}
      </Space>
    </div>
  )
}

export default FolderToolbar

