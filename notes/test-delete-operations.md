# Delete Operations Test Plan

## Overview
This document outlines the comprehensive testing plan for the delete operations implemented for files, projects, and workspaces.

## Test Scenarios

### 1. File Deletion Tests

#### Test 1.1: Delete File with Annotations and Comments
**Setup:**
- Create a workspace
- Create a project in the workspace
- Upload a file to the project
- Add annotations to the file
- Add comments to the annotations
- Add replies to comments
- Add mentions in comments
- Create task assignments on annotations/comments
- Create notifications related to the file

**Test Steps:**
1. Navigate to the project
2. Click the delete button (trash icon) on a file card
3. Confirm deletion in the dialog
4. Verify the file is removed from the UI
5. Check database for orphaned records

**Expected Results:**
- File is deleted from database
- All annotations are deleted
- All comments and replies are deleted
- All comment mentions are deleted
- All task assignments are deleted
- All notifications are deleted
- All shareable links are deleted
- All file tags are deleted
- File is removed from Supabase storage (if not a website)
- No orphaned records remain

#### Test 1.2: Delete File with Different File Types
Test deletion of:
- Image files
- PDF files
- Video files
- Website snapshots

**Expected Results:**
- All file types are deleted correctly
- Website snapshots don't attempt storage deletion
- Other file types are removed from Supabase storage

#### Test 1.3: Permission Tests
**Test Steps:**
1. Try to delete a file as a VIEWER (should fail)
2. Try to delete a file as a COMMENTER (should fail)
3. Try to delete a file as an EDITOR (should succeed)
4. Try to delete a file as an ADMIN (should succeed)

**Expected Results:**
- Only EDITOR and ADMIN roles can delete files
- Proper error messages for unauthorized attempts

### 2. Project Deletion Tests

#### Test 2.1: Delete Project with Multiple Files
**Setup:**
- Create a workspace
- Create a project with multiple files
- Add annotations, comments, and other data to files
- Create folders in the project
- Add project tags
- Create shareable links for the project

**Test Steps:**
1. Navigate to the workspace
2. Click the delete button on a project card
3. Confirm deletion in the dialog
4. Verify the project is removed from the UI
5. Check database for orphaned records

**Expected Results:**
- Project is deleted from database
- All files in the project are deleted (cascading)
- All folders are deleted
- All project tags are deleted
- All shareable links are deleted
- All files are removed from Supabase storage
- No orphaned records remain

#### Test 2.2: Permission Tests
**Test Steps:**
1. Try to delete a project as a VIEWER (should fail)
2. Try to delete a project as a COMMENTER (should fail)
3. Try to delete a project as an EDITOR (should fail)
4. Try to delete a project as an ADMIN (should succeed)

**Expected Results:**
- Only ADMIN role can delete projects
- Proper error messages for unauthorized attempts

### 3. Workspace Deletion Tests

#### Test 3.1: Delete Workspace with Multiple Projects
**Setup:**
- Create a workspace with multiple projects
- Add files, annotations, comments to projects
- Add workspace members
- Create workspace tags

**Test Steps:**
1. Navigate to the workspace
2. Click the "Delete Workspace" button in the header
3. Type the workspace name to confirm deletion
4. Confirm deletion in the dialog
5. Verify redirect to dashboard
6. Check database for orphaned records

**Expected Results:**
- Workspace is deleted from database
- All projects are deleted (cascading)
- All files are deleted (cascading)
- All workspace members are deleted
- All workspace tags are deleted
- All files are removed from Supabase storage
- User is redirected to dashboard
- No orphaned records remain

#### Test 3.2: Permission Tests
**Test Steps:**
1. Try to delete a workspace as a non-owner (should fail)
2. Try to delete a workspace as the owner (should succeed)

**Expected Results:**
- Only workspace owner can delete workspace
- Proper error messages for unauthorized attempts

### 4. Error Handling Tests

#### Test 4.1: Network Error Handling
**Test Steps:**
1. Disconnect network
2. Attempt to delete a file/project/workspace
3. Verify error handling and user feedback

**Expected Results:**
- Proper error messages are displayed
- UI state is reset correctly
- No partial deletions occur

