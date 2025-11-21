import { configureStore } from '@reduxjs/toolkit'
import userReducer from './slices/userSlice'
import documentReducer from './slices/fileSlice'
import categoryReducer from './slices/categorySlice'
import taskReducer from './slices/taskSlice'
import annotationReducer from './slices/annotationSlice'

export const store = configureStore({
  reducer: {
    user: userReducer,
    document: documentReducer,
    category: categoryReducer,
    task: taskReducer,
    annotation: annotationReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
