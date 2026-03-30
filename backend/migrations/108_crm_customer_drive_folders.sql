CREATE TABLE IF NOT EXISTS crm_customer_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255) NOT NULL,
  drive_folder_id VARCHAR(255) NOT NULL,
  folder_name VARCHAR(255) NOT NULL,
  folder_url TEXT,
  folder_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source VARCHAR(64) NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_customer_drive_folders_customer
  ON crm_customer_drive_folders(customer_id);

CREATE INDEX IF NOT EXISTS idx_crm_customer_drive_folders_user
  ON crm_customer_drive_folders(user_id);
