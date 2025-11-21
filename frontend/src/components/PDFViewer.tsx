import React, { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Spin, Alert, Button, Space } from 'antd'
import { ZoomInOutlined, ZoomOutOutlined, RotateLeftOutlined, RotateRightOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
import { RootState } from '../store'

// Import react-pdf styles to fix TextLayer and AnnotationLayer warnings
import 'react-pdf/dist/esm/Page/TextLayer.css'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface FileViewerProps {
  url: string
  width?: number
  height?: number
  fileType?: 'pdf' | 'image' | 'auto' // auto will detect from URL or response
}

const FileViewer: React.FC<FileViewerProps> = ({
  url,
  width = 800,
  height = 600,
  fileType = 'auto'
}) => {
  const { isAuthenticated, currentUser } = useSelector((state: RootState) => state.user)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [detectedFileType, setDetectedFileType] = useState<'pdf' | 'image' | null>(null)

  // Load file with authentication
  useEffect(() => {
    const loadFile = async () => {
      console.log('=== FileViewer Debug Info ===')
      console.log('URL:', url)
      console.log('File type:', fileType)
      console.log('Redux isAuthenticated:', isAuthenticated)
      console.log('Redux currentUser:', currentUser)

      // Check authentication first - check both Redux state and localStorage
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')

      console.log('localStorage token exists:', !!token)
      console.log('localStorage token length:', token?.length || 0)
      console.log('localStorage user exists:', !!userStr)

      if (!token) {
        console.error('FileViewer: No token in localStorage')
        setError('文件加载失败: 未登录，请先登录')
        setLoading(false)
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
        return
      }

      if (!userStr) {
        console.error('FileViewer: No user data in localStorage')
        setError('文件加载失败: 用户信息丢失，请重新登录')
        setLoading(false)
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
        return
      }

      try {
        // Parse user data to ensure it's valid
        const userData = JSON.parse(userStr)
        console.log('Parsed user data:', userData)
        console.log('User role:', userData.role)

        // Double check user has required permissions
        const allowedRoles = ['admin', 'annotator', 'reviewer', 'expert']
        const userRole = userData.role?.toLowerCase()
        console.log('User role lowercase:', userRole)
        console.log('Allowed roles:', allowedRoles)

        if (!allowedRoles.includes(userRole)) {
          console.error('FileViewer: User role not allowed:', userRole)
          setError(`文件加载失败: 权限不足，角色 "${userData.role}" 无权查看文件`)
          setLoading(false)
          return
        }

        console.log('FileViewer: Authentication passed, proceeding to load file...')

        setLoading(true)
        setError(null)

        // Construct full URL - directly to backend to avoid proxy issues
        const fullUrl = url.startsWith('http')
          ? url
          : `http://localhost:8080${url}`

        console.log('FileViewer: Loading file from:', fullUrl)
        console.log('FileViewer: Using token from localStorage (first 50 chars):', token.substring(0, 50))

        // Fetch file with authentication
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': '*/*',
          },
          credentials: 'same-origin',
        })

        console.log('FileViewer: File response status:', response.status)
        console.log('FileViewer: File response headers:', Object.fromEntries(response.headers.entries()))

        // Log response details for debugging
        if (!response.ok) {
          const responseText = await response.text()
          console.error('FileViewer: Response error details:', responseText)
        }

        if (!response.ok) {
          if (response.status === 401) {
            console.error('FileViewer: 401 Unauthorized - token expired')
            setError('文件加载失败: 登录已过期，请重新登录')
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setTimeout(() => {
              window.location.href = '/login'
            }, 2000)
          } else if (response.status === 403) {
            console.error('FileViewer: 403 Forbidden - insufficient permissions')
            setError('文件加载失败: 权限不足，您没有查看文件的权限')
            setLoading(false)
          } else if (response.status === 404) {
            console.error('FileViewer: 404 Not Found - file not exists')
            setError('文件加载失败: 文件不存在')
            setLoading(false)
          } else {
            console.error('FileViewer: Server error', response.status)
            setError(`文件加载失败: 服务器错误 ${response.status}`)
            setLoading(false)
          }
          return
        }

        // Check response content type
        const contentType = response.headers.get('content-type')
        console.log('FileViewer: Response content-type:', contentType)

        if (!contentType) {
          setError('文件加载失败: 服务器返回的数据格式错误')
          setLoading(false)
          return
        }

        // Determine file type
        let currentFileType: 'pdf' | 'image' | null = null
        if (contentType.includes('pdf')) {
          currentFileType = 'pdf'
        } else if (contentType.includes('image/')) {
          currentFileType = 'image'
        }

        if (!currentFileType) {
          setError('文件加载失败: 不支持的文件格式')
          setLoading(false)
          return
        }

        // Create blob URL
        const blob = await response.blob()
        console.log('FileViewer: File blob size:', blob.size)

        if (blob.size === 0) {
          setError('文件加载失败: 文件为空')
          setLoading(false)
          return
        }

        const blobUrl = URL.createObjectURL(blob)

        if (currentFileType === 'pdf') {
          setPdfUrl(blobUrl)
          setImageUrl(null)
        } else if (currentFileType === 'image') {
          setImageUrl(blobUrl)
          setPdfUrl(null)
        }

        setDetectedFileType(currentFileType)
        setLoading(false)
      } catch (err) {
        console.error('FileViewer: File loading error:', err)
        setError(`文件加载失败: ${err instanceof Error ? err.message : '网络错误'}`)
        setLoading(false)
      }
    }

    loadFile()

    // Cleanup blob URLs on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [url, fileType, isAuthenticated, currentUser])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
    setError(null)
  }

  const onDocumentLoadError = (error: Error) => {
    setError(`PDF加载失败: ${error.message}`)
    setLoading(false)
  }

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPageNumber = prevPageNumber + offset
      return Math.min(Math.max(1, newPageNumber), numPages || 1)
    })
  }

  const previousPage = () => changePage(-1)
  const nextPage = () => changePage(1)

  const zoomIn = () => setScale(prevScale => Math.min(prevScale + 0.25, 3.0))
  const zoomOut = () => setScale(prevScale => Math.max(prevScale - 0.25, 0.5))

  const rotateLeft = () => setRotation(prevRotation => prevRotation - 90)
  const rotateRight = () => setRotation(prevRotation => prevRotation + 90)

  if (error) {
    return (
      <Alert
        message="文件加载错误"
        description={
          <div>
            <p>{error}</p>
            <p style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
              如果您已登录，请尝试刷新页面或重新登录
            </p>
          </div>
        }
        type="error"
        showIcon
        action={
          <Button
            size="small"
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
        }
      />
    )
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Control Panel */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            icon={<ZoomOutOutlined />}
            onClick={zoomOut}
            disabled={scale <= 0.5}
          >
            缩小
          </Button>

          <span>{Math.round(scale * 100)}%</span>

          <Button
            icon={<ZoomInOutlined />}
            onClick={zoomIn}
            disabled={scale >= 3.0}
          >
            放大
          </Button>

          <Button
            icon={<RotateLeftOutlined />}
            onClick={rotateLeft}
          >
            左转
          </Button>

          <Button
            icon={<RotateRightOutlined />}
            onClick={rotateRight}
          >
            右转
          </Button>
        </Space>
      </div>

      {/* Page Navigation */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            onClick={previousPage}
            disabled={pageNumber <= 1}
          >
            上一页
          </Button>

          <span>
            第 {pageNumber} 页，共 {numPages || '?'} 页
          </span>

          <Button
            type="primary"
            onClick={nextPage}
            disabled={pageNumber >= (numPages || 1)}
          >
            下一页
          </Button>
        </Space>
      </div>

      {/* File Content */}
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: 16,
          backgroundColor: '#fafafa',
          display: 'inline-block'
        }}
      >
        {loading && (
          <div style={{
            width: width,
            height: height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Spin size="large" tip="正在加载文件..." />
          </div>
        )}

        {/* PDF Viewer */}
        {pdfUrl && detectedFileType === 'pdf' && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
            error=""
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              rotate={rotation}
              width={width}
              height={height}
              loading={
                <div style={{
                  width: width,
                  height: height,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Spin tip="正在渲染页面..." />
                </div>
              }
            />
          </Document>
        )}

        {/* Image Viewer */}
        {imageUrl && detectedFileType === 'image' && (
          <div style={{
            width: width,
            height: height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <img
              src={imageUrl}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease'
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default FileViewer
