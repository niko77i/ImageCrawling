<template>
  <el-menu
    :default-active="activeMenu"
    background-color="#fafbfc"
    text-color="#555770"
    active-text-color="#0891b2"
    router
    style="height:100vh;border-right:1px solid #e5e7eb;width:clamp(180px,12vw,240px);flex-shrink:0;"
  >
    <div style="padding:20px 20px 12px;font-size:13px;font-weight:600;color:#555770;letter-spacing:0.15em;">
      卡天皇莫乱来
    </div>
    <el-menu-item index="/accounts">
      <span>账户管理</span>
    </el-menu-item>
    <el-menu-item index="/youtube">
      <span>视频管理</span>
    </el-menu-item>
    <el-menu-item index="/scrape">
      <span>图片爬取</span>
    </el-menu-item>
    <el-menu-item index="/video">
      <span>AI 视频生成</span>
    </el-menu-item>
    <el-menu-item index="/toolkit">
      <span>工具集</span>
    </el-menu-item>
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