#### Test 4.2: Concurrent Deletion Tests
**Test Steps:**
1. Open multiple browser tabs
2. Attempt to delete the same item from different tabs
3. Verify proper handling of concurrent operations

**Expected Results:**
- First deletion succeeds
- Subsequent deletions show appropriate error messages
- No database inconsistencies

### 5. UI/UX Tests

#### Test 5.1: Confirmation Dialog Tests
**Test Steps:**
1. Click delete button on various items
2. Verify confirmation dialog appears
3. Test cancel functionality
4. Test confirmation functionality
5. Test workspace name confirmation requirement

**Expected Results:**
- Confirmation dialogs appear with correct information
- Cancel button works correctly
- Confirmation works correctly
- Workspace deletion requires name confirmation
- Loading states are shown during deletion

#### Test 5.2: Toast Notifications
**Test Steps:**
1. Perform successful deletions
2. Perform failed deletions
3. Verify toast notifications

**Expected Results:**
- Success toasts appear for successful deletions
- Error toasts appear for failed deletions
- Toast messages are clear and informative

## Database Verification Queries

After each deletion test, run these queries to verify no orphaned records:

```sql
-- Check for orphaned annotations
SELECT COUNT(*) FROM annotations a 
LEFT JOIN files f ON a.fileId = f.id 
WHERE f.id IS NULL;

-- Check for orphaned comments
SELECT COUNT(*) FROM comments c 
LEFT JOIN annotations a ON c.annotationId = a.id 
WHERE a.id IS NULL;

-- Check for orphaned task assignments
SELECT COUNT(*) FROM task_assignments ta 
LEFT JOIN annotations a ON ta.annotationId = a.id 
LEFT JOIN comments c ON ta.commentId = c.id 
WHERE a.id IS NULL AND c.id IS NULL;

-- Check for orphaned notifications
SELECT COUNT(*) FROM notifications n 
LEFT JOIN projects p ON n.projectId = p.id 
LEFT JOIN annotations a ON n.annotationId = a.id 
LEFT JOIN comments c ON n.commentId = c.id 
WHERE p.id IS NULL AND a.id IS NULL AND c.id IS NULL;

-- Check for orphaned shareable links
SELECT COUNT(*) FROM shareable_links sl 
LEFT JOIN projects p ON sl.projectId = p.id 
LEFT JOIN files f ON sl.fileId = f.id 
WHERE p.id IS NULL AND f.id IS NULL;

-- Check for orphaned file tags
SELECT COUNT(*) FROM file_tags ft 
LEFT JOIN files f ON ft.fileId = f.id 
WHERE f.id IS NULL;

-- Check for orphaned project tags
SELECT COUNT(*) FROM project_tags pt 
LEFT JOIN projects p ON pt.projectId = p.id 
WHERE p.id IS NULL;
```

## Performance Tests

### Test 6.1: Large Dataset Deletion
**Setup:**
- Create a workspace with 100+ projects
- Each project with 50+ files
- Each file with 20+ annotations
- Each annotation with 10+ comments

**Test Steps:**
1. Delete the entire workspace
2. Measure deletion time
3. Verify all data is deleted
4. Check for any timeouts or errors

**Expected Results:**
- Deletion completes within reasonable time (< 30 seconds)
- All data is properly deleted
- No timeouts or errors occur

## Security Tests

### Test 7.1: Authorization Bypass Tests
**Test Steps:**
1. Try to delete items using direct API calls without proper authentication
2. Try to delete items belonging to other users
3. Try to delete items with modified user roles

**Expected Results:**
- All unauthorized deletion attempts are blocked
- Proper 401/403 error responses
- No data is deleted inappropriately

## Rollback Tests

### Test 8.1: Transaction Rollback
**Test Steps:**
1. Simulate a database error during deletion
2. Verify transaction rollback occurs
3. Verify no partial deletions

**Expected Results:**
- Transaction is properly rolled back
- No partial deletions occur
- Database remains in consistent state

## Conclusion

This comprehensive test plan ensures that:
1. All delete operations work correctly
2. Dependencies are properly handled
3. No orphaned records are created
4. Permissions are properly enforced
5. Error handling works correctly
6. UI/UX is intuitive and safe
7. Performance is acceptable
8. Security is maintained

Run these tests in a development environment before deploying to production.
