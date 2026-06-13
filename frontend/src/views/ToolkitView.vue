<template>
  <div>
    <h1>🧰 工具集</h1>
    <el-tabs :model-value="activeTab" @update:model-value="switchTab">
      <el-tab-pane label="📊 做表数据" name="zuobiao" />
      <el-tab-pane label="🎵 音频替换" name="audio" />
    </el-tabs>

    <!-- ===== 做表数据 ===== -->
    <div v-show="activeTab === 'zuobiao'">
      <p style="color:#888;margin-bottom:8px;font-size:13px;">粘贴包含"添加过滤条件"和"Total"的原始竖排数据：</p>
      <el-checkbox v-model="zbIncludeCampaignId" size="small" style="margin-bottom:8px;">包含广告系列ID（原数据11列，自动剔除第5列）</el-checkbox>
      <el-input v-model="zbInput" type="textarea" :rows="8" placeholder="在此粘贴原始数据..." />
      <div style="display:flex;gap:8px;margin-top:8px;">
        <el-button type="primary" @click="zbProcess">🚀 一键解析并生成所有报表</el-button>
        <el-button @click="zbExportExcel" :disabled="!zbRaw.length">📥 导出全部为 Excel</el-button>
      </div>
      <div v-if="zbError" style="color:#dc2626;margin-top:8px;">{{ zbError }}</div>

      <!-- 原始清洗数据 -->
      <div v-if="zbRaw.length" style="margin-top:20px;">
        <h3>📋 原始清洗数据 <el-tag size="small">{{ zbRaw.length }}</el-tag>
          <el-button link size="small" @click="copyTable('zbRaw')">📋 一键复制</el-button>
        </h3>
        <el-table :data="zbRaw" size="small" border stripe max-height="300" :id="'zbTableRaw'">
          <el-table-column prop="account" label="账号" /><el-table-column prop="customerId" label="客户ID" />
          <el-table-column prop="campaign" label="广告系列" />
          <el-table-column prop="cost" label="费用"><template #default="{row}">{{ row.cost.toFixed(2) }}</template></el-table-column>
          <el-table-column prop="impressions" label="展示次数"><template #default="{row}">{{ row.impressions.toLocaleString() }}</template></el-table-column>
          <el-table-column prop="clicks" label="点击次数"><template #default="{row}">{{ row.clicks.toLocaleString() }}</template></el-table-column>
        </el-table>
      </div>

      <!-- 做表数据 -->
      <div v-if="zbZuobiao.length" style="margin-top:20px;">
        <h3>📑 做表数据 <el-tag size="small">{{ zbZuobiao.length }}</el-tag>
          <el-button link size="small" @click="copyTable('zbZuobiao')">📋 一键复制</el-button>
        </h3>
        <el-table :data="zbZuobiao" size="small" border stripe max-height="300">
          <el-table-column prop="account" label="账号" /><el-table-column prop="customerId" label="客户ID" />
          <el-table-column prop="cost" label="费用"><template #default="{row}">{{ row.cost.toFixed(2) }}</template></el-table-column>
          <el-table-column width="20" /><el-table-column width="20" /><el-table-column width="20" /><el-table-column width="20" />
          <el-table-column prop="campaign" label="广告系列" />
        </el-table>
      </div>

      <!-- 客户表数据 -->
      <div v-if="zbKehu.length" style="margin-top:20px;">
        <h3>📈 客户表数据 <el-tag size="small">{{ zbKehu.length }}</el-tag>
          <el-button link size="small" @click="copyTable('zbKehu')">📋 一键复制</el-button>
        </h3>
        <el-table :data="zbKehu" size="small" border stripe max-height="300">
          <el-table-column prop="campaign" label="广告系列" />
          <el-table-column prop="cost" label="费用"><template #default="{row}">{{ row.cost.toFixed(2) }}</template></el-table-column>
          <el-table-column prop="impressions" label="展示次数"><template #default="{row}">{{ row.impressions.toLocaleString() }}</template></el-table-column>
          <el-table-column prop="clicks" label="点击次数"><template #default="{row}">{{ row.clicks.toLocaleString() }}</template></el-table-column>
        </el-table>
      </div>
    </div>

    <!-- ===== 音频替换 ===== -->
    <div v-show="activeTab === 'audio'" style="max-width:600px;">
      <el-form-item label="🎬 原视频">
        <div style="display:flex;gap:6px;">
          <el-input v-model="audioVideoPath" placeholder="F:\video\test.mp4" style="flex:1;" />
          <el-button @click="doBrowseFile('video')" style="width:44px;">📂</el-button>
        </div>
      </el-form-item>
      <el-form-item label="🎶 新音频源（音频或视频）">
        <div style="display:flex;gap:6px;">
          <el-input v-model="audioSourcePath" placeholder="F:\music\bg.mp3 或 F:\video\source.mp4" style="flex:1;" />
          <el-button @click="doBrowseFile('audio')" style="width:44px;">📂</el-button>
        </div>
        <span class="hint">支持 .mp3/.wav/.aac/.m4a 等音频，或 .mp4 等视频（自动提取音频）</span>
      </el-form-item>
      <el-button type="primary" @click="audioReplace" :loading="audioReplacing">🎵 替换音频</el-button>
      <div v-if="audioResult" style="margin-top:8px;font-size:12px;">{{ audioResult }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useVideoStore } from '@/stores/video'
