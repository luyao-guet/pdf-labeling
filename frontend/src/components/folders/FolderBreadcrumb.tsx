import { Breadcrumb } from 'antd'
import { FolderOpenOutlined, HomeOutlined } from '@ant-design/icons'
import React from 'react'

export interface BreadcrumbItem {
  id: number
  name: string
}

interface FolderBreadcrumbProps {
  items: BreadcrumbItem[]
  onSelect: (folderId: number | null) => void
}

const FolderBreadcrumb: React.FC<FolderBreadcrumbProps> = ({ items, onSelect }) => {
  const breadcrumbItems = [
    {
      title: (
        <span onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
          <HomeOutlined style={{ marginRight: 4 }} />
          根目录
        </span>
      ),
    },
    ...items.map(folder => ({
      title: (
        <span onClick={() => onSelect(folder.id)} style={{ cursor: 'pointer' }}>
          <FolderOpenOutlined style={{ marginRight: 4 }} />
          {folder.name}
        </span>
      ),
    })),
  ]

  return <Breadcrumb separator=">" items={breadcrumbItems} />
}

export default FolderBreadcrumb




