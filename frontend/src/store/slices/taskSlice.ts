import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Task, TaskAssignment } from '../../services/api'

interface TaskState {
  tasks: Task[]
  currentTask: Task | null
  myTasks: Array<{
    assignment: TaskAssignment
    task: Task
  }>
  loading: boolean
  error: string | null
  pagination: {
    currentPage: number
    totalItems: number
    totalPages: number
  }
}

const initialState: TaskState = {
  tasks: [],
  currentTask: null,
  myTasks: [],
  loading: false,
  error: null,
  pagination: {
    currentPage: 0,
    totalItems: 0,
    totalPages: 0,
  },
}

const taskSlice = createSlice({
  name: 'task',
  initialState,
  reducers: {
    setTasks: (state, action: PayloadAction<{ tasks: Task[], currentPage: number, totalItems: number, totalPages: number }>) => {
      state.tasks = action.payload.tasks
      state.pagination = {
        currentPage: action.payload.currentPage,
        totalItems: action.payload.totalItems,
        totalPages: action.payload.totalPages,
      }
      state.error = null
    },
    addTask: (state, action: PayloadAction<Task>) => {
      state.tasks.unshift(action.payload)
      state.pagination.totalItems += 1
    },
    updateTask: (state, action: PayloadAction<Task>) => {
      const index = state.tasks.findIndex(task => task.id === action.payload.id)
      if (index !== -1) {
        state.tasks[index] = action.payload
      }
      if (state.currentTask?.id === action.payload.id) {
        state.currentTask = action.payload
      }
    },
    setCurrentTask: (state, action: PayloadAction<Task | null>) => {
      state.currentTask = action.payload
    },
    setMyTasks: (state, action: PayloadAction<{
      assignments: Array<{
        assignment: TaskAssignment
        task: Task
      }>,
      currentPage: number,
      totalItems: number,
      totalPages: number
    }>) => {
      state.myTasks = action.payload.assignments
      state.pagination = {
        currentPage: action.payload.currentPage,
        totalItems: action.payload.totalItems,
        totalPages: action.payload.totalPages,
      }
      state.error = null
    },
    updateMyTask: (state, action: PayloadAction<{ assignmentId: number, task: Task }>) => {
      const index = state.myTasks.findIndex(item => item.assignment.id === action.payload.assignmentId)
      if (index !== -1) {
        state.myTasks[index].task = action.payload.task
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
  setTasks,
  addTask,
  updateTask,
  setCurrentTask,
  setMyTasks,
  updateMyTask,
  setLoading,
  setError,
  clearError
} = taskSlice.actions
export default taskSlice.reducer
