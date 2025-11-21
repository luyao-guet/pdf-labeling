import React from 'react'
import { Tree } from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { Folder } from '../../services/api'

export interface FolderTreeNode extends DataNode {
  key: string
  title: React.ReactNode
  folder?: Folder
  isLeaf?: boolean
  children?: FolderTreeNode[]
}

interface FolderTreeProps {
  treeData: FolderTreeNode[]
  selectedKeys: React.Key[]
  expandedKeys?: React.Key[]
  autoExpandParent?: boolean
  onExpand?: TreeProps['onExpand']
  onSelect: TreeProps['onSelect']
  onLoadData: TreeProps['loadData']
  titleRender?: (node: FolderTreeNode) => React.ReactNode
}

const FolderTree: React.FC<FolderTreeProps> = ({
  treeData,
  selectedKeys,
  expandedKeys,
  autoExpandParent,
  onSelect,
  onExpand,
  onLoadData,
  titleRender,
}) => {
  return (
    <Tree
      showLine={{ showLeafIcon: false }}
      blockNode
      height={460}
      treeData={treeData}
      selectedKeys={selectedKeys}
      expandedKeys={expandedKeys}
      autoExpandParent={autoExpandParent}
      onSelect={onSelect}
      onExpand={onExpand}
      loadData={onLoadData}
      titleRender={titleRender}
    />
  )
}

export default FolderTree

