# Cloudflare Pages + Supabase Edge Functions 部署指南

## 架构说明

```
用户 → Cloudflare Pages (前端) → Supabase Edge Functions (后端) → Supabase Database
```

- **前端**：Vue + Vite，部署到 Cloudflare Pages
- **后端**：Supabase Edge Functions（已在 `supabase/functions/` 目录）
- **数据库**：Supabase PostgreSQL（已有）

---

## 一、API 接口对照

### 旧接口 → 新接口

| 功能 | 旧地址 (Express) | 新地址 (Edge Functions) |
|------|-----------------|------------------------|
| 激活插件 | `POST /api/plugin/active` | `POST /functions/v1/plugin-active` |
| 取消激活 | `POST /api/plugin/unactive` | `POST /functions/v1/plugin-unactive` |
| 检查状态 | `POST /api/plugin/checkTime` | `POST /functions/v1/plugin-check-time` |
| 管理员登录 | `POST /api/admin/login` | `POST /functions/v1/admin-login` |
| 获取激活码列表 | `GET /api/admin/codes` | `GET /functions/v1/admin-codes` |
| 创建激活码 | `POST /api/admin/codes` | `POST /functions/v1/admin-codes` |
| 批量创建 | `POST /api/admin/codes/batch` | `POST /functions/v1/admin-codes` (带 `_action: "batch"`) |
| 更新激活码 | `PUT /api/admin/codes/:id` | `PUT /functions/v1/admin-codes?id=ID` |
| 删除激活码 | `DELETE /api/admin/codes/:id` | `DELETE /functions/v1/admin-codes?id=ID` |
| 批量删除 | `POST /api/admin/codes/batch-delete` | `POST /functions/v1/admin-codes` (带 `ids` 数组) |
| 统计数据 | `GET /api/admin/stats` | `GET /functions/v1/admin-stats` |
| 操作日志 | `GET /api/admin/logs` | `GET /functions/v1/admin-logs` |

### 完整 URL 示例

Base URL: `https://hizynzkovnnugjedqpuw.supabase.co/functions/v1`

插件端调用示例：
```
POST https://hizynzkovnnugjedqpuw.supabase.co/functions/v1/plugin-active
```

管理后台前端自动切换（开发环境用本地 Express，生产环境用 Edge Functions）。

---

## 二、部署后端（Supabase Edge Functions）

### 1. 安装 Supabase CLI

Windows 用户推荐使用 Scoop 安装：

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

> 如果没有安装 Scoop，先运行：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; iex -Command "& { $(Invoke-WebRequest -UseBasicParsing -Uri 'https://get.scoop.sh') }"`

也可以使用 npm 安装：`npm install -g supabase`

### 2. 登录 Supabase

```bash
supabase login
```

### 3. 关联项目

```bash
cd F:/project/Facebook定时发送/fb-scheduler
supabase link --project-ref hizynzkovnnugjedqpuw
```

### 4. 创建密码验证函数

在 Supabase Dashboard → SQL Editor 中执行：

```sql
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$;
```

### 5. 设置环境变量

在 Supabase Dashboard → Edge Functions → Settings 中添加：

```
JWT_SECRET=fb-scheduler-secret-2024-xK9mP2vL
```

### 6. 部署函数

```bash
supabase functions deploy plugin-active
supabase functions deploy plugin-unactive
supabase functions deploy plugin-check-time
supabase functions deploy admin-login
supabase functions deploy admin-codes
supabase functions deploy admin-stats
supabase functions deploy admin-logs
```

### 7. 测试函数

Base URL: `https://hizynzkovnnugjedqpuw.supabase.co/functions/v1`

所有请求需要在 Header 中添加：

```
Content-Type: application/json
apikey: YOUR_ANON_KEY
```

#### 7.1 插件接口（无需 JWT）

**激活插件** `POST /plugin-active`

```json
{
  "fingerId": "device-001",
  "code": "DJRW-7HN2-3FQP-9XVL"
}
```

**取消激活** `POST /plugin-unactive`

```json
{
  "fingerId": "device-001",
  "code": "DJRW-7HN2-3FQP-9XVL"
}
```

**检查状态** `POST /plugin-check-time`

```json
{
  "fingerId": "device-001",
  "code": "DJRW-7HN2-3FQP-9XVL"
}
```

#### 7.2 管理接口（需要 JWT）

先调登录接口拿 token：

**管理员登录** `POST /admin-login`

```json
{
  "username": "admin",
  "password": "admin123"
}
```

登录成功后，后续请求 Header 中添加：

```
Authorization: Bearer 返回的token
```

**获取激活码列表** `GET /admin-codes?page=1&pageSize=20`

**创建激活码** `POST /admin-codes`

```json
{
  "code": "MY-CODE-001",
  "duration_days": 30,
  "max_devices": 1
}
```

**快速创建** `POST /admin-codes`

```json
{
  "count": 5,
  "duration_days": 30,
  "max_devices": 1,
  "prefix": "FB-"
}
```

**批量删除** `POST /admin-codes`

```json
{
  "ids": ["id1", "id2"]
}
```

**更新激活码** `PUT /admin-codes?id=激活码ID`

```json
{
  "status": "disabled",
  "duration_days": 60,
  "max_devices": 3
}
```

**删除激活码** `DELETE /admin-codes?id=激活码ID`

**获取统计数据** `GET /admin-stats`

**获取操作日志** `GET /admin-logs?page=1&pageSize=50&action=activate&result=success`

---

## 三、部署前端（Cloudflare Pages）

### 1. 构建前端

```bash
cd admin
npm run build
```

### 2. 部署到 Cloudflare Pages

**方式一：通过 Cloudflare Dashboard**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Pages → Create a project → Upload assets
3. 上传 `admin/dist` 目录
4. 设置环境变量：
   - `VITE_SUPABASE_URL` = `https://hizynzkovnnugjedqpuw.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = 你的 anon key

**方式二：通过 Wrangler CLI**

```bash
npm install -g wrangler
wrangler login
cd admin
wrangler pages deploy dist --project-name fb-scheduler-admin
```

### 3. 配置环境变量

在 Cloudflare Pages 项目设置 → Environment variables 中添加：

```
VITE_SUPABASE_URL=https://hizynzkovnnugjedqpuw.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon_key
```

### 4. 获取 anon key

在 Supabase Dashboard → Settings → API 中找到 `anon` `public` key。

---

## 四、更新插件端点

插件（浏览器扩展）需要调用新的 Edge Functions 地址：

```javascript
// 旧地址
const API_BASE = 'http://your-server:3000/api/plugin'

// 新地址
const API_BASE = 'https://hizynzkovnnugjedqpuw.supabase.co/functions/v1'
```

调用方式：
```javascript
// 激活
fetch(`${API_BASE}/plugin-active`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fingerId: 'xxx', code: 'xxx' })
})
```

---

## 五、域名配置（可选）

### Cloudflare Pages 自定义域名

1. 在 Pages 项目设置 → Custom domains
2. 添加你的域名（如 `admin.yourdomain.com`）
3. 按提示配置 DNS

### Supabase Edge Functions 自定义域名

Supabase 暂不支持自定义域名，使用默认的 `*.supabase.co` 即可。

---

## 六、常见问题

### Q: Edge Functions 调用报 401？

A: 确保请求头包含 `apikey`（anon key）和 `Authorization`（JWT token）。

### Q: 前端能访问但插件访问不了？

A: Edge Functions 默认有 CORS 限制，已在函数中配置允许跨域。

### Q: 如何查看函数日志？

A: 在 Supabase Dashboard → Edge Functions → 选择函数 → Logs。
