<template>
  <div>
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
      <el-button type="primary" @click="showModal()">➕ 新增 MCC</el-button>
      <span style="color:#888;font-size:12px;">已选 {{ selected.length }} 条</span>
      <el-button @click="batchDelete" :disabled="!selected.length">🗑 批量删除</el-button>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <el-input v-model="store.mccFilters.search" placeholder="🔍 搜索名称/ID..." @input="search" style="flex:1;" clearable />
      <el-input v-model="store.mccFilters.level" placeholder="等级关键词..." @input="search" style="width:150px;" clearable />
      <el-select v-model="store.mccFilters.parent_filter" @change="searchAndLoad" style="width:130px;" clearable placeholder="全部上级">
        <el-option label="有上级" value="has_parent" />
        <el-option label="顶级节点" value="top" />
      </el-select>
    </div>

    <el-table :data="store.mccList" @selection-change="val => selected = val" stripe size="small">
      <el-table-column type="selection" width="40" />
      <el-table-column prop="name" label="MCC 名称" />
      <el-table-column prop="mcc_id" label="MCC ID" />
      <el-table-column prop="level" label="等级" />
      <el-table-column label="上级 MCC">
        <template #default="{ row }">
          {{ row.parent_mcc_id ? '有上级' : '—（顶级）' }}
        </template>
      </el-table-column>
      <el-table-column prop="direct_count" label="账户数（直属）" width="110" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="showDetail(row.id)">📋</el-button>
          <el-button link type="primary" size="small" @click="showModal(row.id)">✏️</el-button>
          <el-button link type="danger" size="small" @click="del(row.id)">🗑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-if="store.mccTotal > store.mccPageSize"
      v-model:current-page="store.mccPage" :page-size="store.mccPageSize" :total="store.mccTotal"
      layout="prev,pager,next" @current-change="load" style="margin-top:12px;justify-content:center;" />

    <MccModal v-model:visible="modalVisible" :edit-id="editId" @saved="load" />
    <MccDetailModal v-model:visible="detailVisible" :mcc-id="detailId" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAccountStore } from '@/stores/accounts'
import MccModal from '@/components/MccModal.vue'
import MccDetailModal from '@/components/MccDetailModal.vue'
import { ElMessageBox } from 'element-plus'

const store = useAccountStore()
const selected = ref([])
const modalVisible = ref(false)
const editId = ref(null)
const detailVisible = ref(false)
const detailId = ref(null)
let searchTimer = null

onMounted(() => load())

function load() { store.loadMccList() }
function search() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { store.mccPage = 1; load() }, 300)
}
function searchAndLoad() { store.mccPage = 1; load() }
function showModal(id) { editId.value = id || null; modalVisible.value = true }
function showDetail(id) { detailId.value = id; detailVisible.value = true }

async function del(id) {
  await ElMessageBox.confirm('确定删除此 MCC？', '确认', { type: 'warning' })
  await store.deleteMcc(id)
}

async function batchDelete() {
  if (!selected.value.length) return
  await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个 MCC？`, '确认', { type: 'warning' })
  await store.batchDeleteMcc(selected.value.map(s => s.id))
}
</script>
