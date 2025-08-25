-- Create inventory_items table for the new Inventory feature
-- This replaces the current inventory_snapshots approach with a more robust design

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES threepls(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    warehouse_id TEXT NULL, -- Trackstar warehouse ID
    sku TEXT NOT NULL,
    product_name TEXT NULL,
    trackstar_product_id TEXT NULL, -- Trackstar product ID
    trackstar_variant_id TEXT NULL, -- Trackstar variant ID if applicable
    on_hand INTEGER NOT NULL DEFAULT 0,
    available INTEGER NOT NULL DEFAULT 0,
    incoming INTEGER NOT NULL DEFAULT 0,
    committed INTEGER NOT NULL DEFAULT 0,
    unfulfillable INTEGER NOT NULL DEFAULT 0,
    unsellable INTEGER NOT NULL DEFAULT 0,
    sellable INTEGER NOT NULL DEFAULT 0,
    awaiting INTEGER NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10,2) NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    last_trackstar_update_at TIMESTAMPTZ NULL,
    raw_data JSONB NULL, -- Full Trackstar inventory response
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_inventory_items_tenant_brand_sku ON inventory_items(tenant_id, brand_id, sku);
CREATE INDEX idx_inventory_items_tenant_brand_warehouse_sku ON inventory_items(tenant_id, brand_id, warehouse_id, sku);
CREATE INDEX idx_inventory_items_tenant_brand_updated_at ON inventory_items(tenant_id, brand_id, updated_at DESC);
CREATE INDEX idx_inventory_items_sku_search ON inventory_items USING gin(sku gin_trgm_ops);
CREATE INDEX idx_inventory_items_product_name_search ON inventory_items USING gin(product_name gin_trgm_ops);
CREATE INDEX idx_inventory_items_trackstar_product_id ON inventory_items(trackstar_product_id);

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_items_updated_at 
    BEFORE UPDATE ON inventory_items 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create improved webhook_events table for idempotency
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL, -- External event ID for idempotency
    source TEXT NOT NULL, -- 'trackstar', 'shopify', etc.
    event_type TEXT NOT NULL, -- 'inventory.updated', 'order.created', etc.
    tenant_id UUID NULL REFERENCES threepls(id) ON DELETE CASCADE,
    brand_id UUID NULL REFERENCES brands(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'failed'
    error TEXT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for webhook events
CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_source_status ON webhook_events(source, status);
CREATE INDEX idx_webhook_events_tenant_brand ON webhook_events(tenant_id, brand_id);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at DESC);

-- Update trigger for webhook_events
CREATE TRIGGER update_webhook_events_updated_at 
    BEFORE UPDATE ON webhook_events 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
