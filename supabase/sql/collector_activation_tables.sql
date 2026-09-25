-- 采集插件（fb-page-collector）激活码表：与 activation_codes 同构，完全独立
CREATE TABLE IF NOT EXISTS collector_activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'expired')),
  expire_at TIMESTAMPTZ,
  duration_days INTEGER DEFAULT 30,
  max_devices INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 采集插件设备激活记录表：与 device_activations 同构
CREATE TABLE IF NOT EXISTS collector_device_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID REFERENCES collector_activation_codes(id) ON DELETE CASCADE,
  finger_id VARCHAR(100) NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expire_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  UNIQUE(code_id, finger_id)
);

CREATE INDEX IF NOT EXISTS idx_collector_activation_codes_code ON collector_activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_collector_activation_codes_status ON collector_activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_collector_device_activations_code_id ON collector_device_activations(code_id);
CREATE INDEX IF NOT EXISTS idx_collector_device_activations_finger_id ON collector_device_activations(finger_id);
