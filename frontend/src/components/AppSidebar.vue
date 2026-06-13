<template>
  <el-menu
    :default-active="activeMenu"
    router
    class="app-sidebar"
  >
    <div class="sidebar-brand">
      <span class="sidebar-brand-icon">⬡</span>
      卡天皇
    </div>
    <el-menu-item index="/accounts">🏢 账户管理</el-menu-item>
    <el-menu-item index="/youtube">📺 视频管理</el-menu-item>
    <el-menu-item index="/scrape">📥 图片爬取</el-menu-item>
    <el-menu-item index="/video">🎬 AI 视频生成</el-menu-item>
    <el-menu-item index="/toolkit">🧰 工具集</el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/accounts')) return '/accounts'
  if (p.startsWith('/youtube')) return '/youtube'
  if (p.startsWith('/toolkit')) return '/toolkit'
  return p
})
</script>
