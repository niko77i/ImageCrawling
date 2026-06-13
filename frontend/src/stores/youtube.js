import { defineStore } from 'pinia'
import { youtubeApi } from '@/api/youtube'

export const useYoutubeStore = defineStore('youtube', {
  state: () => ({
    videos: [],
    counts: {},
    tags: { regions: [], frame_types: [], effectiveness: [], product_names: [] },
    filters: { region: '', frame_type: '', effectiveness: '', product_name: '' },
  }),

  actions: {
    async loadVideos() {
      const res = await youtubeApi.list(this.filters)
      this.videos = res.videos
      this.counts = res.counts
    },
    async importVideos(body) { return youtubeApi.import(body) },
    async deleteVideos(ids) { await youtubeApi.delete({ ids }); return this.loadVideos() },
    async editVideo(body) { return youtubeApi.edit(body) },
    async loadTags() { const res = await youtubeApi.tagsGet(); this.tags = res.tags; return res },
    async saveTags(body) { return youtubeApi.tagsSave(body) },
  },
})
