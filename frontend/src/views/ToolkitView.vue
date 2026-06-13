<template>
  <div>
    <h1>工具集</h1>
    <el-tabs :model-value="activeTab" @update:model-value="switchTab">
      <el-tab-pane label="做表数据" name="zuobiao" />
      <el-tab-pane label="音频替换" name="audio" />
    </el-tabs>

    <!-- ===== 做表数据 ===== -->
    <div v-show="activeTab === 'zuobiao'">
      <p style="color:#888;margin-bottom:12px;font-size:13px;">粘贴包含"添加过滤条件"和"Total"的原始竖排数据：</p>
      <el-input v-model="zbInput" type="textarea" :rows="6" placeholder="在此粘贴原始数据..." />
      <el-button type="primary" @click="zbProcess" style="margin-top:8px;">一键解析并生成所有报表</el-button>
      <div v-if="zbError" style="color:#dc2626;margin-top:8px;">{{ zbError }}</div>

      <div v-if="zbRaw.length" style="margin-top:16px;">
        <h3>原始清洗数据 ({{ zbRaw.length }})</h3>
        <el-table :data="zbRaw" size="small" max-height="300">
          <el-table-column prop="account" label="账号" />
          <el-table-column prop="customerId" label="客户ID" />
          <el-table-column prop="campaign" label="广告系列" />
          <el-table-column prop="cost" label="费用" />
          <el-table-column prop="impressions" label="展示次数" />
          <el-table-column prop="clicks" label="点击次数" />
        </el-table>
      </div>
    </div>

    <!-- ===== 音频替换 ===== -->
    <div v-show="activeTab === 'audio'" style="max-width:600px;">
      <el-form-item label="原视频">
        <div style="display:flex;gap:6px;">
          <el-input v-model="audioVideoPath" placeholder="F:\video\test.mp4" style="flex:1;" />
          <el-button @click="browseFile('video')">📂</el-button>
        </div>
      </el-form-item>
      <el-form-item label="新音频源">
        <div style="display:flex;gap:6px;">
          <el-input v-model="audioSourcePath" placeholder="F:\music\bg.mp3" style="flex:1;" />
          <el-button @click="browseFile('audio')">📂</el-button>
        </div>
      </el-form-item>
      <el-button type="primary" @click="audioReplace" :loading="audioReplacing">替换音频</el-button>
      <div v-if="audioResult" style="margin-top:8px;font-size:12px;">{{ audioResult }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useVideoStore } from '@/stores/video'
import { browseApi } from '@/api/browse'

const router = useRouter()
const route = useRoute()
const vStore = useVideoStore()

const activeTab = computed(() => route.path.includes('/audio') ? 'audio' : 'zuobiao')
function switchTab(name) { router.push(`/toolkit/${name}`) }

// Zuobiao
const zbInput = ref('')
const zbRaw = ref([])
const zbError = ref('')

function zbProcess() {
  zbError.value = ''
  zbRaw.value = []
  const input = zbInput.value.trim()
  if (!input) { zbError.value = '请输入数据'; return }

  try {
    const lines = input.split(/\r?\n/).map(l => l.trim()).filter(l => l)
    const startIdx = lines.lastIndexOf('添加过滤条件')
    const endIdx = lines.indexOf('Total')
    if (startIdx < 0) throw new Error('未找到"添加过滤条件"')
    if (endIdx < 0) throw new Error('未找到"Total"')
    if (startIdx >= endIdx) throw new Error('数据顺序异常')

    const validLines = lines.slice(startIdx + 1, endIdx)
    const rows = []
    for (let i = 0; i < validLines.length; i += 10) {
      const row = validLines.slice(i, i + 10)
      if (row.length === 10 && /^\d{3}-\d{3}-\d{4}$/.test(row[1]) && row[4].includes('US$')) {
        rows.push(row)
      }
    }
    if (!rows.length) throw new Error('未找到有效数据')

    zbRaw.value = rows.map(r => ({
      account: r[0], customerId: r[1], campaign: r[2].replace(/-[^-]*$/, '').trim(),
      cost: parseFloat(r[4].replace(/[^0-9.-]+/g, '')) || 0,
      impressions: parseInt(r[5].replace(/[^0-9]/g, '')) || 0,
      clicks: parseInt(r[6].replace(/[^0-9]/g, '')) || 0,
    }))
  } catch(e) { zbError.value = e.message }
}

// Audio replace
const audioVideoPath = ref('')
const audioSourcePath = ref('')
const audioReplacing = ref(false)
const audioResult = ref('')

async function browseFile(type) {
  const res = await browseApi.file({ type })
  if (!res.path) return
  if (type === 'video') audioVideoPath.value = res.path
  else audioSourcePath.value = res.path
}

async function audioReplace() {
  audioReplacing.value = true
  try {
    const res = await vStore.audioReplace({ video_path: audioVideoPath.value, audio_source: audioSourcePath.value })
    audioResult.value = `完成: ${res.output} (${res.size_mb} MB)`
  } catch(e) { audioResult.value = e.message }
  audioReplacing.value = false
}
</script>
