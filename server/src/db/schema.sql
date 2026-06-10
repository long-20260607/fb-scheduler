-- 激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'expired')),
  expire_at TIMESTAMPTZ,
  duration_days INTEGER DEFAULT 30,
  max_devices INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 设备激活记录表
CREATE TABLE IF NOT EXISTS device_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID REFERENCES activation_codes(id) ON DELETE CASCADE,
  finger_id VARCHAR(100) NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expire_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  UNIQUE(code_id, finger_id)
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS activation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  code VARCHAR(50),
  finger_id VARCHAR(100),
  ip_address VARCHAR(50),
  user_agent TEXT,
  result VARCHAR(20),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_device_activations_code_id ON device_activations(code_id);
CREATE INDEX IF NOT EXISTS idx_device_activations_finger_id ON device_activations(finger_id);
CREATE INDEX IF NOT EXISTS idx_activation_logs_created_at ON activation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activation_logs_action_result_created ON activation_logs(action, result, created_at);
