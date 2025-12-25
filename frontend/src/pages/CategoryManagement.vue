<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCategoryStore } from '@/stores/category'
import type { Category } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Edit, Setting } from '@element-plus/icons-vue'

const router = useRouter()
const categoryStore = useCategoryStore()

// 状态
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingCategory = ref<Category | null>(null)

// 表单数据
const formData = ref({
  name: '',
  description: '',
  parentId: undefined as number | undefined
})

// 打开创建对话框
const openCreateDialog = (parentId?: number) => {
  dialogMode.value = 'create'
  formData.value = {
    name: '',
    description: '',
    parentId
  }
  dialogVisible.value = true
}

// 打开编辑对话框
const openEditDialog = (category: Category) => {
  dialogMode.value = 'edit'
  editingCategory.value = category
  formData.value = {
    name: category.name,
    description: category.description || '',
    parentId: category.parentId
  }
  dialogVisible.value = true
}

// 保存类别
const handleSave = async () => {
  if (!formData.value.name.trim()) {
    ElMessage.warning('请输入类别名称')
    return
  }

  if (dialogMode.value === 'create') {
    await categoryStore.createCategory(formData.value)
  } else if (editingCategory.value) {
    await categoryStore.updateCategory(editingCategory.value.id, formData.value)
  }
  
  dialogVisible.value = false
}

// 删除类别
const handleDelete = async (category: Category) => {
  await ElMessageBox.confirm(
    `确定要删除类别 "${category.name}" 吗？`,
    '确认删除',
    { type: 'warning' }
  )
  await categoryStore.deleteCategory(category.id)
}

// 跳转到表单设计器
const goToFormDesigner = (categoryId: number) => {
  router.push(`/form-designer/${categoryId}`)
}

onMounted(() => {
  categoryStore.fetchCategories()
})
</script>

<template>
  <div class="category-management">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button type="primary" :icon="Plus" @click="openCreateDialog()">
        新建类别
      </el-button>
    </div>

    <!-- 类别树 -->
    <el-card>
      <el-tree
        :data="categoryStore.categoryTree"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        default-expand-all
        :expand-on-click-node="false"
      >
        <template #default="{ node, data }">
          <div class="tree-node">
            <span class="node-label">{{ data.name }}</span>
            <span class="node-desc" v-if="data.description">{{ data.description }}</span>
            <div class="node-actions">
              <el-button
                type="primary"
                :icon="Plus"
                size="small"
                circle
                @click.stop="openCreateDialog(data.id)"
                title="添加子类别"
              />
              <el-button
                type="primary"
                :icon="Setting"
                size="small"
                circle
                @click.stop="goToFormDesigner(data.id)"
                title="表单配置"
              />
              <el-button
                type="warning"
                :icon="Edit"
                size="small"
                circle
                @click.stop="openEditDialog(data)"
                title="编辑"
              />
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                circle
                @click.stop="handleDelete(data)"
                title="删除"
              />
            </div>
          </div>
        </template>
      </el-tree>
      
      <el-empty
        v-if="categoryStore.categories.length === 0"
        description="暂无类别数据"
      />
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建类别' : '编辑类别'"
      width="500px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="类别名称" required>
          <el-input v-model="formData.name" placeholder="请输入类别名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入类别描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="categoryStore.loading">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.category-management {
  height: 100%;
}

.toolbar {
  margin-bottom: 16px;
}

.tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 4px 0;
}

.node-label {
  font-weight: 500;
  margin-right: 8px;
}

.node-desc {
  color: #909399;
  font-size: 12px;
  margin-right: auto;
}

.node-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.tree-node:hover .node-actions {
  opacity: 1;
}
</style>

