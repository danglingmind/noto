-- CreateEnum
CREATE TYPE "public"."ViewportType" AS ENUM ('DESKTOP', 'TABLET', 'MOBILE');

-- AlterTable
ALTER TABLE "public"."annotations" ADD COLUMN     "viewport" "public"."ViewportType";
