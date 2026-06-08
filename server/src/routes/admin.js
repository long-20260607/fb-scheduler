const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/supabase');
const authMiddleware = require('../middleware/auth');
require('dotenv').config();

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ status: false, msg: '请输入用户名和密码' });
    }

    // 查询管理员
    const result = await db.query('SELECT * FROM admins WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.json({ status: false, msg: '用户名或密码错误' });
    }

    const admin = result.rows[0];

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.password_hash);

    if (!isValid) {
      return res.json({ status: false, msg: '用户名或密码错误' });
    }

    // 生成 JWT
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      status: true,
      msg: '登录成功',
      data: { token, username: admin.username }
    });
  } catch (error) {
    console.error('登录失败:', error);
    return res.json({ status: false, msg: '登录失败: ' + error.message });
  }
});

// 以下接口需要认证
router.use(authMiddleware);

// 快速创建激活码（默认一个月有效，1台设备）
router.post('/codes/quick', async (req, res) => {
  try {
    const { count = 1, max_devices = 1, duration_days = 30, prefix = '' } = req.body;

    if (count < 1 || count > 100) {
      return res.json({ status: false, msg: '数量范围 1-100' });
    }

    const genCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      return prefix + `${seg()}-${seg()}-${seg()}-${seg()}`
    }

    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(genCode());
    }

    const values = codes.map((code, index) => {
      const params = [`$${index * 3 + 1}`, `$${index * 3 + 2}`, `$${index * 3 + 3}`];
      return `(${params.join(', ')})`;
    }).join(', ');

    const flatParams = codes.flatMap(code => [code, duration_days, max_devices]);

    await db.query(
      `INSERT INTO activation_codes (code, duration_days, max_devices)
       VALUES ${values}`,
      flatParams
    );

    return res.json({
      status: true,
      msg: `成功创建 ${count} 个激活码（激活后 ${duration_days} 天有效）`,
      data: {
        codes,
        duration_days,
        max_devices
      }
    });
  } catch (error) {
    console.error('快速创建激活码失败:', error);
    return res.json({ status: false, msg: '创建失败: ' + error.message });
  }
});

// 获取激活码列表
router.get('/codes', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    const offset = (page - 1) * pageSize;

    let query = `SELECT ac.*, la.last_activated_at, la.device_expire_at FROM activation_codes ac
      LEFT JOIN LATERAL (
        SELECT MAX(activated_at) as last_activated_at, MAX(expire_at) as device_expire_at
        FROM device_activations da
        WHERE da.code_id = ac.id AND da.status = 'active'
      ) la ON true`;
    let countQuery = 'SELECT COUNT(*) as total FROM activation_codes ac';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push(`ac.status = $${params.length + 1}`);
      params.push(status);
    }

    if (keyword) {
      conditions.push(`ac.code ILIKE $${params.length + 1}`);
      params.push(`%${keyword}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY ac.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(pageSize), parseInt(offset));

    const [dataResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    return res.json({
      status: true,
      data: {
        list: dataResult.rows,
        total: parseInt(countResult.rows[0].total),
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取激活码列表失败:', error);
    return res.json({ status: false, msg: '获取失败: ' + error.message });
  }
});

// 创建激活码
router.post('/codes', async (req, res) => {
  try {
    const { code, duration_days = 30, max_devices = 1 } = req.body;

    if (!code) {
      return res.json({ status: false, msg: '请输入激活码' });
    }

    // 检查激活码是否已存在
    const existing = await db.query('SELECT id FROM activation_codes WHERE code = $1', [code]);

    if (existing.rows.length > 0) {
      return res.json({ status: false, msg: '激活码已存在' });
    }

    const result = await db.query(
      `INSERT INTO activation_codes (code, duration_days, max_devices)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [code, duration_days, max_devices]
    );

    return res.json({
      status: true,
      msg: '创建成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('创建激活码失败:', error);
    return res.json({ status: false, msg: '创建失败: ' + error.message });
  }
});

