-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinFailures" INTEGER DEFAULT 0,
ADD COLUMN     "pinLockedUntil" TIMESTAMP(3),
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "email" DROP DEFAULT,
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "phone" DROP DEFAULT;

-- Blank phones must become NULL so more than one account can exist without a number.
UPDATE "User" SET phone = NULL WHERE phone = '';
UPDATE "User" SET email = NULL WHERE email = '';

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
