# Modern File Table Layout - Complete Implementation Guide

## Overview
Create a minimal, modern file listing table view using shadcn/ui components. The layout displays files in a clean table format with equal-width columns, no card wrapper, and intuitive interactions.

## Component Structure

### Main Container
- Wrapper: `<div className="mb-8">`
- No card wrapper around the table (no border, rounded corners, or shadow)

### Header Section
Located above the table with the following structure:

```tsx
<div className="flex items-center justify-between mb-6">
  {/* Left side */}
  <div className="flex items-center gap-2">
    {/* Reload button */}
    <Button 
      size="sm" 
      variant="outline"
      disabled={isReloading}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isReloading ? 'animate-spin' : ''}`} />
      {isReloading ? 'Reloading...' : 'Reload'}
    </Button>
    
    {/* File count - only show if files.length > 0 */}
    {files.length > 0 && (
      <span className="text-sm text-muted-foreground">
        {files.length} {files.length === 1 ? 'file' : 'files'}
      </span>
    )}
  </div>
  
  {/* Right side - only show if canEdit */}
  {canEdit && (
    <div className="flex space-x-2">
      <Button size="sm" variant="outline">
        <Globe className="h-4 w-4 mr-2" />
        Add Webpage
      </Button>
      <Button size="sm">
        <Upload className="h-4 w-4 mr-2" />
        Upload File
      </Button>
    </div>
  )}
</div>
```

## Table Structure

### Table Component
Use shadcn/ui Table components:
- `Table` (no wrapper div, no border/rounded/shadow)
- `TableHeader`
- `TableBody`
- `TableRow`
- `TableHead`
- `TableCell`

### Table Header
```tsx
<TableHeader>
  <TableRow className="hover:bg-transparent border-b">
    <TableHead>Name</TableHead>
    <TableHead>Type</TableHead>
    <TableHead>Modified</TableHead>
    <TableHead></TableHead> {/* Empty header for actions */}
  </TableRow>
</TableHeader>
```

**Important**: All columns have equal width (no width classes specified).

### Table Rows
Each row has the following structure:

```tsx
<TableRow 
  className="group cursor-pointer hover:bg-muted/30 transition-colors"
>
  {/* Name Column */}
  <TableCell>
    <Link className="flex items-center gap-3 min-w-0">
      {/* File Icon */}
      {file.fileType === 'WEBSITE' ? (
        <div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
          {getFileIcon(file.fileType)}
        </div>
      ) : (
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200/50 shadow-sm">
          {getFileIcon(file.fileType)}
        </div>
      )}
      
      {/* File Name Section */}
      <div className="flex-1 min-w-0">
        {/* Editing mode OR Display mode */}
      </div>
    </Link>
  </TableCell>
  
  {/* Type Column */}
  <TableCell>
    <span className="text-sm text-muted-foreground capitalize">
      {file.fileType.toLowerCase()}
    </span>
  </TableCell>
  
  {/* Modified Column */}
  <TableCell className="text-muted-foreground">
    {file.createdAt ? formatDate(file.createdAt) : '—'}
  </TableCell>
  
  {/* Actions Column */}
  <TableCell className="text-right">
    {/* Action buttons */}
  </TableCell>
