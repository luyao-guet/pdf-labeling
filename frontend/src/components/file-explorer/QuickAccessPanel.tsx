import React from 'react'
import { Menu } from 'antd'
import {
  HomeOutlined,
  StarOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

interface QuickAccessPanelProps {
  onNavigate?: (folderId: number | null) => void
  recentFolders?: Array<{ id: number; name: string }>
  favoriteFolders?: Array<{ id: number; name: string }>
}

const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({
  onNavigate,
  recentFolders = [],
  favoriteFolders = []
}) => {
  const menuItems: MenuProps['items'] = [
    {
      key: 'quick-access',
      label: '快速访问',
      type: 'group',
      children: [
        {
          key: 'home',
          icon: <HomeOutlined />,
          label: '根目录',
          onClick: () => onNavigate?.(null)
        }
      ]
    }
  ]

  if (favoriteFolders.length > 0) {
    menuItems.push({
      key: 'favorites',
      label: '收藏夹',
      type: 'group',
      children: favoriteFolders.map(folder => ({
        key: `fav-${folder.id}`,
        icon: <StarOutlined style={{ color: '#faad14' }} />,
        label: folder.name,
        onClick: () => onNavigate?.(folder.id)
      }))
    })
  }

  if (recentFolders.length > 0) {
    menuItems.push({
      key: 'recent',
      label: '最近访问',
      type: 'group',
      children: recentFolders.slice(0, 10).map(folder => ({
        key: `recent-${folder.id}`,
        icon: <ClockCircleOutlined />,
        label: folder.name,
        onClick: () => onNavigate?.(folder.id)
      }))
    })
  }

  return (
    <div style={{
      padding: '8px 0',
      borderBottom: '1px solid #e8e8e8'
    }}>
      <Menu
        mode="inline"
        items={menuItems}
        style={{ border: 'none' }}
        selectable={false}
      />
    </div>
  )
}

export default QuickAccessPanel

