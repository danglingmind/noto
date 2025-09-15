import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Realtime channel helpers
export const createProjectChannel = (projectId: string) => {
  return supabase.channel(`project:${projectId}`, {
    config: {
      broadcast: { self: true },
      presence: { key: 'user' },
    },
  })
}

export const createAnnotationChannel = (fileId: string) => {
  return supabase.channel(`annotations:${fileId}`, {
    config: {
      broadcast: { self: true },
    },
  })
}

export const createCommentChannel = (annotationId: string) => {
  return supabase.channel(`comments:${annotationId}`, {
    config: {
      broadcast: { self: true },
    },
  })
}

// Realtime event types
export type RealtimeEvent = 
  | 'annotation:created'
  | 'annotation:updated'
  | 'annotation:deleted'
  | 'comment:created'
  | 'comment:updated'
  | 'comment:deleted'
  | 'user:joined'
  | 'user:left'

export interface RealtimePayload {
  type: RealtimeEvent
  data: Record<string, unknown>
  userId: string
  timestamp: string
}
