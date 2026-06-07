const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pluginRoutes = require('./routes/plugin');
const adminRoutes = require('./routes/admin');
const db = require('./db/supabase');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/plugin', pluginRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 初始化管理员账号
async function initAdmin() {
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM admins');

    if (parseInt(result.rows[0].count) === 0) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const passwordHash = await bcrypt.hash(password, 10);

      await db.query(
        'INSERT INTO admins (username, password_hash) VALUES ($1, $2)',
        [username, passwordHash]
      );

      console.log(`默认管理员账号已创建: ${username}`);
    }
  } catch (error) {
    console.error('初始化管理员账号失败:', error);
  }
}

// 启动服务
app.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
  initAdmin();
});

module.exports = app;
