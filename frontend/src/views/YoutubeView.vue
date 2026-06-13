<template>
  <div>
    <h1>YouTube 视频管理</h1>
    <el-tabs :model-value="activeTab" @update:model-value="switchTab">
      <el-tab-pane label="视频展示" name="view" />
      <el-tab-pane label="导入视频" name="import" />
      <el-tab-pane label="标签配置" name="config" />
    </el-tabs>

    <!-- ===== 视频展示 ===== -->
    <div v-show="activeTab === 'view'">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <el-select v-model="store.filters.region" @change="loadVideos" placeholder="全部地区" clearable size="small">
          <el-option v-for="r in store.tags.regions" :key="r" :label="r" :value="r" />
        </el-select>
        <el-select v-model="store.filters.frame_type" @change="loadVideos" placeholder="全部帧类型" clearable size="small">
          <el-option v-for="f in store.tags.frame_types" :key="f" :label="f" :value="f" />
        </el-select>
        <el-select v-model="store.filters.effectiveness" @change="loadVideos" placeholder="全部成效" clearable size="small">
          <el-option v-for="e in store.tags.effectiveness" :key="e" :label="e" :value="e" />
        </el-select>
        <el-select v-model="store.filters.product_name" @change="loadVideos" placeholder="全部产品" clearable size="small">
          <el-option v-for="p in store.tags.product_names" :key="p" :label="p" :value="p" />
        </el-select>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap;">
        <el-input v-model="searchText" placeholder="搜索链接或标题..." @input="filterLocal" style="flex:1;min-width:160px;" size="small" clearable />
        <el-button size="small" @click="toggleSelectAll">全选</el-button>
        <el-button size="small" @click="invertSelection">反选</el-button>
        <span style="font-size:12px;color:#888;">已选 {{ selected.length }} 条</span>
        <el-button size="small" type="primary" @click="copySelectedLinks">复制链接</el-button>
        <el-button size="small" type="danger" @click="deleteSelected">删除选中</el-button>
      </div>

      <el-table :data="filteredVideos" @selection-change="v => selected = v" stripe size="small" max-height="400">
        <el-table-column type="selection" width="40" />
        <el-table-column prop="title" label="标题" show-overflow-tooltip />
        <el-table-column prop="id" label="Video ID" width="120" />
        <el-table-column prop="region" label="地区" width="80">
          <template #default="{ row }"><el-tag size="small" type="warning">{{ row.region }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="frame_type" label="帧类型" width="80" />
        <el-table-column prop="effectiveness" label="成效" width="70" />
        <el-table-column prop="product_name" label="产品" width="80" />
        <el-table-column prop="imported_at" label="导入时间" width="100" />
      </el-table>

      <div style="margin-top:8px;">
        <span v-if="selected.length" style="font-size:12px;color:#0891b2;cursor:pointer;" @click="playSelected">
          播放选中 ({{ selected[0]?.title }})
        </span>
        <iframe v-if="playingId" :src="'https://www.youtube.com/embed/' + playingId"
          style="width:100%;aspect-ratio:16/9;margin-top:8px;border:0;" allowfullscreen />
      </div>
    </div>

    <!-- ===== 导入视频 ===== -->
    <div v-show="activeTab === 'import'" style="max-width:600px;">
      <el-input v-model="importUrls" type="textarea" :rows="6" placeholder="每行一个 YouTube 链接..." />
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;">
        <el-select v-model="importRegion" placeholder="地区" size="small">
          <el-option v-for="r in store.tags.regions" :key="r" :label="r" :value="r" />
        </el-select>
        <el-select v-model="importFrame" placeholder="帧类型" size="small">
          <el-option v-for="f in store.tags.frame_types" :key="f" :label="f" :value="f" />
        </el-select>
        <el-select v-model="importEff" placeholder="成效" size="small" clearable>
          <el-option v-for="e in store.tags.effectiveness" :key="e" :label="e" :value="e" />
        </el-select>
        <el-select v-model="importProd" placeholder="产品名" size="small" clearable>
          <el-option v-for="p in store.tags.product_names" :key="p" :label="p" :value="p" />
        </el-select>
      </div>
      <el-button type="primary" @click="doImport" :loading="importing" style="margin-top:12px;">保存视频</el-button>
      <div v-if="importResult" style="margin-top:8px;font-size:12px;">{{ importResult }}</div>
    </div>

    <!-- ===== 标签配置 ===== -->
    <div v-show="activeTab === 'config'" style="max-width:600px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <el-form-item label="地区选项"><el-input v-model="cfgRegions" type="textarea" :rows="5" /></el-form-item>
        <el-form-item label="帧类型选项"><el-input v-model="cfgFrames" type="textarea" :rows="5" /></el-form-item>
      </div>
      <el-form-item label="成效选项"><el-input v-model="cfgEffs" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="产品名称选项"><el-input v-model="cfgProds" type="textarea" :rows="3" /></el-form-item>
      <el-button type="primary" @click="saveConfig" :loading="savingCfg">保存配置</el-button>
      <span v-if="cfgMsg" style="margin-left:8px;font-size:11px;color:#059669;">{{ cfgMsg }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useYoutubeStore } from '@/stores/youtube'
