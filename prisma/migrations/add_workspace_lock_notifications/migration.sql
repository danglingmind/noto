-- AlterEnum: Add new notification types for workspace locking
ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_LOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_UNLOCKED';


