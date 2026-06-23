import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/accounts'
  },
  {
    path: '/accounts',
    component: () => import('../views/AccountsView.vue'),
    redirect: '/accounts/products',
    children: [
      { path: 'products', component: () => import('../views/ProductPanel.vue'), meta: { title: '产品管理' } },
      { path: 'ads', component: () => import('../views/AdsAccountPanel.vue'), meta: { title: '广告账户' } },
      { path: 'mcc', component: () => import('../views/MccPanel.vue'), meta: { title: 'MCC 管理' } },
      { path: 'settings', component: () => import('../views/SettingsPanel.vue'), meta: { title: '设置' } },
    ]
  },
  {
    path: '/youtube',
    component: () => import('../views/YoutubeView.vue'),
    redirect: '/youtube/view',
    children: [
      { path: 'view', component: () => import('../views/YoutubeView.vue'), meta: { title: '视频展示' } },
      { path: 'copywriting', component: () => import('../views/YoutubeView.vue'), meta: { title: '文案展示' } },
      { path: 'import', component: () => import('../views/YoutubeView.vue'), meta: { title: '导入视频或文案' } },
      { path: 'config', component: () => import('../views/YoutubeView.vue'), meta: { title: '标签配置' } },
    ]
  },
  { path: '/scrape', component: () => import('../views/ScrapeView.vue'), meta: { title: '图片爬取' } },
  { path: '/video', component: () => import('../views/VideoView.vue'), meta: { title: 'AI 视频生成' } },
  {
    path: '/toolkit',
    component: () => import('../views/ToolkitView.vue'),
    redirect: '/toolkit/zuobiao',
    children: [
      { path: 'zuobiao', component: () => import('../views/ToolkitView.vue'), meta: { title: '做表数据' } },
      { path: 'audio', component: () => import('../views/ToolkitView.vue'), meta: { title: '音频替换' } },
      { path: 'translate', component: () => import('../views/ToolkitView.vue'), meta: { title: '翻译工具' } },
    ]
  },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