import { ElMessageBox } from 'element-plus'

const router = useRouter()
const route = useRoute()
const store = useYoutubeStore()

const activeTab = computed(() => {
  if (route.path.includes('/import')) return 'import'
  if (route.path.includes('/config')) return 'config'
  return 'view'
})
function switchTab(name) { router.push(`/youtube/${name}`) }

// View tab
const searchText = ref('')
const selected = ref([])
const playingId = ref('')

const filteredVideos = computed(() => {
  if (!searchText.value) return store.videos
  const q = searchText.value.toLowerCase()
  return store.videos.filter(v => (v.title || '').toLowerCase().includes(q) || (v.id || '').toLowerCase().includes(q))
})

async function loadVideos() { await store.loadVideos() }

onMounted(async () => {
  await store.loadTags()
  await loadVideos()
})

function filterLocal() {} // computed handles it

function toggleSelectAll() {
  if (selected.value.length === filteredVideos.value.length) {
    selected.value = []
  } else {
    selected.value = [...filteredVideos.value]
  }
}

function invertSelection() {
  const selIds = new Set(selected.value.map(s => s.id))
  selected.value = filteredVideos.value.filter(v => !selIds.has(v.id))
}

async function copySelectedLinks() {
  const links = selected.value.map(v => `https://www.youtube.com/watch?v=${v.id}`).join('\n')
  await navigator.clipboard.writeText(links)
}

async function deleteSelected() {
  if (!selected.value.length) return
  await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个视频？`, '确认', { type: 'warning' })
  await store.deleteVideos(selected.value.map(v => v.id))
  selected.value = []
}

function playSelected() { if (selected.value.length) playingId.value = selected.value[0].id }

// Import tab
const importUrls = ref('')
const importRegion = ref('通用')
const importFrame = ref('非融帧')
const importEff = ref('')
const importProd = ref('')
const importing = ref(false)
const importResult = ref('')

async function doImport() {
  const urls = importUrls.value.split(/[\n,]+/).map(s => s.trim()).filter(s => s && s.includes('youtu'))
  if (!urls.length) return
  importing.value = true
  const res = await store.importVideos({ urls, region: importRegion.value, frame_type: importFrame.value, effectiveness: importEff.value, product_name: importProd.value })
  importResult.value = `导入 ${res.imported} 个，重复 ${(res.duplicates || []).length} 个`
  importUrls.value = ''
  importing.value = false
  loadVideos()
}

// Config tab
const cfgRegions = ref(''); const cfgFrames = ref(''); const cfgEffs = ref(''); const cfgProds = ref('')
const savingCfg = ref(false); const cfgMsg = ref('')

onMounted(async () => {
  cfgRegions.value = (store.tags.regions || []).join('\n')
  cfgFrames.value = (store.tags.frame_types || []).join('\n')
  cfgEffs.value = (store.tags.effectiveness || []).filter(Boolean).join('\n')
  cfgProds.value = (store.tags.product_names || []).join('\n')
})

async function saveConfig() {
  savingCfg.value = true
  await store.saveTags({
    regions: cfgRegions.value.split('\n').map(s => s.trim()).filter(Boolean),
    frame_types: cfgFrames.value.split('\n').map(s => s.trim()).filter(Boolean),
    effectiveness: cfgEffs.value.split('\n').map(s => s.trim()).filter(Boolean),
    product_names: cfgProds.value.split('\n').map(s => s.trim()).filter(Boolean),
  })
  await store.loadTags()
  cfgMsg.value = '已保存'
  setTimeout(() => cfgMsg.value = '', 2000)
  savingCfg.value = false
}
</script>
