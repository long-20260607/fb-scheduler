# FB Scheduler - 管理后台

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API 地址

编辑 `vite.config.js`，修改代理配置指向你的后端地址：

```js
proxy: {
  '/api': {
    target: 'http://your-server:3000',
    changeOrigin: true
  }
}
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 4. 构建生产版本

```bash
npm run build
```

构建产物在 `dist` 目录

## 功能说明

### 仪表盘
- 激活码总数统计
- 有效激活码数量
- 激活设备数
- 今日激活数
- 近 7 天激活趋势图

### 激活码管理
- 查看激活码列表
- 单个创建激活码
- 批量创建激活码
- 编辑激活码（过期时间、最大设备数）
- 启用/禁用激活码
- 删除激活码

### 操作日志
- 查看所有操作记录
- 按操作类型筛选
- 按结果筛选
- 搜索激活码或设备 ID

## 部署

### Vercel / Netlify

1. 将代码推送到 GitHub
2. 在 Vercel / Netlify 中导入项目
3. 配置环境变量（如果有）
4. 部署

### 自有服务器

```bash
# 构建
npm run build

# 将 dist 目录部署到 Nginx
```

Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name admin.example.com;

    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