import { browseApi } from '@/api/browse'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const vStore = useVideoStore()

const activeTab = computed(() => route.path.includes('/audio') ? 'audio' : 'zuobiao')
function switchTab(name) { router.push(`/toolkit/${name}`) }

// ========== 做表数据 ==========
const zbInput = ref('')
const zbIncludeCampaignId = ref(false)
const zbRaw = ref([])
const zbZuobiao = ref([])
const zbKehu = ref([])
const zbError = ref('')

function zbProcess() {
  zbError.value = ''
  zbRaw.value = []; zbZuobiao.value = []; zbKehu.value = []
  const input = zbInput.value.trim()
  if (!input) { zbError.value = '请输入数据'; return }
  try {
    const lines = input.split(/\r?\n/).map(l => l.trim()).filter(l => l)
    const starts = []; lines.forEach((l, i) => { if (l === '添加过滤条件') starts.push(i) })
    if (!starts.length) throw new Error('未找到"添加过滤条件"')
    const startIdx = starts[starts.length - 1]
    const endIdx = lines.indexOf('Total')
    if (endIdx < 0) throw new Error('未找到"Total"')
    if (startIdx >= endIdx) throw new Error('数据顺序异常')

    const includeCampaignId = zbIncludeCampaignId.value
    const step = includeCampaignId ? 11 : 10
    const costIdx = includeCampaignId ? 5 : 4
    const imprIdx = includeCampaignId ? 6 : 5
    const clickIdx = includeCampaignId ? 7 : 6

    const validLines = lines.slice(startIdx + 1, endIdx)
    const rows = []
    for (let i = 0; i < validLines.length; i += step) {
      const row = validLines.slice(i, i + step)
      if (row.length === step && /^\d{3}-\d{3}-\d{4}$/.test(row[1]) && row[costIdx].includes('US$')) {
        rows.push(row)
      }
    }
    if (!rows.length) throw new Error('未找到有效数据（请确认费用列是否包含 "US$"）')

    zbRaw.value = rows.map(r => ({
      account: r[0], customerId: r[1],
      campaign: r[2].replace(/-[^-]*$/, '').trim(),
      cost: parseFloat(r[costIdx].replace(/[^0-9.-]+/g, '')) || 0,
      impressions: parseInt(r[imprIdx].replace(/[^0-9]/g, '')) || 0,
      clicks: parseInt(r[clickIdx].replace(/[^0-9]/g, '')) || 0,
    }))

    // 做表数据：按客户ID+广告系列聚合费用
    const zbMap = new Map()
    zbRaw.value.forEach(d => {
      const key = d.customerId + '|||' + d.campaign
      if (!zbMap.has(key)) zbMap.set(key, { account: d.account, customerId: d.customerId, cost: d.cost, campaign: d.campaign })
      else zbMap.get(key).cost += d.cost
    })
    zbZuobiao.value = Array.from(zbMap.values())

    // 客户表：按广告系列聚合
    const khMap = new Map()
    zbRaw.value.forEach(d => {
      if (!khMap.has(d.campaign)) khMap.set(d.campaign, { campaign: d.campaign, cost: 0, impressions: 0, clicks: 0 })
      const item = khMap.get(d.campaign)
      item.cost += d.cost; item.impressions += d.impressions; item.clicks += d.clicks
    })
    zbKehu.value = Array.from(khMap.values())
  } catch(e) { zbError.value = e.message }
}

