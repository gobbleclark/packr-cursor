-- Create warehouses table
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for tenant + external ID
CREATE UNIQUE INDEX "warehouses_tenantId_externalId_key" ON "warehouses"("tenantId", "externalId");

-- Add foreign key constraint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "threepls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add warehouse foreign key to inventory_items (if not exists)
-- Note: This assumes warehouseId in inventory_items will reference warehouses.externalId
-- The Prisma relation will handle the join properly
