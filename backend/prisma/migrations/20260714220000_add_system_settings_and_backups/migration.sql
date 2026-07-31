-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT 'Kantin POS',
    "phone" TEXT,
    "address" TEXT,
    "logoPath" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
    "defaultCategoryId" INTEGER,
    "theme" TEXT NOT NULL DEFAULT 'LIGHT',
    "barcodeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "barcodeAutoAdd" BOOLEAN NOT NULL DEFAULT true,
    "barcodeQuantityMode" BOOLEAN NOT NULL DEFAULT false,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "backupDirectory" TEXT,
    "autoBackupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoBackupFrequency" TEXT,
    "lastBackupAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupRecord_createdAt_idx" ON "BackupRecord"("createdAt");

-- CreateIndex
CREATE INDEX "BackupRecord_status_createdAt_idx" ON "BackupRecord"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupRecord" ADD CONSTRAINT "BackupRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
