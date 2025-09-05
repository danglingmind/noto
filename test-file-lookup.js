const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Looking for files...')
    
    const files = await prisma.file.findMany({
      select: {
        id: true,
        fileName: true,
        fileType: true,
        status: true,
        fileUrl: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })
    
    console.log('Recent files:')
    files.forEach(file => {
      console.log(`- ID: ${file.id}`)
      console.log(`  Name: ${file.fileName}`)
      console.log(`  Type: ${file.fileType}`)
      console.log(`  Status: ${file.status}`)
      console.log(`  URL: ${file.fileUrl}`)
      console.log(`  Created: ${file.createdAt}`)
      console.log('')
    })
    
    // Look for the specific file
    const specificFile = await prisma.file.findUnique({
      where: { id: 'cmf76pdd50002lw4gnswddm3r' }
    })
    
    if (specificFile) {
      console.log('Found specific file:', specificFile)
    } else {
      console.log('Specific file cmf76pdd50002lw4gnswddm3r not found')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
