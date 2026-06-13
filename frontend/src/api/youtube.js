import api from './client'

export const youtubeApi = {
  list:    (params) => api.get('/api/youtube/list', { params }),
  import:  (body)   => api.post('/api/youtube/import', body),
  delete:  (body)   => api.post('/api/youtube/delete', body),
  edit:    (body)   => api.post('/api/youtube/edit', body),
  tagsGet: ()       => api.get('/api/youtube/tags'),
  tagsSave:(body)   => api.post('/api/youtube/tags', body),
}
