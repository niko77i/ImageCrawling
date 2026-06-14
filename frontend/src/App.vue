<template>
  <div style="display:flex;height:100vh;overflow:hidden;">
    <AppSidebar />
    <div style="flex:1;padding:clamp(16px,2.5vw,32px);overflow-y:auto;background:#f5f7fa;">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import AppSidebar from './components/AppSidebar.vue'
</script>
