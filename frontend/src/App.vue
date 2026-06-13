<template>
  <div style="display:flex;min-height:100vh;">
    <AppSidebar />
    <div style="flex:1;padding:24px;overflow-y:auto;background:#f5f7fa;">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import AppSidebar from './components/AppSidebar.vue'
</script>
