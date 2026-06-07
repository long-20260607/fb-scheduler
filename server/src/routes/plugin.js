const express = require('express');
const router = express.Router();
const db = require('../db/supabase');

// 记录日志
async function logAction(action, code, fingerId, req, result, message) {
  try {
    await db.query(
      `INSERT INTO activation_logs (action, code, finger_id, ip_address, user_agent, result, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [action, code, fingerId, req.ip, req.headers['user-agent'], result, message]
    );
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}

// 激活插件
router.post('/active', async (req, res) => {
  try {
    const { fingerId, code } = req.body;

    if (!fingerId || !code) {
      await logAction('activate', code, fingerId, req, 'failed', '参数不完整');
      return res.json({ status: false, msg: '参数不完整' });
    }

    // 查询激活码
    const codeResult = await db.query(
      'SELECT * FROM activation_codes WHERE code = $1',
      [code]
    );

    if (codeResult.rows.length === 0) {
      await logAction('activate', code, fingerId, req, 'failed', '激活码不存在');
      return res.json({ status: false, msg: '激活码不存在' });
    }

    const codeData = codeResult.rows[0];

    // 检查激活码状态
    if (codeData.status === 'disabled') {
      await logAction('activate', code, fingerId, req, 'failed', '激活码已禁用');
      return res.json({ status: false, msg: '激活码已禁用' });
    }

    if (codeData.status === 'expired') {
      await logAction('activate', code, fingerId, req, 'failed', '激活码已过期');
      return res.json({ status: false, msg: '激活码已过期' });
    }

    // 检查是否过期
    if (codeData.expire_at && new Date(codeData.expire_at) < new Date()) {
      await db.query('UPDATE activation_codes SET status = $1 WHERE id = $2', ['expired', codeData.id]);
      await logAction('activate', code, fingerId, req, 'failed', '激活码已过期');
      return res.json({ status: false, msg: '激活码已过期' });
    }

    // 检查设备数量限制
    const activeDevices = await db.query(
      'SELECT COUNT(*) as count FROM device_activations WHERE code_id = $1 AND status = $2',
      [codeData.id, 'active']
    );

    if (parseInt(activeDevices.rows[0].count) >= codeData.max_devices) {
      // 检查当前设备是否已激活
      const existingDevice = await db.query(
        'SELECT * FROM device_activations WHERE code_id = $1 AND finger_id = $2 AND status = $3',
        [codeData.id, fingerId, 'active']
      );

      if (existingDevice.rows.length === 0) {
        await logAction('activate', code, fingerId, req, 'failed', '已达到最大设备数限制');
        return res.json({ status: false, msg: '已达到最大设备数限制' });
      }
    }

    // 检查设备是否已激活
    const existingActivation = await db.query(
      'SELECT * FROM device_activations WHERE code_id = $1 AND finger_id = $2 AND status = $3',
      [codeData.id, fingerId, 'active']
    );

    if (existingActivation.rows.length > 0) {
      // 已激活，更新最后检查时间
      await db.query(
        'UPDATE device_activations SET last_check_at = NOW() WHERE id = $1',
        [existingActivation.rows[0].id]
      );
      await logAction('activate', code, fingerId, req, 'success', '设备已激活');
      return res.json({
        status: true,
        msg: '设备已激活',
        data: codeData.expire_at ? codeData.expire_at.toISOString() : null
      });
    }

    // 创建新的激活记录
    await db.query(
      'INSERT INTO device_activations (code_id, finger_id, status) VALUES ($1, $2, $3)',
      [codeData.id, fingerId, 'active']
    );

    await logAction('activate', code, fingerId, req, 'success', '激活成功');

    return res.json({
      status: true,
      msg: '激活成功',
      data: codeData.expire_at ? codeData.expire_at.toISOString() : null
    });
  } catch (error) {
    console.error('激活失败:', error);
    await logAction('activate', req.body.code, req.body.fingerId, req, 'failed', error.message);
    return res.json({ status: false, msg: '激活失败: ' + error.message });
  }
});

// 取消激活
router.post('/unactive', async (req, res) => {
  try {
    const { fingerId, code } = req.body;

    if (!fingerId || !code) {
      await logAction('deactivate', code, fingerId, req, 'failed', '参数不完整');
      return res.json({ status: false, msg: '参数不完整' });
    }

    // 查询激活码
    const codeResult = await db.query(
      'SELECT * FROM activation_codes WHERE code = $1',
      [code]
    );

    if (codeResult.rows.length === 0) {
      await logAction('deactivate', code, fingerId, req, 'failed', '激活码不存在');
      return res.json({ status: false, msg: '激活码不存在' });
    }

    const codeData = codeResult.rows[0];

    // 查找激活记录
    const activationResult = await db.query(
      'SELECT * FROM device_activations WHERE code_id = $1 AND finger_id = $2 AND status = $3',
      [codeData.id, fingerId, 'active']
    );

    if (activationResult.rows.length === 0) {
      await logAction('deactivate', code, fingerId, req, 'failed', '未找到激活记录');
      return res.json({ status: false, msg: '未找到激活记录' });
    }

    // 更新激活状态为非活跃
    await db.query(
      'UPDATE device_activations SET status = $1 WHERE id = $2',
      ['inactive', activationResult.rows[0].id]
    );

    await logAction('deactivate', code, fingerId, req, 'success', '取消激活成功');

    return res.json({ status: true, msg: '取消激活成功' });
  } catch (error) {
    console.error('取消激活失败:', error);
    await logAction('deactivate', req.body.code, req.body.fingerId, req, 'failed', error.message);
    return res.json({ status: false, msg: '取消激活失败: ' + error.message });
  }
});

// 检查激活状态
router.post('/checkTime', async (req, res) => {
  try {
    const { fingerId, code } = req.body;

    if (!fingerId || !code) {
      await logAction('check', code, fingerId, req, 'failed', '参数不完整');
      return res.json({ status: false, msg: '参数不完整' });
    }

    // 查询激活码
    const codeResult = await db.query(
      'SELECT * FROM activation_codes WHERE code = $1',
      [code]
    );

    if (codeResult.rows.length === 0) {
      await logAction('check', code, fingerId, req, 'failed', '激活码不存在');
      return res.json({ status: false, msg: '激活码不存在' });
    }

    const codeData = codeResult.rows[0];

    // 检查激活码状态
    if (codeData.status !== 'active') {
      await logAction('check', code, fingerId, req, 'failed', '激活码已失效');
      return res.json({ status: false, msg: '激活码已失效' });
    }

    // 检查是否过期
    if (codeData.expire_at && new Date(codeData.expire_at) < new Date()) {
      await db.query('UPDATE activation_codes SET status = $1 WHERE id = $2', ['expired', codeData.id]);
      await logAction('check', code, fingerId, req, 'failed', '激活码已过期');
      return res.json({ status: false, msg: '激活码已过期' });
    }

    // 查找激活记录
    const activationResult = await db.query(
      'SELECT * FROM device_activations WHERE code_id = $1 AND finger_id = $2 AND status = $3',
      [codeData.id, fingerId, 'active']
    );

    if (activationResult.rows.length === 0) {
      await logAction('check', code, fingerId, req, 'failed', '设备未激活');
      return res.json({ status: false, msg: '设备未激活' });
    }

    // 更新最后检查时间
    await db.query(
      'UPDATE device_activations SET last_check_at = NOW() WHERE id = $1',
      [activationResult.rows[0].id]
    );

    await logAction('check', code, fingerId, req, 'success', '激活有效');

    return res.json({
      status: true,
      msg: '激活有效',
      data: codeData.expire_at ? codeData.expire_at.toISOString() : null
    });
  } catch (error) {
    console.error('检查激活状态失败:', error);
    await logAction('check', req.body.code, req.body.fingerId, req, 'failed', error.message);
    return res.json({ status: false, msg: '检查失败: ' + error.message });
  }
});

module.exports = router;
