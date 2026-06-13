<template>
  <div>
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
      <el-button type="primary" @click="showModal()">➕ 新增账户</el-button>
      <span style="color:#888;font-size:12px;">已选 {{ selected.length }} 条</span>
      <el-button @click="batchDelete" :disabled="!selected.length">🗑 批量删除</el-button>
      <el-select v-model="batchStatus" @change="doBatchStatus" placeholder="批量修改状态..."
        style="width:160px;" :disabled="!selected.length" clearable>
        <el-option v-for="s in store.settings.account_statuses" :key="s" :label="s" :value="s" />
      </el-select>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <el-input v-model="store.acFilters.search" placeholder="🔍 搜索名称/ID..." @input="search" style="flex:1;" clearable />
      <el-select v-model="store.acFilters.status" @change="searchAndLoad" placeholder="全部状态" style="width:120px;" clearable>
        <el-option v-for="s in store.settings.account_statuses" :key="s" :label="s" :value="s" />
      </el-select>
      <el-select v-model="store.acFilters.mcc_id" @change="searchAndLoad" placeholder="全部 MCC" style="width:180px;" clearable>
        <el-option v-for="m in mccOptions" :key="m.id" :label="m.name + ' (' + m.mcc_id + ')'" :value="m.id" />
      </el-select>
      <el-select v-model="store.acFilters.agent" @change="searchAndLoad" placeholder="全部代理" style="width:130px;" clearable>
        <el-option v-for="a in agentOptions" :key="a" :label="a" :value="a" />
      </el-select>
    </div>

    <el-table :data="store.accounts" @selection-change="val => selected = val" stripe size="small">
      <el-table-column type="selection" width="40" />
      <el-table-column prop="name" label="账号名称" />
      <el-table-column prop="account_id" label="账号 ID" />
      <el-table-column label="所属 MCC">
        <template #default="{ row }">
          <template v-if="row.mcc_name">
            <span style="color:#0891b2;">{{ row.mcc_name }}</span><br/>
            <span style="font-size:10px;color:#888;">{{ row.mcc_code }}</span>
          </template>
          <span v-else style="color:#888;">未分配</span>
        </template>
      </el-table-column>
      <el-table-column prop="timezone" label="时区" />
      <el-table-column prop="agent" label="代理" />
      <el-table-column label="状态">
        <template #default="{ row }"><el-tag size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="acquired_date" label="到手时间" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="showModal(row.id)">✏️</el-button>
          <el-button link type="danger" size="small" @click="del(row.id)">🗑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-if="store.acTotal > store.acPageSize"
      v-model:current-page="store.acPage" :page-size="store.acPageSize" :total="store.acTotal"
      layout="prev,pager,next" @current-change="load" style="margin-top:12px;justify-content:center;" />

    <AccountModal v-model:visible="acModalVisible" :edit-id="acEditId" @saved="load" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAccountStore } from '@/stores/accounts'
import AccountModal from '@/components/AccountModal.vue'
import { ElMessageBox } from 'element-plus'

const store = useAccountStore()
const selected = ref([])
const acModalVisible = ref(false)
const acEditId = ref(null)
const batchStatus = ref('')
const mccOptions = ref([])
const agentOptions = ref([])
let searchTimer = null

onMounted(async () => {
  await store.loadSettings()
  await load()
})

async function load() {
  const res = await store.loadAccounts()
  mccOptions.value = res.mcc_options || []
  const set = new Set([...store.settings.account_agents, ...(res.agents || [])])
  agentOptions.value = [...set].filter(Boolean).sort()
}

function search() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { store.acPage = 1; load() }, 300)
}
function searchAndLoad() { store.acPage = 1; load() }
function showModal(id) { acEditId.value = id || null; acModalVisible.value = true }

async function del(id) {
  await ElMessageBox.confirm('确定删除此账户？', '确认', { type: 'warning' })
  await store.deleteAccount(id)
}

async function batchDelete() {
  if (!selected.value.length) return
  await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个账户？`, '确认', { type: 'warning' })
  await store.batchDeleteAccounts(selected.value.map(s => s.id))
}

async function doBatchStatus(val) {
  if (!val) return
  await store.batchUpdateAccounts({ ids: selected.value.map(s => s.id), field: 'status', value: val })
  batchStatus.value = ''
}
</script>
