UPDATE "MarketplaceRegistration" SET "platform" = 'ruta' WHERE "platform" = 'openfront-rideshare';
UPDATE "MarketplaceRegistration" SET "sourceId" = 'source-ruta-local' WHERE "sourceId" = 'source-openfront-rideshare-local';
ALTER TABLE "MarketplaceRegistration" ALTER COLUMN "platform" SET DEFAULT 'ruta';
