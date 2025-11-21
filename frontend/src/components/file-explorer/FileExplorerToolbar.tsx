import React from 'react'
import { Button, Space, Tooltip, Divider, Upload, Dropdown, Popconfirm } from 'antd'
import type { UploadProps } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  UpOutlined,
  ReloadOutlined,
  FolderAddOutlined,
  UploadOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  CopyOutlined,
  ScissorOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  SearchOutlined,
  MoreOutlined,
  PlusCircleOutlined
} from '@ant-design/icons'

interface FileExplorerToolbarProps {
  // Navigation
  canGoBack?: boolean
  canGoForward?: boolean
  canGoUp?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
  onGoUp?: () => void
  onRefresh?: () => void

  // View mode
  viewMode?: 'list' | 'grid'
  onViewModeChange?: (mode: 'list' | 'grid') => void

  // Actions
  onCreateFolder?: () => void
  uploadProps?: UploadProps
  folderUploadProps?: UploadProps
  uploadingFolder?: boolean
  enableBatchDelete?: boolean
  selectedCount?: number
  onBatchDelete?: () => void
  onBatchCreateTasks?: () => void
  onSearch?: (value: string) => void

  // Selection actions
  canCopy?: boolean
  canCut?: boolean
  canPaste?: boolean
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
}

const FileExplorerToolbar: React.FC<FileExplorerToolbarProps> = ({
  canGoBack = false,
  canGoForward = false,
  canGoUp = false,
  onGoBack,
  onGoForward,
  onGoUp,
  onRefresh,
  viewMode = 'list',
  onViewModeChange,
  onCreateFolder,
  uploadProps,
  folderUploadProps,
  uploadingFolder = false,
  enableBatchDelete = false,
  selectedCount = 0,
  onBatchDelete,
  onBatchCreateTasks,
  onSearch,
  canCopy = false,
  canCut = false,
  canPaste = false,
  onCopy,
  onCut,
  onPaste
}) => {
  return (
    <div style={{
      background: '#fff',
      borderBottom: '1px solid #e8e8e8',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }}>
      {/* Navigation Group */}
      <Space size="small" style={{ marginRight: 16 }}>
        <Tooltip title="后退">
          <Button
            type="text"
            icon={<LeftOutlined />}
            disabled={!canGoBack}
            onClick={onGoBack}
            size="small"
          />
        </Tooltip>
        <Tooltip title="前进">
          <Button
            type="text"
            icon={<RightOutlined />}
            disabled={!canGoForward}
            onClick={onGoForward}
            size="small"
          />
        </Tooltip>
        <Tooltip title="向上">
          <Button
            type="text"
            icon={<UpOutlined />}
            disabled={!canGoUp}
            onClick={onGoUp}
            size="small"
          />
        </Tooltip>
        <Divider type="vertical" style={{ margin: '0 4px' }} />
        <Tooltip title="刷新">
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            size="small"
          />
        </Tooltip>
      </Space>

      {/* Actions Group */}
      <Space size="small" style={{ marginRight: 16 }}>
        <Tooltip title="新建文件夹">
          <Button
            type="text"
            icon={<FolderAddOutlined />}
            onClick={onCreateFolder}
            size="small"
          >
            新建
          </Button>
        </Tooltip>
        {uploadProps && (
          <Upload {...uploadProps}>
            <Tooltip title="上传文件">
              <Button
                type="text"
                icon={<UploadOutlined />}
                size="small"
              >
                上传
              </Button>
            </Tooltip>
          </Upload>
        )}
        {folderUploadProps && (
          <Upload {...folderUploadProps}>
            <Tooltip title="上传文件夹">
              <Button
                type="text"
                icon={<FolderOpenOutlined />}
                loading={uploadingFolder}
                disabled={uploadingFolder}
                size="small"
              >
                上传文件夹
              </Button>
            </Tooltip>
          </Upload>
        )}
      </Space>

      {/* Selection Actions Group */}
      {(canCopy || canCut || canPaste) && (
        <>
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          <Space size="small" style={{ marginRight: 16 }}>
            <Tooltip title="复制">
              <Button
                type="text"
                icon={<CopyOutlined />}
                disabled={!canCopy}
                onClick={onCopy}
                size="small"
              />
            </Tooltip>
            <Tooltip title="剪切">
              <Button
                type="text"
                icon={<ScissorOutlined />}
                disabled={!canCut}
                onClick={onCut}
                size="small"
              />
            </Tooltip>
            <Tooltip title="粘贴">
              <Button
                type="text"
                icon={<FileTextOutlined />}
                disabled={!canPaste}
                onClick={onPaste}
                size="small"
              />
            </Tooltip>
          </Space>
        </>
      )}

      {/* Batch Create Tasks Action */}
      {onBatchCreateTasks && (
        <>
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          <Tooltip title="生成标注任务">
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              disabled={selectedCount === 0}
              onClick={onBatchCreateTasks}
              size="small"
            >
              生成标注任务 ({selectedCount})
            </Button>
          </Tooltip>
        </>
      )}

      {/* Delete Action */}
      {enableBatchDelete && onBatchDelete && (
        <>
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          <Popconfirm
            title="确认删除"
            description={`确定要删除选中的 ${selectedCount} 个项目吗？`}
            onConfirm={onBatchDelete}
            okText="确定"
            cancelText="取消"
            disabled={selectedCount === 0}
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={selectedCount === 0}
                size="small"
              >
                删除 ({selectedCount})
              </Button>
            </Tooltip>
          </Popconfirm>
        </>
      )}

      {/* View Mode Toggle */}
      <div style={{ flex: 1 }} />
      <Space size="small">
        <Tooltip title="列表视图">
          <Button
            type={viewMode === 'list' ? 'primary' : 'text'}
            icon={<UnorderedListOutlined />}
            onClick={() => onViewModeChange?.('list')}
            size="small"
          />
        </Tooltip>
        <Tooltip title="图标视图">
          <Button
            type={viewMode === 'grid' ? 'primary' : 'text'}
            icon={<AppstoreOutlined />}
            onClick={() => onViewModeChange?.('grid')}
            size="small"
          />
        </Tooltip>
        {onSearch && (
          <>
            <Divider type="vertical" style={{ margin: '0 4px' }} />
            <Tooltip title="搜索">
              <Button
                type="text"
                icon={<SearchOutlined />}
                onClick={() => onSearch?.('')}
                size="small"
              />
            </Tooltip>
          </>
        )}
      </Space>
    </div>
  )
}

export default FileExplorerToolbar

