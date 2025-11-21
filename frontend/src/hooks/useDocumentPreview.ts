import { useCallback, useState } from 'react'
import type { Document } from '../store/slices/fileSlice'

const DEFAULT_MODAL_SIZE = { width: 1000, height: 700 }
const SIZE_PADDING = 80
const HEADER_EXTRA_SPACE = 150
const MIN_WIDTH = 600
const MIN_HEIGHT = 400

const useDocumentPreview = () => {
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [previewModalSize, setPreviewModalSize] = useState(DEFAULT_MODAL_SIZE)

  const openPreview = useCallback((document: Document) => {
    setPreviewDocument(document)
    setPreviewModalSize(DEFAULT_MODAL_SIZE)
    setPreviewVisible(true)
  }, [])

  const closePreview = useCallback(() => {
    setPreviewVisible(false)
    setPreviewDocument(null)
  }, [])

  const updatePreviewSize = useCallback((contentWidth: number, contentHeight: number) => {
    const paddedWidth = contentWidth + SIZE_PADDING
    const paddedHeight = contentHeight + SIZE_PADDING + HEADER_EXTRA_SPACE
    const width = Math.max(Math.min(paddedWidth, window.innerWidth * 0.9), MIN_WIDTH)
    const height = Math.max(Math.min(paddedHeight, window.innerHeight * 0.9), MIN_HEIGHT)
    setPreviewModalSize({ width, height })
  }, [])

  return {
    previewVisible,
    previewDocument,
    previewModalSize,
    openPreview,
    closePreview,
    updatePreviewSize
  }
}

export default useDocumentPreview

