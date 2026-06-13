import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: '',
    isLoggedIn: false,
  }),
  actions: {
    login(credentials) { /* 后续实现 */ },
    logout() { this.user = null; this.token = ''; this.isLoggedIn = false; },
  },
})
