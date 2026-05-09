import { prisma } from '@/lib/prisma'
import { GuestSharedViewer } from '@/components/guest-shared-viewer'
import { AlertCircle, Clock, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  params: Promise<{ token: string }>
}

function StaticError({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function SharedPage({ params }: Props) {
  const { token } = await params

  const link = await prisma.shareable_links.findUnique({
    where: { token },
    select: { id: true, expiresAt: true, maxViews: true, viewCount: true, password: true }
  })

  if (!link) {
    return <StaticError title="Link not found" message="This link doesn't exist or has been removed." />
  }

  if (link.expiresAt && new Date() > link.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5" />
              Link expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">This link has expired and is no longer accessible.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (link.maxViews && link.viewCount >= link.maxViews) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-5 w-5" />
              View limit reached
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">This link has reached its maximum number of views.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <GuestSharedViewer token={token} hasPassword={!!link.password} />
}