// 批量创建激活码
router.post('/codes/batch', async (req, res) => {
  try {
    const { count = 1, prefix = '', duration_days = 30, max_devices = 1 } = req.body;

    if (!count || count < 1 || count > 100) {
      return res.json({ status: false, msg: '数量范围 1-100' });
    }

    const genCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      return prefix + `${seg()}-${seg()}-${seg()}-${seg()}`
    }

    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(genCode());
    }

    const values = codes.map((code, index) => {
      const params = [`$${index * 3 + 1}`, `$${index * 3 + 2}`, `$${index * 3 + 3}`];
      return `(${params.join(', ')})`;
    }).join(', ');

    const flatParams = codes.flatMap(code => [code, duration_days, max_devices]);

    await db.query(
      `INSERT INTO activation_codes (code, duration_days, max_devices)
       VALUES ${values}`,
      flatParams
    );

    return res.json({
      status: true,
      msg: `成功创建 ${count} 个激活码（激活后 ${duration_days} 天有效）`,
      data: { codes, duration_days }
    });
  } catch (error) {
    console.error('批量创建激活码失败:', error);
    return res.json({ status: false, msg: '创建失败: ' + error.message });
  }
});

// 更新激活码
router.put('/codes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, expire_at, duration_days, max_devices } = req.body;

    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (expire_at !== undefined) {
      fields.push(`expire_at = $${paramIndex++}`);
      params.push(expire_at || null);
    }

    if (duration_days !== undefined) {
      fields.push(`duration_days = $${paramIndex++}`);
      params.push(duration_days);
    }

    if (max_devices !== undefined) {
      fields.push(`max_devices = $${paramIndex++}`);
      params.push(max_devices);
    }

    if (fields.length === 0) {
      return res.json({ status: false, msg: '没有需要更新的字段' });
    }

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE activation_codes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.json({ status: false, msg: '激活码不存在' });
    }

    return res.json({
      status: true,
      msg: '更新成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('更新激活码失败:', error);
    return res.json({ status: false, msg: '更新失败: ' + error.message });
  }
});

// 删除激活码
router.delete('/codes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM activation_codes WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({ status: false, msg: '激活码不存在' });
    }

    return res.json({ status: true, msg: '删除成功' });
  } catch (error) {
    console.error('删除激活码失败:', error);
    return res.json({ status: false, msg: '删除失败: ' + error.message });
  }
});

// 批量删除激活码
router.post('/codes/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json({ status: false, msg: '请选择要删除的激活码' });
    }

    if (ids.length > 100) {
      return res.json({ status: false, msg: '单次最多删除 100 条' });
    }

    const result = await db.query(
      'DELETE FROM activation_codes WHERE id = ANY($1) RETURNING id',
      [ids]
    );

    return res.json({
      status: true,
      msg: `成功删除 ${result.rows.length} 个激活码`
    });
  } catch (error) {
    console.error('批量删除失败:', error);
    return res.json({ status: false, msg: '删除失败: ' + error.message });
  }
});

// 获取统计数据
router.get('/stats', async (req, res) => {
  try {
    const [codesCount, activeCodesCount, activeDevicesCount, todayActivations] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM activation_codes'),
      db.query("SELECT COUNT(*) as count FROM activation_codes WHERE status = 'active'"),
      db.query("SELECT COUNT(*) as count FROM device_activations WHERE status = 'active'"),
      db.query("SELECT COUNT(*) as count FROM activation_logs WHERE action = 'activate' AND result = 'success' AND created_at >= CURRENT_DATE")
    ]);

    // 最近 7 天的激活趋势
    const trendResult = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM activation_logs
      WHERE action = 'activate' AND result = 'success' AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    return res.json({
      status: true,
      data: {
        totalCodes: parseInt(codesCount.rows[0].count),
        activeCodes: parseInt(activeCodesCount.rows[0].count),
        activeDevices: parseInt(activeDevicesCount.rows[0].count),
        todayActivations: parseInt(todayActivations.rows[0].count),
        trend: trendResult.rows
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return res.json({ status: false, msg: '获取失败: ' + error.message });
  }
});

// 获取操作日志
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, pageSize = 50, action, result, keyword } = req.query;
    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM activation_logs';
    let countQuery = 'SELECT COUNT(*) as total FROM activation_logs';
    const params = [];
    const conditions = [];

    if (action) {
      conditions.push(`action = $${params.length + 1}`);
      params.push(action);
    }

    if (result) {
      conditions.push(`result = $${params.length + 1}`);
      params.push(result);
    }

    if (keyword) {
      conditions.push(`(code ILIKE $${params.length + 1} OR finger_id ILIKE $${params.length + 1})`);
      params.push(`%${keyword}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(pageSize), parseInt(offset));

    const [dataResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    return res.json({
      status: true,
      data: {
        list: dataResult.rows,
        total: parseInt(countResult.rows[0].total),
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    return res.json({ status: false, msg: '获取失败: ' + error.message });
  }
});

module.exports = router;
