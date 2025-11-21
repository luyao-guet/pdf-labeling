import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Document {
  id: number
  filename: string
  fileSize: number
  mimeType: string
  status: string
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  uploadedAt: string
  uploadedBy: string
  folderPath?: string
  folder?: {
    id: number
    name: string
    path: string
  }
  category?: {
    id: number
    name: string
  }
  documentType?: {
    id: number
    name: string
    description?: string
  }
}

export type ViewMode = 'table' | 'grid'

interface DocumentState {
  documents: Document[]
  loading: boolean
  error: string | null
  pagination: {
    currentPage: number
    totalItems: number
    totalPages: number
  }
  currentFolderId: number | null
  viewMode: ViewMode
  searchKeyword: string
}

const initialState: DocumentState = {
  documents: [],
  loading: false,
  error: null,
  pagination: {
    currentPage: 0,
    totalItems: 0,
    totalPages: 0,
  },
  currentFolderId: null,
  viewMode: 'table',
  searchKeyword: ''
}

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    setDocuments: (state, action: PayloadAction<{
      documents: Document[]
      currentPage: number
      totalItems: number
      totalPages: number
    }>) => {
      state.documents = action.payload.documents
      state.pagination = {
        currentPage: action.payload.currentPage,
        totalItems: action.payload.totalItems,
        totalPages: action.payload.totalPages,
      }
      state.error = null
    },
    addDocument: (state, action: PayloadAction<Document>) => {
      state.documents.unshift(action.payload)
      state.pagination.totalItems += 1
    },
    removeDocument: (state, action: PayloadAction<number>) => {
      state.documents = state.documents.filter(doc => doc.id !== action.payload)
      state.pagination.totalItems = Math.max(0, state.pagination.totalItems - 1)
    },
    updateDocument: (state, action: PayloadAction<Document>) => {
      const index = state.documents.findIndex(doc => doc.id === action.payload.id)
      if (index !== -1) {
        state.documents[index] = action.payload
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.loading = false
    },
    setCurrentFolderId: (state, action: PayloadAction<number | null>) => {
      state.currentFolderId = action.payload
    },
    setViewMode: (state, action: PayloadAction<ViewMode>) => {
      state.viewMode = action.payload
    },
    setSearchKeyword: (state, action: PayloadAction<string>) => {
      state.searchKeyword = action.payload
    },
  },
})

export const {
  setDocuments,
  addDocument,
  removeDocument,
  updateDocument,
  setLoading,
  setError,
  setCurrentFolderId,
  setViewMode,
  setSearchKeyword,
} = documentSlice.actions
export default documentSlice.reducer
