import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Category {
  id: number
  name: string
  description?: string
  level: number
  sortOrder: number
  createdAt: string
  parentId?: number
  children?: Category[]
}

interface CategoryState {
  categories: Category[]
  loading: boolean
  error: string | null
}

const initialState: CategoryState = {
  categories: [],
  loading: false,
  error: null,
}

const categorySlice = createSlice({
  name: 'category',
  initialState,
  reducers: {
    setCategories: (state, action: PayloadAction<Category[]>) => {
      state.categories = action.payload
      state.error = null
    },
    addCategory: (state, action: PayloadAction<Category>) => {
      state.categories.push(action.payload)
    },
    updateCategory: (state, action: PayloadAction<Category>) => {
      const index = state.categories.findIndex(cat => cat.id === action.payload.id)
      if (index !== -1) {
        state.categories[index] = action.payload
      }
    },
    removeCategory: (state, action: PayloadAction<number>) => {
      state.categories = state.categories.filter(cat => cat.id !== action.payload)
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.loading = false
    },
  },
})

export const {
  setCategories,
  addCategory,
  updateCategory,
  removeCategory,
  setLoading,
  setError
} = categorySlice.actions
export default categorySlice.reducer