</TableRow>
```

## File Icon Implementation

### Icon Container Rules
1. **WEBSITE files**: 
   - Container: `h-5 w-5` (no background, no border, no shadow)
   - Just the icon, no decorative container

2. **All other file types** (IMAGE, PDF, VIDEO, etc.):
   - Container: `h-10 w-10 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 shadow-sm`
   - Icon inside the styled container

### Icon Mapping
```tsx
const getFileIcon = (fileType: string) => {
  if (fileType === 'IMAGE') {
    return <Image className="h-5 w-5 text-blue-500" />
  }
  if (fileType === 'PDF') {
    return <FileText className="h-5 w-5 text-red-500" />
  }
  if (fileType === 'VIDEO') {
    return <Video className="h-5 w-5 text-purple-500" />
  }
  if (fileType === 'WEBSITE') {
    return <Globe className="h-5 w-5 text-green-500" />
  }
  return <FileText className="h-5 w-5 text-gray-500" />
}
```

## Name Column Details

### Display Mode (Not Editing)
```tsx
<div className="flex items-center gap-2 min-w-0 flex-wrap">
  <span className="text-gray-900 break-words max-w-[300px]">
    {displayName}
  </span>
  
  {/* PENDING status badge */}
  {file?.status === 'PENDING' && (
    <Badge variant="secondary" className="text-xs px-2 py-0.5">
      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      Processing
    </Badge>
  )}
  
  {/* Revision count badge - only for WEBSITE or IMAGE with > 1 revision */}
  {(file.fileType === 'WEBSITE' || file.fileType === 'IMAGE') && revisionCounts[file.id] > 1 && (
    <Badge variant="outline" className="text-xs px-2 py-0.5">
      {revisionCounts[file.id]} revisions
    </Badge>
  )}
  
  {/* Edit button - only show on hover, only if canRenameFile */}
  {canRenameFile && (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      title="Rename file"
    >
      <Edit2 className="h-3.5 w-3.5" />
    </Button>
  )}
</div>
```

**Key styling details:**
- File name: `text-gray-900 break-words max-w-[300px]` (wraps at 300px, no truncation)
- Parent container: `flex-wrap` to allow badges to wrap to next line if needed

### Editing Mode
```tsx
<div className="flex items-center gap-2">
  <Input
    value={editingFileName}
    className="h-8 text-sm"
    autoFocus
    // Handle Enter to save, Escape to cancel
  />
  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
    <Check className="h-3.5 w-3.5" /> {/* or Loader2 if saving */}
  </Button>
  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
    <X className="h-3.5 w-3.5" />
  </Button>
