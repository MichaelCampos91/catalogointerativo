-- Medidas gerenciáveis + índice para dashboard
-- Idempotente: seguro reexecutar
-- Seed espelhado do banco de produção de catalogoquerofesta (2026-07-30)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity INTEGER NOT NULL,
  meters NUMERIC(10, 2) NOT NULL CHECK (meters >= 0),
  observation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT measurements_quantity_unique UNIQUE (quantity),
  CONSTRAINT measurements_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_measurements_quantity ON measurements (quantity);

CREATE INDEX IF NOT EXISTS idx_orders_finalized_at
  ON orders (finalized_at)
  WHERE finalized_at IS NOT NULL AND canceled_at IS NULL;

-- Seed de produção Quero Festa (ON CONFLICT DO NOTHING)
INSERT INTO measurements (quantity, meters, observation) VALUES
  (2,   0.56, 'DINIZ'),
  (3,   0.56, 'DINIZ'),
  (4,   1.13, 'DINIZ'),
  (5,   1.13, 'DINIZ'),
  (6,   1.13, 'DINIZ'),
  (7,   1.69, 'DINIZ'),
  (8,   1.69, 'DINIZ'),
  (9,   1.69, 'DINIZ'),
  (10,  2.26, 'DINIZ'),
  (11,  2.26, 'DINIZ'),
  (12,  2.26, 'DINIZ'),
  (13,  2.82, 'DINIZ'),
  (15,  2.82, 'DINIZ'),
  (16,  3.39, 'DINIZ'),
  (17,  3.37, 'DINIZ'),
  (18,  3.39, 'DINIZ'),
  (20,  3.95, 'DINIZ'),
  (21,  3.95, 'DINIZ'),
  (22,  4.52, 'DINIZ'),
  (24,  4.52, 'DINIZ'),
  (26,  4.79, 'DINIZ'),
  (27,  5.09, 'DINIZ'),
  (28,  5.55, 'DINIZ'),
  (29,  5.65, 'DINIZ'),
  (30,  5.65, 'DINIZ'),
  (32,  6.10, 'DINIZ'),
  (35,  6.71, 'DINIZ'),
  (36,  6.77, 'DINIZ'),
  (39,  7.34, 'DINIZ'),
  (40,  7.76, 'DINIZ'),
  (42,  7.90, 'DINIZ'),
  (45,  9.30, 'DINIZ'),
  (48,  9.30, 'DINIZ'),
  (51,  9.60, 'DINIZ'),
  (60, 11.30, 'DINIZ'),
  (69, 13.00, 'DINIZ'),
  (72, 13.54, 'DINIZ'),
  (84, 15.80, 'DINIZ'),
  (120, 22.60, 'DINIZ')
ON CONFLICT (quantity) DO NOTHING;
