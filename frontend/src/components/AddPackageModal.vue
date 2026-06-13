<template>
  <el-dialog :model-value="visible" @update:model-value="$emit('update:visible', $event)"
    title="➕ 添加包" width="600px" @open="init">
    <el-form label-position="top">
      <el-form-item label="系列名前缀（可选）">
        <el-input v-model="form.prefix" placeholder="如 P222-A" />
      </el-form-item>
      <el-form-item label="系列名后缀（可选）">
        <el-input v-model="form.suffix" placeholder="如 carl" />
      </el-form-item>
      <el-form-item label="粘贴内容">
        <el-input v-model="form.text" type="textarea" :rows="6" placeholder="粘贴包含链接的文本..." />
      </el-form-item>
      <el-button @click="preview" :loading="parsing">🔍 预览解析</el-button>

      <div v-if="parsed.length" style="margin-top:8px;">
        <p>识别 <strong>{{ parsed.length }}</strong> 个包：</p>
        <el-input v-model="editText" type="textarea" :rows="Math.min(parsed.length, 4)" style="font-size:11px;" />
      </div>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="submit" :loading="saving" :disabled="!parsed.length">💾 添加</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useProductStore } from '@/stores/products'

const props = defineProps({ visible: Boolean, prodId: Number })
const emit = defineEmits(['update:visible', 'saved'])
const store = useProductStore()
const saving = ref(false)
const parsing = ref(false)
const parsed = ref([])
const editText = ref('')

const form = reactive({ prefix: '', suffix: '', text: '' })

function init() {
  Object.assign(form, { prefix: '', suffix: '', text: '' })
  parsed.value = []
  editText.value = ''
}

async function preview() {
  if (!form.text) return
  parsing.value = true
  const res = await store.importText({
    text: form.text, prefix: form.prefix, suffix: form.suffix,
    product_name: '', kpi: '', region: '',
  })
  parsed.value = res.parsed || []
  editText.value = parsed.value.map(p => (p.series_name || '') + ' | ' + (p.package_name || '') + ' | ' + (p.url || '')).join('\n')
  parsing.value = false
}

async function submit() {
  if (!parsed.value.length) return
  saving.value = true
  for (const pkg of parsed.value) {
    await store.addPackage(props.prodId, { series_name: pkg.series_name, package_name: pkg.package_name, url: pkg.url })
  }
  saving.value = false
  emit('update:visible', false)
  emit('saved')
}
</script>
