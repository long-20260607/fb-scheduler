# API 接口文档

## 启动服务

```bash
cd F:/project/Facebook定时发送/fb-scheduler/server
npm run dev
```

Base URL: `http://localhost:3000`

---

## 一、插件接口（无需认证）

所有接口都是 `POST` 请求，`Content-Type: application/json`。

### 1.1 激活插件

- **URL:** `POST /api/plugin/active`
- **说明:** 激活后有效期从激活时间开始计算（基于激活码的 `duration_days`）
- **Body:**

```json
{
  "fingerId": "device-001",
  "code": "TEST-001"
}
```

- **返回示例：**

```json
{ "status": true, "msg": "激活成功", "data": "2026-07-08T15:30:00.000Z" }
```

`data` 为设备级过期时间（激活时间 + duration_days）

### 1.2 取消激活

- **URL:** `POST /api/plugin/unactive`
- **Body:**

```json
{
  "fingerId": "device-001",
  "code": "TEST-001"
}
```

### 1.3 检查激活状态

- **URL:** `POST /api/plugin/checkTime`
- **Body:**

```json
{
  "fingerId": "device-001",
  "code": "TEST-001"
}
```

---

## 二、管理接口（需要认证）

管理接口需要先登录获取 JWT Token，然后在请求头中携带：

```
Authorization: Bearer <token>
```

### 2.1 管理员登录

- **URL:** `POST /api/admin/login`
- **Body:**

```json
{
  "username": "admin",
  "password": "admin123"
}
```

- **返回示例：**

```json
{
  "status": true,
  "msg": "登录成功",
  "data": { "token": "eyJhbGci...", "username": "admin" }
}
```

### 2.2 快速创建激活码

- **URL:** `POST /api/admin/codes/quick`
- **说明:** 自动生成激活码，激活后 30 天有效、1 台设备
- **Body:**

```json
{
  "count": 1,
  "duration_days": 30,
  "max_devices": 1,
  "expire_at": null,
  "prefix": ""
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| count | number | 否 | 1 | 创建数量（1-100） |
| duration_days | number | 否 | 30 | 激活后有效天数 |
| max_devices | number | 否 | 1 | 最大设备数 |
| expire_at | string | 否 | null | 激活截止时间，不填则无限制 |
| prefix | string | 否 | "" | 激活码前缀 |

### 2.3 创建单个激活码

- **URL:** `POST /api/admin/codes`
- **Body:**

```json
{
  "code": "MY-CODE-001",
  "duration_days": 30,
  "expire_at": null,
  "max_devices": 1
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 自定义激活码 |
| duration_days | number | 否 | 激活后有效天数，默认 30 |
| expire_at | string | 否 | 激活截止时间，不填则无限制 |
| max_devices | number | 否 | 最大设备数，默认 1 |

### 2.4 批量创建激活码

- **URL:** `POST /api/admin/codes/batch`
- **Body:**

```json
{
  "count": 10,
  "prefix": "FB-",
  "duration_days": 30,
  "expire_at": null,
  "max_devices": 1
}
```

### 2.5 获取激活码列表

- **URL:** `GET /api/admin/codes`
- **Query 参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 20 |
| status | string | 否 | 筛选状态：active / disabled / expired |
| keyword | string | 否 | 搜索关键字 |

- **示例:** `GET /api/admin/codes?page=1&pageSize=10&status=active`

### 2.6 更新激活码

- **URL:** `PUT /api/admin/codes/:id`
- **Body:**

```json
{
  "status": "disabled",
  "duration_days": 60,
  "expire_at": "2027-12-31T23:59:59",
  "max_devices": 3
}
```

### 2.7 删除激活码

- **URL:** `DELETE /api/admin/codes/:id`
- **示例:** `DELETE /api/admin/codes/550e8400-e29b-41d4-a716-446655440000`

### 2.8 获取统计数据

- **URL:** `GET /api/admin/stats`
- **返回示例：**

```json
{
  "status": true,
  "data": {
    "totalCodes": 100,
    "activeCodes": 80,
    "activeDevices": 45,
    "todayActivations": 5,
    "trend": [{ "date": "2026-06-08", "count": 5 }]
  }
}
```

### 2.9 获取操作日志

- **URL:** `GET /api/admin/logs`
- **Query 参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 50 |
| action | string | 否 | activate / deactivate / check |
| result | string | 否 | success / failed |
| keyword | string | 否 | 搜索 code 或 finger_id |

---

## 三、测试数据

运行以下命令插入测试激活码：

```bash
node scripts/seed-test-data.js
```

| Code | 用途 | 说明 |
|------|------|------|
| `DJRW-7HN2-3FQP-9XVL` | 正常激活 | 激活后 30 天有效，最多 3 台设备 |
| `A1B2-C3D4-E5F6-G7H8` | 设备数限制测试 | 激活后 30 天有效，仅限 1 台设备 |
| `XXXX-XXXX-XXXX-DIS1` | 禁用码测试 | 返回"激活码已禁用" |
| `XXXX-XXXX-XXXX-EXP1` | 过期码测试 | 已过激活截止时间，返回"激活码已过期" |
| `XXXX-XXXX-XXXX-NEXP` | 永不过期码 | 无激活截止时间，最多 5 台设备 |

---

## 四、推荐测试流程

### 插件接口测试

1. 用 `TEST-001` 调 `POST /api/plugin/active` → 激活成功
2. 再调一次 → 返回"设备已激活"
3. 调 `POST /api/plugin/checkTime` → 返回"激活有效"
4. 用 `TEST-DISABLED` 调 `/active` → 返回"激活码已禁用"
5. 用 `TEST-EXPIRED` 调 `/active` → 返回"激活码已过期"
6. 用 `TEST-002` 激活后换个 `fingerId` 再激活 → 返回"已达到最大设备数限制"
7. 用 `TEST-001` 调 `/unactive` → 取消激活成功
8. 调 `/checkTime` → 返回"设备未激活"

### 管理接口测试

1. `POST /api/admin/login` 登录获取 token
2. `POST /api/admin/codes/quick` 快速创建一个激活码
3. `GET /api/admin/codes` 查看激活码列表
4. `GET /api/admin/stats` 查看统计数据
5. `PUT /api/admin/codes/:id` 修改激活码状态为 disabled
6. `GET /api/admin/logs` 查看操作日志
