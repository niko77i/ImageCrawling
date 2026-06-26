# GG-Server 实现计划

**日期**：2026-06-24
**基于设计**：[设计规格](/docs/superpowers/specs/2026-06-23-gg-server-design.md)

## Phase 1 - 用户系统基础

这是最核心的部分，完成后可以登录注册、JWT 护航、原有功能原样使用。

### Step 1.1 - 创建 GG-Server 项目目录结构

**操作**：在 `F:\carl_work\carl\Google\cc\` 下创建 `GG-Server/` 目录，拷贝现有项目的核心文件。

**扩展文件列表**：

| 源文件 | 目标文件 | 操作 |
|------|------|------|
| ImageCrawling/py/main.py | GG-Server/py/main.py | 拷贝 + 修改 |
| ImageCrawling/py/database.py | GG-Server/py/database.py | 拷贝 + 修改 |
| ImageCrawling/py/scraper.py | GG-Server/py/scraper.py | 拷贝 |
| ImageCrawling/py/resizer.py | GG-Server/py/resizer.py | 拷贝 |
| ImageCrawling/py/utils.py | GG-Server/py/utils.py | 拷贝 |
| ImageCrawling/py/video_processor.py | GG-Server/py/video_processor.py | 拷贝 |
| ImageCrawling/py/ai_service.py | GG-Server/py/ai_service.py | 拷贝 |
| ImageCrawling/frontend/ | GG-Server/frontend/ | 拷贝 + 修改 |
| ImageCrawling/ffmpeg.exe | GG-Server/ffmpeg.exe | 拷贝 |
| ImageCrawling/requirements.txt | GG-Server/requirements.txt | 拷贝 + 添加依赖 |

**新建文件**：
- `GG-Server/py/auth.py` — 认证模块
- `GG-Server/config/config.json` — 初始化配置（包含 developer 账户）
- `GG-Server/temp/` — 运行时数据目录

### Step 1.2 - config/config.json 配置文件

```json
{
  "secret_key": "random-secret-key-here",
  "jwt_expire_hours": 24,
  "jwt_refresh_days": 7,
  "developer": {
    "username": "carl567",
    "password": "1976xiaobai"
  },
  "server": {
    "host": "0.0.0.0",
    "port": 5000,
    "debug": false
  },
  "scrape_cache_dir": "temp/scrape_cache"
}
```

**说明**：
- main.py 启动时读取此文件
- secret_key 用于 JWT 签名，如果不存在则自动生成
- 启动时检查 developer 账号，不存在则自动创建

### Step 1.3 - py/auth.py 认证模块

**文件**：`GG-Server/py/auth.py`

**内容**：
- `hash_password(password)` -> str
- `check_password(password, hashed)` -> bool
- `create_user(username, password, role='user', display_name='', created_by=None)` -> dict
- `get_user_by_id(user_id)` -> dict | None
- `get_user_by_username(username)` -> dict | None
- `list_users(search='', page=1, page_size=20)` -> { users, total }
- `update_user_role(user_id, new_role)` -> bool
- `toggle_user_status(user_id)` -> bool (hidden <-> user)
- `init_developer(config)` -> None

**技术细节**：
- 密码哈希：Werkzeug `generate_password_hash` (pbkdf2:sha256)
- JWT 生成：Flask-JWT-Extended `create_access_token` / `create_refresh_token`
- SQL 执行：统一通过 database.py 的 `db_query()` / `db_execute()`

### Step 1.4 - py/database.py 修改

**文件**：`GG-Server/py/database.py`

**变更**：
- 新增 `users` 表创建 (SQL 见设计文档)
- 新增 migration 逻辑，启动时自动创建表
- 新增 `db_get()` 辅助函数：查询单行
- 新增 `db_insert()` 辅助函数：插入并返回 rowid
- SQLite WAL 模式：启动时执行 `PRAGMA journal_mode=WAL;`

### Step 1.5 - py/main.py 修改

**文件**：`GG-Server/py/main.py`

**变更**：
1. 添加 Flask-JWT-Extended 初始化
2. 加载 config.json 配置
3. 启动时调用 `auth.init_developer(config)`
4. 添加 4 个 auth 路由：
   - `POST /api/auth/login` -> 返回 JWT token
   - `POST /api/auth/register` -> 创建 user 账户
   - `POST /api/auth/refresh` -> 刷新 token
   - `GET /api/auth/me` -> 当前用户信息
5. 现有路由全部加 `@jwt_required()` 装饰器
   - 产品管理路由：共享，无需 user_id 过滤
   - 账户/MCC 路由：暂时保留原样（Phase 2 再改）
   - YouTube 路由：暂时保留原样（Phase 2 再改）
6. Flask-CORS 配置保留

### Step 1.6 - 前端基础架构

#### 1.6.1 api/client.js 修改

```js
import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  resp => resp.data,
  err => {
    if (err.response?.status === 401 && !err.config.url?.includes('/auth/')) {
      localStorage.removeItem('token')
      window.location.hash = '#/login'
    }
    return Promise.reject(err)
  }
)
export default api
```

#### 1.6.2 stores/auth.js 完整实现

```js
import { defineStore } from 'pinia'
import api from '../api/client'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || '',
    isLoggedIn: !!localStorage.getItem('token'),
  }),
  actions: {
    async login(username, password) {
      const res = await api.post('/auth/login', { username, password })
      this.token = res.access_token
      this.user = res.user
      this.isLoggedIn = true
      localStorage.setItem('token', res.access_token)
      localStorage.setItem('user', JSON.stringify(res.user))
    },
    async register(username, password, display_name) {
      await api.post('/auth/register', { username, password, display_name })
    },
    async fetchMe() {
      const res = await api.get('/auth/me')
      this.user = res.user
      localStorage.setItem('user', JSON.stringify(res.user))
    },
    logout() {
      this.$reset()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },
  getters: {
    isAdmin: (state) => ['developer', 'admin'].includes(state.user?.role),
    isDeveloper: (state) => state.user?.role === 'developer',
  },
})
```

#### 1.6.3 router/index.js 修改

```js
// 新增登录/注册路由
{ path: '/login', component: () => import('../views/LoginView.vue'), meta: { guest: true } },
{ path: '/register', component: () => import('../views/RegisterView.vue'), meta: { guest: true } },

