<template>
  <div>
    <h1>图片爬取</h1>
    <p style="color:#888;margin-bottom:20px;">批量输入 Google Play 链接，自动爬取并缩放图片至 Google Ads 规格</p>

    <el-form label-position="top">
      <el-form-item label="Google Play 链接">
        <el-input v-model="urls" type="textarea" :rows="6" placeholder="每行一个链接，或用逗号分隔" />
      </el-form-item>

      <el-form-item label="保存路径">
        <div style="display:flex;gap:6px;">
          <el-input v-model="saveDir" placeholder="例如：F:\images\google_ads\" style="flex:1;" />
          <el-button @click="browseFolder" style="width:44px;">📂</el-button>
        </div>
      </el-form-item>

      <el-checkbox v-model="includeAds" style="margin-bottom:16px;">按 Google Ads 规格放大图片</el-checkbox>

      <el-button type="primary" @click="startScrape" :loading="scraping" :disabled="!urls || !saveDir">
        开始爬取
      </el-button>
    </el-form>

    <div v-if="results.length" style="margin-top:20px;">
      <h3>处理结果</h3>
      <div v-for="r in results" :key="r.url" style="padding:8px 12px;border-radius:6px;margin-bottom:4px;font-size:12px;background:rgba(0,0,0,0.02);border-left:3px solid;"
        :style="{ borderColor: r.error ? '#dc2626' : r.image_count ? '#059669' : '#0891b2' }">
        <span v-if="r.loading">⏳</span>
        <span v-else-if="r.error">❌</span>
        <span v-else>✅</span>
        {{ r.package_name || r.url }}
        <span v-if="r.image_count"> — {{ r.image_count }} 张</span>
        <span v-if="r.error" style="color:#dc2626;"> — {{ r.error }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { scrapeApi } from '@/api/scrape'
import { browseApi } from '@/api/browse'

const urls = ref('')
const saveDir = ref('')
const includeAds = ref(true)
const scraping = ref(false)
const results = ref([])

async function browseFolder() {
  const res = await browseApi.folder({})
  if (res.path) saveDir.value = res.path
}

function parseUrls(input) {
  const matches = input.match(/https?:\/\/play\.google\.com\/[^\s,;，；\n]+/gi)
  if (matches?.length) return matches
  return input.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('http'))
}

async function startScrape() {
  const links = parseUrls(urls.value)
  if (!links.length) return
  scraping.value = true
  results.value = links.map(url => ({ url, loading: true, package_name: '', image_count: 0, error: '' }))

  for (let i = 0; i < links.length; i++) {
    try {
      const res = await scrapeApi.scrape({ url: links[i], save_dir: saveDir.value, include_ads_images: includeAds.value })
      results.value[i] = { url: links[i], package_name: res.package_name, image_count: res.image_count, error: '' }
    } catch (e) {
      results.value[i] = { url: links[i], package_name: '', image_count: 0, error: e.message }
    }
  }
  scraping.value = false
}
</script>
