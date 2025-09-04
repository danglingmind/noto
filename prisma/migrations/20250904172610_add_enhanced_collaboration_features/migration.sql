-- CreateEnum
CREATE TYPE "public"."SharePermission" AS ENUM ('VIEW_ONLY', 'COMMENT', 'ANNOTATE');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('COMMENT_ADDED', 'COMMENT_REPLY', 'COMMENT_MENTION', 'COMMENT_RESOLVED', 'ANNOTATION_ADDED', 'PROJECT_SHARED', 'FILE_UPLOADED', 'WORKSPACE_INVITE');

-- CreateEnum
CREATE TYPE "public"."TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."files" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "public"."shareable_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT,
    "projectId" TEXT,
    "fileId" TEXT,
    "permissions" "public"."SharePermission" NOT NULL DEFAULT 'VIEW_ONLY',
    "password" TEXT,
    "expiresAt" TIMESTAMP(3),
    "maxViews" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessed" TIMESTAMP(3),

    CONSTRAINT "shareable_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "commentId" TEXT,
    "annotationId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."comment_mentions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "mentionedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_assignments" (
    "id" TEXT NOT NULL,
    "commentId" TEXT,
    "annotationId" TEXT,
    "assignedTo" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "public"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."file_tags" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "file_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_tags" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "project_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shareable_links_token_key" ON "public"."shareable_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "comment_mentions_commentId_mentionedUserId_key" ON "public"."comment_mentions"("commentId", "mentionedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_workspaceId_name_key" ON "public"."tags"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "file_tags_fileId_tagId_key" ON "public"."file_tags"("fileId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "project_tags_projectId_tagId_key" ON "public"."project_tags"("projectId", "tagId");

-- AddForeignKey
ALTER TABLE "public"."files" ADD CONSTRAINT "files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "public"."folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shareable_links" ADD CONSTRAINT "shareable_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shareable_links" ADD CONSTRAINT "shareable_links_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shareable_links" ADD CONSTRAINT "shareable_links_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "public"."annotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comment_mentions" ADD CONSTRAINT "comment_mentions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comment_mentions" ADD CONSTRAINT "comment_mentions_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comment_mentions" ADD CONSTRAINT "comment_mentions_mentionedBy_fkey" FOREIGN KEY ("mentionedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_assignments" ADD CONSTRAINT "task_assignments_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_assignments" ADD CONSTRAINT "task_assignments_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "public"."annotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_assignments" ADD CONSTRAINT "task_assignments_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_assignments" ADD CONSTRAINT "task_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."folders" ADD CONSTRAINT "folders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."folders" ADD CONSTRAINT "folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."folders" ADD CONSTRAINT "folders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tags" ADD CONSTRAINT "tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tags" ADD CONSTRAINT "tags_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."file_tags" ADD CONSTRAINT "file_tags_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."file_tags" ADD CONSTRAINT "file_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_tags" ADD CONSTRAINT "project_tags_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_tags" ADD CONSTRAINT "project_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
