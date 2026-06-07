# FB Scheduler - 后端 API

## 快速开始

### 1. 配置 Supabase

1. 访问 [Supabase](https://supabase.com) 注册账号
2. 创建新项目
3. 在 SQL Editor 中执行 `src/db/schema.sql` 创建表
4. 获取数据库连接字符串

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入 Supabase 数据库连接信息：

```env
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres
JWT_SECRET=your-random-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
```

### 3. 安装依赖

```bash
npm install
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 http://localhost:3000 启动

## API 接口

### 插件接口

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/plugin/active` | POST | fingerId, code | 激活插件 |
| `/api/plugin/unactive` | POST | fingerId, code | 取消激活 |
| `/api/plugin/checkTime` | POST | fingerId, code | 检查激活状态 |

### 管理接口（需要 Bearer Token）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/login` | POST | 管理员登录 |
| `/api/admin/codes` | GET | 获取激活码列表 |
| `/api/admin/codes` | POST | 创建激活码 |
| `/api/admin/codes/batch` | POST | 批量创建激活码 |
| `/api/admin/codes/:id` | PUT | 更新激活码 |
| `/api/admin/codes/:id` | DELETE | 删除激活码 |
| `/api/admin/stats` | GET | 获取统计数据 |
| `/api/admin/logs` | GET | 获取操作日志 |

## 部署

### Vercel / Netlify

1. 将代码推送到 GitHub
2. 在 Vercel / Netlify 中导入项目
3. 配置环境变量
4. 部署

### 自有服务器

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/app.js --name fb-scheduler

# 保存并设置开机自启
pm2 save
pm2 startup
```
