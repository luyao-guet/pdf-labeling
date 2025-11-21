import React from 'react'
import { Card, Empty, Popconfirm, Typography, Input, Button, Space, Table, Tooltip } from 'antd'
import { FolderOpenOutlined, DeleteOutlined, FolderAddOutlined, EditOutlined, SwapOutlined } from '@ant-design/icons'
import type { Folder } from '../../services/api'

interface FolderGridProps {
  folders: Folder[]
  onEnterFolder: (folderId: number) => void
  onDeleteFolder?: (folderId: number) => void
  canDelete?: boolean
  canRename?: boolean
  allowInlineCreate?: boolean
  isInlineCreating?: boolean
  inlineFolderName?: string
  inlineCreateSubmitting?: boolean
  onInlineCreateStart?: () => void
  onInlineCreateNameChange?: (value: string) => void
  onInlineCreateCancel?: () => void
  onInlineCreateSubmit?: () => void
  renamingFolderId?: number | null
  renamingFolderName?: string
  renameSubmitting?: boolean
  onRenameStart?: (folder: Folder) => void
  onRenameNameChange?: (value: string) => void
  onRenameCancel?: () => void
  onRenameSubmit?: () => void
  showMoveAction?: boolean
  onMoveStart?: (folder: Folder) => void
}

const FolderGrid: React.FC<FolderGridProps> = ({
  folders,
  onEnterFolder,
  onDeleteFolder,
  canDelete,
  canRename,
  allowInlineCreate,
  isInlineCreating,
  inlineFolderName,
  inlineCreateSubmitting,
  onInlineCreateStart,
  onInlineCreateNameChange,
  onInlineCreateCancel,
  onInlineCreateSubmit,
  renamingFolderId,
  renamingFolderName,
  renameSubmitting,
  onRenameStart,
  onRenameNameChange,
  onRenameCancel,
  onRenameSubmit,
  showMoveAction,
  onMoveStart
}) => {
  const handleDeleteFolder = (folderId: number, e?: React.MouseEvent<HTMLElement>) => {
    e?.stopPropagation()
    onDeleteFolder?.(folderId)
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: any, record: Folder) => {
        const isRenaming = renamingFolderId === record.id
        if (isRenaming) {
          return (
            <Input
              autoFocus
              value={renamingFolderName}
              placeholder="输入新的文件夹名称"
              onChange={(e) => onRenameNameChange?.(e.target.value)}
              onPressEnter={(e) => {
                e.preventDefault()
                onRenameSubmit?.()
              }}
            />
          )
        }
        return (
          <Space size="small">
            <FolderOpenOutlined style={{ color: '#1890ff' }} />
            <Typography.Link onClick={() => onEnterFolder(record.id)}>
              {record.name}
            </Typography.Link>
          </Space>
        )
      }
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      render: (path: string | undefined) => (
        <Typography.Text type="secondary" ellipsis style={{ maxWidth: 260 }}>
          {path || '-'}
        </Typography.Text>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string | undefined) => date ? new Date(date).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: Folder) => {
        const isRenaming = renamingFolderId === record.id
        return (
          <Space size="small">
            {isRenaming ? (
              <>
                <Button
                  type="primary"
                  size="small"
                  loading={renameSubmitting}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRenameSubmit?.()
                  }}
                >
                  保存
                </Button>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRenameCancel?.()
                  }}
                >
                  取消
                </Button>
              </>
            ) : (
              <>
                {canRename && (
                  <Tooltip title="重命名">
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRenameStart?.(record)
                      }}
                    />
                  </Tooltip>
                )}
                {showMoveAction && (
                  <Tooltip title="移动">
                    <Button
                      size="small"
                      icon={<SwapOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        onMoveStart?.(record)
                      }}
                    />
                  </Tooltip>
                )}
                {canDelete && onDeleteFolder && (
                  <Popconfirm
                    title={`确认删除文件夹 "${record.name}"？`}
                    description="将删除文件夹及其所有内容，操作不可恢复。"
                    onConfirm={(e) => handleDeleteFolder(record.id, e)}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                )}
              </>
            )}
          </Space>
        )
      }
    }
  ]

  return (
    <Card title="子文件夹" style={{ marginBottom: 24 }}>
      {allowInlineCreate && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          {isInlineCreating ? (
            <>
              <Input
                placeholder="输入文件夹名称"
                value={inlineFolderName}
                onChange={(e) => onInlineCreateNameChange?.(e.target.value)}
                onPressEnter={(e) => {
                  e.preventDefault()
                  onInlineCreateSubmit?.()
                }}
              />
              <Space>
                <Button
                  type="primary"
                  icon={<FolderAddOutlined />}
                  loading={inlineCreateSubmitting}
                  onClick={() => onInlineCreateSubmit?.()}
                >
                  创建
                </Button>
                <Button onClick={() => onInlineCreateCancel?.()}>取消</Button>
              </Space>
            </>
          ) : (
            <Button
              type="dashed"
              icon={<FolderAddOutlined />}
              onClick={() => onInlineCreateStart?.()}
            >
              新建文件夹
            </Button>
          )}
        </div>
      )}

      {folders && folders.length > 0 ? (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={folders}
          pagination={false}
          size="small"
        />
      ) : (
        <Empty description="当前目录暂无子文件夹" />
      )}
    </Card>
  )
}

export default FolderGrid

