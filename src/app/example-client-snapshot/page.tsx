'use client'

import { useState } from 'react'
import { ClientSnapshotCreator } from '@/components/client-snapshot-creator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ExampleClientSnapshotPage() {
  const [createdSnapshots, setCreatedSnapshots] = useState<string[]>([])

  const handleSnapshotCreated = (fileUrl: string) => {
    setCreatedSnapshots(prev => [...prev, fileUrl])
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Client-Side Snapshot Creation</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          This example demonstrates how to create website snapshots entirely on the client side,
          eliminating the need for long-running server processes.
        </p>
      </div>

      <div className="flex justify-center">
        <ClientSnapshotCreator
          fileId="example-file-id"
          onSnapshotCreated={handleSnapshotCreated}
        />
      </div>

      {createdSnapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Created Snapshots</CardTitle>
            <CardDescription>
              Snapshots created using client-side processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {createdSnapshots.map((fileUrl, index) => (
                <div key={index} className="p-3 bg-muted rounded-lg">
                  <p className="font-mono text-sm">{fileUrl}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Benefits of Client-Side Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-green-600">✅ Advantages</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• No server-side processing time</li>
                <li>• Works with Vercel Edge Functions</li>
                <li>• Scales infinitely</li>
                <li>• Real-time progress feedback</li>
                <li>• No Puppeteer/Chromium dependencies</li>
                <li>• Reduced server costs</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-600">🔧 Features</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Automatic script blocking</li>
                <li>• Image inlining (data URLs)</li>
                <li>• Error suppression</li>
                <li>• Responsive design preservation</li>
                <li>• Stable element IDs</li>
                <li>• Self-contained snapshots</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