function copyTable(type) {
  const data = type === 'zbZuobiao' ? zbZuobiao.value : type === 'zbKehu' ? zbKehu.value : zbRaw.value
  if (!data.length) return
  let lines
  if (type === 'zbZuobiao') {
    lines = data.map(d => [d.account, d.customerId, d.cost.toFixed(2), '', '', '', '', d.campaign].join('\t'))
  } else if (type === 'zbKehu') {
    lines = data.map(d => [d.campaign, d.cost.toFixed(2), d.impressions, d.clicks].join('\t'))
  } else {
    lines = data.map(d => [d.account, d.customerId, d.campaign, d.cost.toFixed(2), d.impressions, d.clicks].join('\t'))
  }
  navigator.clipboard.writeText(lines.join('\n')).then(() => ElMessage.success('已复制 ✓'))
}

function zbExportExcel() {
  // 使用 XLSX CDN（如果已加载）
  const XLSX = window.XLSX
  if (!XLSX) { ElMessage.warning('Excel 导出需要加载 XLSX 库，请稍后重试'); return }
  try {
    const wb = XLSX.utils.book_new()
    const rawSheet = XLSX.utils.json_to_sheet(zbRaw.value)
    XLSX.utils.book_append_sheet(wb, rawSheet, '原始清洗数据')

    const zbSheet = XLSX.utils.aoa_to_sheet([
      ['账号','客户ID','费用','','','','','广告系列'],
      ...zbZuobiao.value.map(d => [d.account, d.customerId, d.cost, '', '', '', '', d.campaign])
    ])
    XLSX.utils.book_append_sheet(wb, zbSheet, '做表数据')

    const khSheet = XLSX.utils.json_to_sheet(zbKehu.value)
    XLSX.utils.book_append_sheet(wb, khSheet, '客户表数据')

    XLSX.writeFile(wb, 'Ads多维分析_' + Date.now() + '.xlsx')
    ElMessage.success('导出成功')
  } catch(e) { ElMessage.error('导出失败: ' + e.message) }
}

// ========== 音频替换 ==========
const audioVideoPath = ref('')
const audioSourcePath = ref('')
const audioReplacing = ref(false)
const audioResult = ref('')

async function doBrowseFile(type) {
  const fileType = type === 'video' ? 'video' : 'audio'
  const curPath = type === 'video' ? audioVideoPath.value : audioSourcePath.value
  let initialDir = null
  if (curPath) {
    const lastSep = Math.max(curPath.lastIndexOf('/'), curPath.lastIndexOf('\\'))
    if (lastSep > -1) initialDir = curPath.substring(0, lastSep)
  }
  try {
    const res = await browseApi.file({ type: fileType, initial_dir: initialDir })
    if (res.path) {
      if (type === 'video') audioVideoPath.value = res.path
      else audioSourcePath.value = res.path
    }
  } catch(e) { ElMessage.error('文件选择失败: ' + e.message) }
}

async function audioReplace() {
  if (!audioVideoPath.value || !audioSourcePath.value) { ElMessage.warning('请选择原视频和音频源'); return }
  audioReplacing.value = true; audioResult.value = ''
  try {
    const res = await vStore.audioReplace({ video_path: audioVideoPath.value, audio_source: audioSourcePath.value })
    audioResult.value = `✅ 完成: ${res.output} (${res.size_mb} MB)`
  } catch(e) { audioResult.value = '❌ ' + e.message }
  audioReplacing.value = false
}

const hint = 'font-size:11px;color:#888;margin-top:4px;display:block;'
</script>
