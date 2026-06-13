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
        <el-input v-model="searchText" placeholder="搜索链接或标题..." style="flex:1;min-width:160px;" size="small" clearable />
        <span style="font-size:12px;color:#888;">已选 {{ selected.length }} 条</span>
        <el-button size="small" type="primary" @click="copySelectedLinks">复制链接</el-button>
        <el-button size="small" type="danger" @click="deleteSelected">删除选中</el-button>
      </div>

      <div class="yt-main">
        <div class="yt-list-col">
          <el-table :data="pagedVideos" @selection-change="v => selected = v" stripe size="small" max-height="500"
            highlight-current-row @row-click="playVideo" style="cursor:pointer;">
            <el-table-column type="selection" width="36" />
            <el-table-column prop="title" label="标题" show-overflow-tooltip>
              <template #default="{ row }">
                <div>{{ row.title }}</div>
                <div style="font-size:10px;color:#888;font-family:monospace;">{{ row.id }}</div>
              </template>
            </el-table-column>
            <el-table-column width="110">
              <template #default="{ row }">
                <el-tag size="small" type="warning" v-if="row.region">{{ row.region }}</el-tag>
                <el-tag size="small" v-if="row.frame_type" style="margin-left:2px;">{{ row.frame_type }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
            <el-pagination v-if="filteredVideos.length > ytPageSize"
              v-model:current-page="ytPage" :page-size="ytPageSize" :total="filteredVideos.length"
              layout="prev,pager,next" size="small" />
            <el-select v-model="ytPageSize" size="small" style="width:90px;margin-left:auto;">
              <el-option v-for="s in [10,20,50,100]" :key="s" :label="s+'条/页'" :value="s" />
            </el-select>
          </div>
        </div>
        <div class="yt-player-col">
          <iframe v-if="playingId" :src="'https://www.youtube.com/embed/' + playingId"
            style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px;" allowfullscreen />
          <div v-else style="width:100%;aspect-ratio:16/9;background:#f0f2f5;display:flex;align-items:center;justify-content:center;color:#999;border-radius:8px;">
            点击左侧视频播放
          </div>
          <div v-if="playingId" style="margin-top:8px;font-size:12px;color:#666;">
            {{ playingTitle }}
            <el-button link size="small" @click="copyLink(playingId)">复制链接</el-button>
          </div>
        </div>
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
import { ElMessageBox, ElMessage } from 'element-plus'

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
const playingTitle = ref('')
const ytPage = ref(1)
const ytPageSize = ref(20)

const filteredVideos = computed(() => {
  if (!searchText.value) return store.videos
  const q = searchText.value.toLowerCase()
  return store.videos.filter(v => (v.title || '').toLowerCase().includes(q) || (v.id || '').toLowerCase().includes(q))
})

const pagedVideos = computed(() => {
  const start = (ytPage.value - 1) * ytPageSize.value
  return filteredVideos.value.slice(start, start + ytPageSize.value)
})

async function loadVideos() { await store.loadVideos() }

onMounted(async () => {
  await store.loadTags()
  await loadVideos()
})

function playVideo(row) {
  playingId.value = row.id
  playingTitle.value = row.title
}

function copyLink(id) {
  const url = `https://www.youtube.com/watch?v=${id}`
  navigator.clipboard.writeText(url).then(() => ElMessage.success('已复制 ✓'))
}

async function copySelectedLinks() {
  const links = selected.value.map(v => `https://www.youtube.com/watch?v=${v.id}`).join('\n')
  await navigator.clipboard.writeText(links)
  ElMessage.success(`已复制 ${selected.value.length} 个链接 ✓`)
}

async function deleteSelected() {
  if (!selected.value.length) return
  await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个视频？`, '确认', { type: 'warning' })
  await store.deleteVideos(selected.value.map(v => v.id))
  selected.value = []
}

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

<style scoped>
.yt-main { display: flex; gap: 14px; }
.yt-list-col { width: 340px; flex-shrink: 0; }
.yt-player-col { flex: 1; min-width: 300px; }
</style>
