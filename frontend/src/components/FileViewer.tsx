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
  onSizeChange?: (width: number, height: number) => void // callback for size changes
}

const FileViewer: React.FC<FileViewerProps> = ({
  url,
  width = 800,
  height = 600,
  fileType = 'auto',
  onSizeChange
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
  const [imageLoadError, setImageLoadError] = useState(false)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [touchCenter, setTouchCenter] = useState<{ x: number, y: number } | null>(null)
  const imageContainerRef = React.useRef<HTMLDivElement>(null)

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
        setImageLoadError(false)

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

  // Calculate distance between two touch points
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Calculate center point between two touches
  const getTouchCenter = (touch1: Touch, touch2: Touch): { x: number, y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    }
  }

  // Handle wheel zoom for images
  const handleWheel = (e: React.WheelEvent<HTMLDivElement> | WheelEvent) => {
    if (detectedFileType !== 'image' || !imageUrl) return
    
    // Prevent default browser zoom behavior and page scroll
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation?.()
    
    // Only zoom if Ctrl/Cmd key is pressed, or always zoom for images
    // This prevents page zoom when user just wants to scroll
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.max(0.5, Math.min(3.0, scale + delta))
    setScale(newScale)
    
    // Reset position when zooming out to fit
    if (newScale <= 1.0) {
      setImagePosition({ x: 0, y: 0 })
    }
    
    return false
  }

  // Use native event listener for better control
  useEffect(() => {
    const container = imageContainerRef.current
    if (!container || detectedFileType !== 'image' || !imageUrl) return

    const handleWheelNative = (e: WheelEvent) => {
      if (detectedFileType !== 'image' || !imageUrl) return
      
      // Prevent default browser zoom behavior and page scroll
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      
      // Only zoom if Ctrl/Cmd key is pressed, or always zoom for images
      // This prevents page zoom when user just wants to scroll
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setScale(prevScale => {
        const newScale = Math.max(0.5, Math.min(3.0, prevScale + delta))
        
        // Reset position when zooming out to fit
        if (newScale <= 1.0) {
          setImagePosition({ x: 0, y: 0 })
        }
        
        return newScale
      })
    }

    // Use capture phase to catch event before it bubbles
    container.addEventListener('wheel', handleWheelNative, { passive: false, capture: true })
    
    return () => {
      container.removeEventListener('wheel', handleWheelNative, { capture: true })
    }
  }, [detectedFileType, imageUrl])

  // Handle touch start for pinch zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (detectedFileType !== 'image' || !imageUrl) return
    
    if (e.touches.length === 2) {
      // Two fingers - start pinch zoom
      e.preventDefault() // Prevent default pinch zoom behavior
      e.stopPropagation() // Prevent page zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      setLastTouchDistance(distance)
      const center = getTouchCenter(e.touches[0], e.touches[1])
      setTouchCenter(center)
    } else if (e.touches.length === 1 && scale > 1.0) {
      // Single finger - start drag
      e.preventDefault() // Prevent default touch behavior
      e.stopPropagation() // Prevent page scroll
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - imagePosition.x,
        y: e.touches[0].clientY - imagePosition.y
      })
    }
  }

  // Handle touch move for pinch zoom and drag
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (detectedFileType !== 'image' || !imageUrl) return
    
    if (e.touches.length === 2 && lastTouchDistance !== null && touchCenter) {
      // Two fingers - pinch zoom
      e.preventDefault()
      e.stopPropagation() // Prevent page zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      const scaleChange = distance / lastTouchDistance
      const newScale = Math.max(0.5, Math.min(3.0, scale * scaleChange))
      setScale(newScale)
      setLastTouchDistance(distance)
      
      // Reset position when zooming out to fit
      if (newScale <= 1.0) {
        setImagePosition({ x: 0, y: 0 })
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1.0) {
      // Single finger - drag
      e.preventDefault()
      e.stopPropagation() // Prevent page scroll
      const newX = e.touches[0].clientX - dragStart.x
      const newY = e.touches[0].clientY - dragStart.y
      setImagePosition({ x: newX, y: newY })
    }
  }

  // Handle touch end
  const handleTouchEnd = () => {
    setLastTouchDistance(null)
    setTouchCenter(null)
    setIsDragging(false)
  }

  // Handle mouse drag for images
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (detectedFileType !== 'image' || !imageUrl || scale <= 1.0) return
    if (e.button !== 0) return // Only left mouse button
    
    setIsDragging(true)
    setDragStart({
      x: e.clientX - imagePosition.x,
      y: e.clientY - imagePosition.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || detectedFileType !== 'image' || !imageUrl || scale <= 1.0) return
    
    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y
    setImagePosition({ x: newX, y: newY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Reset position when scale changes to 1.0 or less
  useEffect(() => {
    if (scale <= 1.0) {
      setImagePosition({ x: 0, y: 0 })
    }
  }, [scale])

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
    <div style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Control Panel */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <Space>
          <Button
            icon={<ZoomOutOutlined />}
            onClick={zoomOut}
            disabled={scale <= 0.5}
            size="small"
          >
            缩小
          </Button>

          <Button
            icon={<ZoomInOutlined />}
            onClick={zoomIn}
            disabled={scale >= 3.0}
            size="small"
          >
            放大
          </Button>

          <Button
            icon={<RotateLeftOutlined />}
            onClick={rotateLeft}
            size="small"
          >
            左转
          </Button>

          <Button
            icon={<RotateRightOutlined />}
            onClick={rotateRight}
            size="small"
          >
            右转
          </Button>

          {/* Reset button */}
          <Button
            onClick={() => {
              setScale(1.0)
              setRotation(0)
            }}
            size="small"
          >
            重置
          </Button>
        </Space>
      </div>

      {/* PDF Page Navigation - only show for PDFs */}
      {detectedFileType === 'pdf' && (
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <Space>
            <Button
              type="primary"
              onClick={previousPage}
              disabled={pageNumber <= 1}
              size="small"
            >
              上一页
            </Button>

            <span style={{ fontSize: '14px' }}>
              第 {pageNumber} 页，共 {numPages || '?'} 页
            </span>

            <Button
              type="primary"
              onClick={nextPage}
              disabled={pageNumber >= (numPages || 1)}
              size="small"
            >
              下一页
            </Button>
          </Space>
        </div>
      )}

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.8)',
            zIndex: 10
          }}>
            <Spin size="large" tip="正在加载文件..." />
          </div>
        )}

        {/* PDF Viewer */}
        {pdfUrl && detectedFileType === 'pdf' && (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            borderRadius: '4px'
          }}>
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
                width={Math.min(width * 0.9, 800)}
                height={Math.min(height * 0.9, 600)}
                loading={
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Spin tip="正在渲染页面..." />
                  </div>
                }
              />
            </Document>
          </div>
        )}

        {/* Image Viewer */}
        {imageUrl && detectedFileType === 'image' && (
          <div 
            ref={imageContainerRef}
            data-image-viewer="true"
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f5f5f5',
              borderRadius: '4px',
              overflow: 'hidden',
              cursor: scale > 1.0 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              touchAction: 'none',
              userSelect: 'none',
              isolation: 'isolate', // Create a new stacking context to prevent page zoom
              willChange: 'transform' // Optimize for transforms
            }}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageLoadError ? (
              <div style={{
                textAlign: 'center',
                color: '#ff4d4f',
                fontSize: '16px',
                padding: '40px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖼️</div>
                <div style={{ fontWeight: 500, marginBottom: '8px' }}>图片加载失败</div>
                <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
                  图片格式可能损坏或不受支持
                </div>
              </div>
            ) : (
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <img
                  src={imageUrl}
                  alt="Preview"
                  draggable={false}
                  onError={(e) => {
                    console.error('ImageViewer: Image failed to load:', e)
                    setImageLoadError(true)
                    setLoading(false)
                  }}
                  onLoad={(e) => {
                    console.log('ImageViewer: Image loaded successfully')
                    setImageLoadError(false)
                    setLoading(false)

                    // Get actual image dimensions and notify parent
                    const img = e.target as HTMLImageElement
                    const actualWidth = img.naturalWidth
                    const actualHeight = img.naturalHeight

                    console.log(`ImageViewer: Actual image size: ${actualWidth}x${actualHeight}`)

                    if (onSizeChange) {
                      onSizeChange(actualWidth, actualHeight)
                    }
                  }}
                  style={{
                    maxWidth: '95%',
                    maxHeight: '95%',
                    objectFit: 'contain',
                    transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${scale}) rotate(${rotation}deg)`,
                    transition: isDragging || lastTouchDistance !== null ? 'none' : 'transform 0.1s ease-out',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    pointerEvents: 'none'
                  }}
                />

                {/* Image Info Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  pointerEvents: 'none',
                  zIndex: 10
                }}>
                  {Math.round(scale * 100)}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FileViewer