// 全局路由守卫
router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.guest) return next()
  if (!auth.isLoggedIn) return next('/login?redirect=' + to.path)
  next()
})
```

#### 1.6.4 LoginView.vue

- 登录表单：用户名 + 密码 + 登录按钮
- 注册链接：底部“没有账号？立即注册”
- 登录成功后跳转到 `?redirect=` 参数指定的页面
- 错误提示：用户名或密码错误

#### 1.6.5 RegisterView.vue

- 注册表单：用户名 + 密码 + 确认密码 + 显示名
- 注册成功后自动登录并跳转
- 已有账号？立即登录链接
- 校验：用户名不能重复、4-20 位字符、密码至岑 6 位

#### 1.6.6 App.vue 修改

- 初始化时调用 `fetchMe()` 验证 token 有效性
- 如果 token \u8fc7期，自动跳转登录页

## Phase 2 - 数据隔离

### Step 2.1 - 帐户/MCC 个人化

**目标**：用户只能看到自己创建的帐户和 MCC。

**变更**：
- 数据表新增 `owner_id` 字段（如果不存在）
- API 中百分比所有查询加 `WHERE owner_id = ?`
- 创建时自动填充 `owner_id = get_jwt_identity()`

### Step 2.2 - YouTube 公共 + 私人双层模型

**变更**：
- yt_videos 表新增 `owner_id` 和 `is_public`
- API 新增 `scope` 参数（public/private/all）
- 前端切换标签：“我的视频” / “公共视频库”

### Step 2.3 - 爬取缓存共享

**变更**：
- 新增 `scrape_cache` 表
- scraper.py 增加缓存命中逻辑：先查 cache，命中则返回本地路径
- 爬取成功后自动写入 cache
- 截图文件存储在 `config.scrape_cache_dir`

### Step 2.4 - 视频生成历史个人化

**变更**：
- video_history 表新增 `owner_id`
- API 中加 `WHERE owner_id = ?` 过滤

## Phase 3 - 用户管理后台

### Step 3.1 - 后端 API

```
GET    /api/admin/users                  - 用户列表（搜索/分页）
POST   /api/admin/users/:id/role        - 修改用户角色
POST   /api/admin/users/:id/toggle      - 启用/禁用用户
DELETE /api/admin/users/:id             - 删除用户（不能删除自己）
```

所有路由需要 `@admin_required` 装饰器。

### Step 3.2 - UserManageView.vue 前端

- 仅 developer/admin 可见，导航栏增加“用户管理”链接
- 用户列表表格：ID、用户名、显示名、角色、状态、创建时间、最后登录
- 操作：编辑角色、启用/禁用、删除用户
- 搜索框+分页

## Phase 4 - 稳定与优化

### Step 4.1 - 登录页 UI 美化

- 登录/注册页社计与主体应用风格一致
- Element Plus 组件外观统一

### Step 4.2 - 错误处理

- Token 过期自动跳转登录页
- API 异常提示（网络错误、服务器错误）
- 注册校验提示

### Step 4.3 - SQLite WAL 模式

- database.py 启动时执行 `PRAGMA journal_mode=WAL;`
- 如果需要更高并发，加 `PRAGMA synchronous=NORMAL;`

### Step 4.4 - 启动脚本 + 说明文档

- `start.bat`：启动 Flask 服务器
- `start-dev.bat`：同时启动 Flask + Vite dev server
- README.md：部署说明、用户手册

## 执行顺序

1. Phase 1 Steps 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6（必须按此顺序）
2. Phase 2 Steps 2.1 ~ 2.4（可并行）
3. Phase 3 Steps 3.1 → 3.2（后端先前端后）
4. Phase 4 Steps 4.1 ~ 4.4（可并行）

每个 Phase 完成后催测试验证，确认正常后再进入下一个 Phase。