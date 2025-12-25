<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { Trophy, Medal } from '@element-plus/icons-vue'

const userStore = useUserStore()

// 排序后的用户列表
const rankedUsers = computed(() => {
  return [...userStore.users].sort((a, b) => b.score - a.score)
})

// 当前用户排名
const currentUserRank = computed(() => {
  if (!userStore.user) return -1
  return rankedUsers.value.findIndex(u => u.id === userStore.user?.id) + 1
})

// 获取奖牌颜色
const getMedalColor = (rank: number) => {
  if (rank === 1) return '#ffd700' // 金
  if (rank === 2) return '#c0c0c0' // 银
  if (rank === 3) return '#cd7f32' // 铜
  return ''
}

// 角色标签
const roleLabel = (role: string) => {
  const labels: Record<string, string> = {
    'admin': '管理员',
    'annotator': '标注员',
    'reviewer': '审核员',
    'expert': '专家'
  }
  return labels[role] || role
}

onMounted(() => {
  userStore.fetchUsers()
})
</script>

<template>
  <div class="score-ranking">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Trophy /></el-icon>
        积分排行榜
      </h2>
    </div>

    <!-- 我的排名 -->
    <el-card class="my-rank-card" v-if="userStore.user">
      <div class="my-rank-content">
        <div class="rank-info">
          <span class="rank-label">我的排名</span>
          <span class="rank-value">{{ currentUserRank }}</span>
        </div>
        <div class="score-info">
          <span class="score-label">我的积分</span>
          <span class="score-value">{{ userStore.user.score }}</span>
        </div>
      </div>
    </el-card>

    <!-- 排行榜 -->
    <el-card class="ranking-card">
      <el-table :data="rankedUsers" v-loading="userStore.loading" stripe>
        <el-table-column label="排名" width="100">
          <template #default="{ $index }">
            <div class="rank-cell">
              <el-icon
                v-if="$index < 3"
                :size="24"
                :color="getMedalColor($index + 1)"
              >
                <Medal />
              </el-icon>
              <span v-else class="rank-number">{{ $index + 1 }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="32">{{ row.username.charAt(0).toUpperCase() }}</el-avatar>
              <span class="username">{{ row.username }}</span>
              <el-tag
                v-if="row.id === userStore.user?.id"
                type="primary"
                size="small"
              >
                我
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            {{ roleLabel(row.role) }}
          </template>
        </el-table-column>
        <el-table-column label="积分" width="150">
          <template #default="{ row }">
            <span class="score">{{ row.score }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.score-ranking {
  height: 100%;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 20px;
}

.my-rank-card {
  margin-bottom: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.my-rank-content {
  display: flex;
  justify-content: space-around;
  padding: 20px 0;
  color: #fff;
}

.rank-info,
.score-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rank-label,
.score-label {
  font-size: 14px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.rank-value,
.score-value {
  font-size: 36px;
  font-weight: 700;
}

.rank-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-number {
  font-size: 18px;
  font-weight: 600;
  color: #909399;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  font-weight: 500;
}

.score {
  font-size: 18px;
  font-weight: 600;
  color: #e6a23c;
}
</style>

