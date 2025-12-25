import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Category } from '@/types'
import { categoryService } from '@/api'
import { ElMessage } from 'element-plus'

export const useCategoryStore = defineStore('category', () => {
  // State
  const categories = ref<Category[]>([])
  const loading = ref(false)

  // Getters
  const categoryTree = computed(() => {
    return buildTree(categories.value)
  })

  const flatCategories = computed(() => {
    const flat: Category[] = []
    const flatten = (cats: Category[], level = 0) => {
      cats.forEach(cat => {
        flat.push({ ...cat, level })
        if (cat.children && cat.children.length > 0) {
          flatten(cat.children, level + 1)
        }
      })
    }
    flatten(categories.value)
    return flat
  })

  // Helper function to build tree structure
  const buildTree = (items: Category[]): Category[] => {
    const map = new Map<number, Category>()
    const roots: Category[] = []

    // First pass: create map of all items
    items.forEach(item => {
      map.set(item.id, { ...item, children: [] })
    })

    // Second pass: build tree
    items.forEach(item => {
      const node = map.get(item.id)!
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  }

  // Actions
  const fetchCategories = async () => {
    loading.value = true
    try {
      const response = await categoryService.getCategories()
      categories.value = response.categories
    } catch (err: any) {
      ElMessage.error('获取类别列表失败')
    } finally {
      loading.value = false
    }
  }

  const createCategory = async (data: {
    name: string
    description?: string
    parentId?: number
  }) => {
    loading.value = true
    try {
      const response = await categoryService.createCategory(data)
      categories.value.push(response.category)
      ElMessage.success('类别创建成功')
      return response.category
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '类别创建失败')
      return null
    } finally {
      loading.value = false
    }
  }

  const updateCategory = async (id: number, data: {
    name?: string
    description?: string
  }) => {
    loading.value = true
    try {
      const response = await categoryService.updateCategory(id, data)
      const index = categories.value.findIndex(c => c.id === id)
      if (index !== -1) {
        categories.value[index] = response.category
      }
      ElMessage.success('类别更新成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '类别更新失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const deleteCategory = async (id: number) => {
    loading.value = true
    try {
      await categoryService.deleteCategory(id)
      categories.value = categories.value.filter(c => c.id !== id)
      ElMessage.success('类别删除成功')
      return true
    } catch (err: any) {
      ElMessage.error(err.response?.data?.message || '类别删除失败')
      return false
    } finally {
      loading.value = false
    }
  }

  const getCategoryById = (id: number): Category | undefined => {
    return categories.value.find(c => c.id === id)
  }

  return {
    // State
    categories,
    loading,
    // Getters
    categoryTree,
    flatCategories,
    // Actions
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById
  }
})

