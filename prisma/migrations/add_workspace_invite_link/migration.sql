-- AlterTable
ALTER TABLE "public"."workspaces" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "public"."workspaces" ADD COLUMN "inviteRole" "public"."Role" DEFAULT 'VIEWER';

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_inviteToken_key" ON "public"."workspaces"("inviteToken");
