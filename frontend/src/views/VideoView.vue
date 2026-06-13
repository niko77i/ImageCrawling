<template>
  <div>
    <h1>AI 视频生成</h1>
    <p style="color:#888;margin-bottom:20px;">从已爬取的图片生成视频，可选 Logo 水印与 AI 动态效果</p>

    <el-form label-position="top">
      <el-form-item label="选择图片目录">
        <div style="display:flex;gap:8px;">
          <el-input v-model="videoDir" placeholder="例如：F:\images\google_ads\com.spotify.music" style="flex:1;" />
          <el-button @click="browseVideoFolder">📂</el-button>
          <el-button type="primary" @click="scanDir" :loading="scanning">扫描</el-button>
        </div>
      </el-form-item>
    </el-form>

    <div v-if="images.length" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
      <el-image v-for="img in images" :key="img.filename" :src="'/api/image?path=' + encodeURIComponent(img.path)"
        fit="cover" style="aspect-ratio:16/10;border-radius:8px;cursor:pointer;"
        :class="{ 'selected': selectedImgs.has(img.filename) }"
        @click="toggleImg(img.filename)" />
    </div>

    <div v-if="images.length">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        <el-form-item label="单帧时长"><el-select v-model="settings.frameDuration" style="width:100%;"><el-option v-for="d in [3,4,5]" :key="d" :label="d+'秒'" :value="d" /></el-select></el-form-item>
        <el-form-item label="输出分辨率"><el-select v-model="settings.resolution" style="width:100%;"><el-option label="9:16 竖屏" value="1080:1920" /><el-option label="1:1 方形" value="1080:1080" /></el-select></el-form-item>
        <el-form-item label="转场效果"><el-select v-model="settings.transition" style="width:100%;"><el-option label="淡入淡出" value="fade" /><el-option label="黑场过渡" value="fadeblack" /><el-option label="滑动" value="slideright" /><el-option label="溶解" value="dissolve" /><el-option label="无" value="none" /></el-select></el-form-item>
      </div>

      <el-form-item label="输出路径">
        <div style="display:flex;gap:6px;">
          <el-input v-model="outputPath" placeholder="例如：F:\output\video.mp4" style="flex:1;" />
          <el-button @click="browseSave">📂</el-button>
        </div>
      </el-form-item>

      <el-button type="primary" @click="generate" :loading="generating" :disabled="!outputPath">
        生成视频
      </el-button>

      <div v-if="progressMsg" style="margin-top:12px;">
        <el-progress :percentage="Math.round(progressPct * 100)" />
        <span style="font-size:12px;color:#888;">{{ progressMsg }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useVideoStore } from '@/stores/video'
import { browseApi } from '@/api/browse'

const store = useVideoStore()
const videoDir = ref('')
const scanning = ref(false)
const images = ref([])
const selectedImgs = ref(new Set())
const outputPath = ref('')
const generating = ref(false)
const progressMsg = ref('')
const progressPct = ref(0)

const settings = reactive({ frameDuration: 3, resolution: '1080:1920', transition: 'fade' })

async function browseVideoFolder() {
  const res = await browseApi.folder({})
  if (res.path) videoDir.value = res.path
}

async function browseSave() {
  const res = await browseApi.save({})
  if (res.path) outputPath.value = res.path
}

async function scanDir() {
  scanning.value = true
  const res = await store.scanDir(videoDir.value)
  images.value = res.images || []
  scanning.value = false
}

function toggleImg(filename) {
  const s = new Set(selectedImgs.value)
  s.has(filename) ? s.delete(filename) : s.add(filename)
  selectedImgs.value = s
}

async function generate() {
  const sel = images.value.filter(img => selectedImgs.value.has(img.filename))
  if (!sel.length) return
  generating.value = true
  const res = await store.generate({
    images: sel.map(img => img.path),
    settings: { ...settings, output_path: outputPath.value },
  })
  const tid = res.task_id
  const poll = setInterval(async () => {
    const p = await store.checkProgress(tid)
    progressPct.value = p.progress || 0
    progressMsg.value = p.message || ''
    if (p.status === 'completed' || p.status === 'error') {
      clearInterval(poll)
      generating.value = false
      if (p.status === 'completed') progressMsg.value = '完成: ' + (p.output || '')
      else progressMsg.value = p.error || '未知错误'
    }
  }, 2000)
}
</script>
