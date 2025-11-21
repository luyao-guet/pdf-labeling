import { useMemo } from 'react'
import { Card, Input, Button, Tooltip, Empty } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { TreeProps } from 'antd/es/tree'
import FolderTree, { FolderTreeNode } from './FolderTree'

interface FolderTreePanelProps {
  treeData: FolderTreeNode[]
  selectedKeys: React.Key[]
  onSelect: TreeProps['onSelect']
  onLoadData: TreeProps['loadData']
  onRefresh?: () => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  expandedKeys?: React.Key[]
  autoExpandParent?: boolean
  onExpand?: TreeProps['onExpand']
  isSearching?: boolean
  titleRender?: (node: FolderTreeNode) => React.ReactNode
}

const FolderTreePanel: React.FC<FolderTreePanelProps> = ({
  treeData,
  selectedKeys,
  expandedKeys,
  autoExpandParent,
  onSelect,
  onExpand,
  onLoadData,
  onRefresh,
  searchValue,
  onSearchChange,
  isSearching,
  titleRender
}) => {
  const treeContent = useMemo(() => (
    <div style={{ maxHeight: 480, overflow: 'auto', paddingRight: 4 }}>
      <FolderTree
        treeData={treeData}
        selectedKeys={selectedKeys}
        expandedKeys={expandedKeys}
        autoExpandParent={autoExpandParent}
        onSelect={onSelect}
        onExpand={onExpand}
        onLoadData={onLoadData}
        titleRender={titleRender}
      />
    </div>
  ), [treeData, selectedKeys, expandedKeys, autoExpandParent, onSelect, onExpand, onLoadData])

  return (
    <Card
      size="small"
      title="目录结构"
      extra={
        onRefresh ? (
          <Tooltip title="刷新目录树">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={onRefresh}
            />
          </Tooltip>
        ) : null
      }
    >
      <Input
        placeholder="搜索文件夹"
        prefix={<SearchOutlined />}
        allowClear
        value={searchValue}
        onChange={(e) => onSearchChange?.(e.target.value)}
        disabled={!onSearchChange}
        style={{ marginBottom: 12 }}
      />
      {treeData.length > 0 ? (
        treeContent
      ) : (
        <Empty
          description={isSearching ? '未找到匹配的文件夹' : '暂无文件夹'}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '24px 0' }}
        />
      )}
    </Card>
  )
}

export default FolderTreePanel