</div>
```

## Actions Column

### Button Layout
```tsx
<TableCell className="text-right">
  {canEdit && !isEditing && (
    <div className="flex items-center justify-end gap-2">
      {/* Add Revision button - only for WEBSITE or IMAGE */}
      {(file.fileType === 'WEBSITE' || file.fileType === 'IMAGE') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          title="Add revision"
        >
          <Plus className="h-3.5 w-3.5 mr-0.5" />
          <span className="text-xs">Revision</span>
        </Button>
      )}
      
      {/* Delete button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        title="Delete file"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )}
</TableCell>
```

**Key details:**
- Gap between buttons: `gap-2`
- Add Revision button: `h-7 px-2` with icon + text
- Plus icon margin: `mr-0.5` (tight spacing)
- Delete button: `h-7 w-7 p-0` (icon only)
- Buttons are always visible (no opacity-0, no group-hover)

## Empty State

When `files.length === 0`:

```tsx
<div className="text-center py-16">
  <div className="h-24 w-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
    <Upload className="h-12 w-12 text-gray-400" />
  </div>
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    No files yet
  </h3>
  <p className="text-gray-600 mb-6">
    {canEdit
      ? 'Upload your first file to start collaborating'
      : 'No files have been uploaded to this project yet'
    }
  </p>
  {canEdit && (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline">
        <Globe className="h-4 w-4 mr-2" />
        Add Webpage
      </Button>
      <Button>
        <Upload className="h-4 w-4 mr-2" />
        Upload File
      </Button>
    </div>
  )}
</div>
```

## Loading State (Skeleton)

Use shadcn/ui Skeleton component:

```tsx
<div className="mb-8">
  {/* Header skeleton */}
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-2">
      <Skeleton className="h-9 w-24" /> {/* Reload button */}
      <Skeleton className="h-5 w-16" /> {/* File count */}
    </div>
    <div className="flex space-x-2">
      <Skeleton className="h-9 w-32" /> {/* Add Webpage */}
      <Skeleton className="h-9 w-32" /> {/* Upload File */}
    </div>
  </div>

  {/* Table skeleton */}
  <Table>
    <TableHeader>
      <TableRow className="hover:bg-transparent border-b">
        <TableHead>Name</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Modified</TableHead>
        <TableHead></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-48" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-7" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

## Styling Specifications

### Colors
- File name text: `text-gray-900`
- Type text: `text-muted-foreground`
- Modified date: `text-muted-foreground`
- Action buttons: `text-muted-foreground` (default), `hover:text-foreground` (Add Revision), `hover:text-destructive` (Delete)

### Spacing
- Header margin bottom: `mb-6`
- Icon to name gap: `gap-3`
- Name to badges gap: `gap-2`
- Action buttons gap: `gap-2`
- Plus icon to "Revision" text: `mr-0.5`

### Sizes
- Icons in containers: `h-5 w-5`
- Website icon container: `h-5 w-5`
- Other file icon containers: `h-10 w-10`
- Action buttons: `h-7` (height), `px-2` (Add Revision), `w-7` (Delete)
- Edit button: `h-6 w-6`
- File name max width: `max-w-[300px]`

### Hover States
- Row hover: `hover:bg-muted/30`
- Edit button: `opacity-0 group-hover:opacity-100 transition-opacity`
- Action buttons: Always visible (no opacity changes)

### Typography
- File name: Regular weight (no `font-medium` or `font-semibold`)
- Type: `text-sm capitalize`
- Date: Regular text, `text-muted-foreground`

## Required Icons (from lucide-react)
- `RefreshCw` - Reload button
- `Globe` - Add Webpage button, Website file icon
- `Upload` - Upload button, Empty state
- `Image` - Image file icon
- `FileText` - PDF/other file icon
- `Video` - Video file icon
- `Plus` - Add Revision button
- `Trash2` - Delete button
- `Edit2` - Rename button
- `Check` - Save button (editing mode)
- `X` - Cancel button (editing mode)
- `Loader2` - Loading states

## Required shadcn/ui Components
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Button`
- `Badge`
- `Input`
- `Skeleton`

## Key Behavioral Notes

1. **No card wrapper**: Table is directly in the container, no border/rounded/shadow
2. **Equal column widths**: No width classes on TableHead elements
3. **Website icons**: No background container, just the icon
4. **File name wrapping**: Wraps at 300px max-width, uses `break-words`
5. **Actions always visible**: No hover-to-show behavior
6. **Edit button on hover**: Only the edit/rename button appears on row hover
7. **Badges inline**: Status and revision badges appear inline with filename
8. **Row clickable**: Entire row is clickable (via Link wrapper)

## Conditional Rendering

- File count: Only show if `files.length > 0`
- Action buttons: Only show if `canEdit && !isEditing`
- Add Revision button: Only for `WEBSITE` or `IMAGE` file types
- Edit button: Only show if `canRenameFile`, only on hover
- Empty state buttons: Only show if `canEdit`
- PENDING badge: Only if `file.status === 'PENDING'`
- Revision badge: Only if `(file.fileType === 'WEBSITE' || file.fileType === 'IMAGE') && revisionCounts[file.id] > 1`

## Date Formatting
Use relative time formatting:
- Less than 1 minute: "just now"
- Less than 1 hour: "Xm ago"
- Less than 24 hours: "Xh ago"
- Less than 7 days: "Xd ago"
- Same year: "Month Day" (e.g., "Dec 14")
- Different year: "Month Day, Year" (e.g., "Dec 14, 2024")

## Complete Example Structure

```tsx
<div className="mb-8">
  {/* Header with reload, file count, and action buttons */}
  
  {files.length === 0 ? (
    {/* Empty state */}
  ) : (
    <Table>
      <TableHeader>
        {/* 4 columns: Name, Type, Modified, empty */}
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow className="group cursor-pointer hover:bg-muted/30">
            <TableCell>
              {/* Icon (conditional styling) + Name (editing or display) */}
            </TableCell>
            <TableCell>
              {/* Type text */}
            </TableCell>
            <TableCell>
              {/* Date */}
            </TableCell>
            <TableCell className="text-right">
              {/* Action buttons */}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )}
</div>
```

This layout is minimal, modern, and provides excellent usability with clear visual hierarchy and intuitive interactions.
