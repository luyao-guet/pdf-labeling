import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Annotation } from '../../services/api'

interface AnnotationState {
  annotations: Annotation[]
  currentAnnotation: Annotation | null
  myAnnotations: Array<{
    assignment: any // TaskAssignment
    task: any // Task
    annotation?: Annotation
  }>
  loading: boolean
  error: string | null
  pagination: {
    currentPage: number
    totalItems: number
    totalPages: number
  }
}

const initialState: AnnotationState = {
  annotations: [],
  currentAnnotation: null,
  myAnnotations: [],
  loading: false,
  error: null,
  pagination: {
    currentPage: 0,
    totalItems: 0,
    totalPages: 0,
  },
}

const annotationSlice = createSlice({
  name: 'annotation',
  initialState,
  reducers: {
    setAnnotations: (state, action: PayloadAction<Annotation[]>) => {
      state.annotations = action.payload
      state.error = null
    },
    addAnnotation: (state, action: PayloadAction<Annotation>) => {
      state.annotations.unshift(action.payload)
    },
    updateAnnotation: (state, action: PayloadAction<Annotation>) => {
      const index = state.annotations.findIndex(annotation => annotation.id === action.payload.id)
      if (index !== -1) {
        state.annotations[index] = action.payload
      }
      if (state.currentAnnotation?.id === action.payload.id) {
        state.currentAnnotation = action.payload
      }
    },
    setCurrentAnnotation: (state, action: PayloadAction<Annotation | null>) => {
      state.currentAnnotation = action.payload
    },
    setMyAnnotations: (state, action: PayloadAction<{
      items: Array<{
        assignment: any
        task: any
        annotation?: Annotation
      }>,
      currentPage: number,
      totalItems: number,
      totalPages: number
    }>) => {
      state.myAnnotations = action.payload.items
      state.pagination = {
        currentPage: action.payload.currentPage,
        totalItems: action.payload.totalItems,
        totalPages: action.payload.totalPages,
      }
      state.error = null
    },
    updateMyAnnotation: (state, action: PayloadAction<{ assignmentId: number, annotation: Annotation }>) => {
      const index = state.myAnnotations.findIndex(item => item.assignment.id === action.payload.assignmentId)
      if (index !== -1) {
        state.myAnnotations[index].annotation = action.payload.annotation
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.loading = false
    },
    clearError: (state) => {
      state.error = null
    },
  },
})

export const {
  setAnnotations,
  addAnnotation,
  updateAnnotation,
  setCurrentAnnotation,
  setMyAnnotations,
  updateMyAnnotation,
  setLoading,
  setError,
  clearError
} = annotationSlice.actions
export default annotationSlice.reducer
