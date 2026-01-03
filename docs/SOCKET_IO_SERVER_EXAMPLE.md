# Socket.IO Server Implementation Example

This document provides an example implementation of the Socket.IO server that works with the client code in this repository.

## Overview

The Socket.IO server should handle:
- Channel subscriptions (rooms in Socket.IO)
- Event broadcasting to channels
- Presence tracking
- Authentication

## Basic Server Example

```typescript
import { Server } from 'socket.io'
import { createServer } from 'http'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})

// Store presence state per channel
const presenceState = new Map<string, Map<string, { user: { id: string; name?: string; avatar?: string } }>>()

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Handle authentication (optional)
  const token = socket.handshake.auth?.token
  if (token) {
    // Verify token and get user info
    // const user = await verifyToken(token)
    // socket.data.userId = user.id
  }

  // Handle channel subscription
  socket.on('subscribe', (channelName: string, callback: (response: { success: boolean; error?: string }) => void) => {
    try {
      socket.join(channelName)
      console.log(`Client ${socket.id} joined channel: ${channelName}`)
      callback({ success: true })
    } catch (error) {
      callback({ success: false, error: error instanceof Error ? error.message : String(error) })
    }
  })

  // Handle channel unsubscription
  socket.on('unsubscribe', (channelName: string) => {
    socket.leave(channelName)
    console.log(`Client ${socket.id} left channel: ${channelName}`)
    
    // Clean up presence
    const channelPresence = presenceState.get(channelName)
    if (channelPresence) {
      channelPresence.delete(socket.id)
      if (channelPresence.size === 0) {
        presenceState.delete(channelName)
      }
    }
  })

  // Handle broadcast events
  socket.on('broadcast', (data: { channel: string; event: string; payload: Record<string, unknown> }) => {
    // Broadcast to all clients in the channel (except sender)
    socket.to(data.channel).emit('broadcast', {
      channel: data.channel,
      event: data.event,
      payload: data.payload,
    })
  })

  // Handle presence tracking
  socket.on('presence', (data: { channel: string; payload: { user: { id: string; name?: string; avatar?: string } } }) => {
    const channelName = data.channel
    
    // Initialize presence state for channel if needed
    if (!presenceState.has(channelName)) {
      presenceState.set(channelName, new Map())
    }
    
    const channelPresence = presenceState.get(channelName)!
    channelPresence.set(socket.id, data.payload)
    
    // Broadcast presence sync to all clients in channel
    const state: Record<string, Array<{ user: { id: string; name?: string; avatar?: string } }>> = {}
    for (const presence of channelPresence.values()) {
      const key = presence.user.id
      if (!state[key]) {
        state[key] = []
      }
      state[key].push(presence)
    }
    
    io.to(channelName).emit('presence:sync', {
      channel: channelName,
      state,
    })
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
    
    // Clean up presence from all channels
    for (const [channelName, channelPresence] of presenceState.entries()) {
      if (channelPresence.has(socket.id)) {
        channelPresence.delete(socket.id)
        
        // Broadcast updated presence
        const state: Record<string, Array<{ user: { id: string; name?: string; avatar?: string } }>> = {}
        for (const presence of channelPresence.values()) {
          const key = presence.user.id
          if (!state[key]) {
            state[key] = []
          }
          state[key].push(presence)
        }
        
        io.to(channelName).emit('presence:sync', {
          channel: channelName,
          state,
        })
        
        if (channelPresence.size === 0) {
          presenceState.delete(channelName)
        }
      }
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`)
})
```

## Server-Side Broadcasting (from API routes)

When broadcasting from server-side API routes, you can use the Socket.IO admin client:

```typescript
import { io } from 'socket.io-client'

const adminSocket = io(process.env.SOCKET_IO_SERVER_URL || 'http://localhost:3001', {
  auth: {
    token: process.env.SOCKET_IO_ADMIN_TOKEN, // Admin token for server-to-server
  },
})

// Broadcast to a channel
adminSocket.emit('broadcast', {
  channel: 'annotations:file123',
  event: 'annotations:created',
  payload: {
    type: 'annotations:created',
    data: { annotation: { id: '...', ... } },
    userId: 'user123',
    timestamp: new Date().toISOString(),
  },
})
```

## Environment Variables

```env
PORT=3001
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
SOCKET_IO_ADMIN_TOKEN=your-secure-admin-token
```

## Features

- **Automatic Reconnection**: Socket.IO handles reconnection automatically
- **Fallback to Polling**: If WebSocket fails, automatically falls back to HTTP long-polling
- **Room Management**: Uses Socket.IO rooms for channel subscriptions
- **Presence Tracking**: Tracks who's online in each channel
- **Fault Tolerant**: Client gracefully handles server unavailability

## Deployment

The Socket.IO server should be deployed separately from the Next.js application. Options:
- Fly.io (separate app)
- Railway
- Render
- AWS ECS/Fargate
- DigitalOcean App Platform

Make sure to:
1. Set CORS to allow your Next.js app domain
2. Use environment variables for configuration
3. Implement proper authentication
4. Monitor connection health
5. Scale horizontally if needed (Socket.IO supports Redis adapter for multi-server)

