import { jsPDF } from 'jspdf'
import { createClient } from '@supabase/supabase-js'
import { PaymentHistoryService } from './payment-history'
import { InvoiceData } from '@/types/billing'
import { formatCurrency } from './currency'

export class InvoiceGenerator {
  private static supabaseInstance: ReturnType<typeof createClient> | null = null

  private static getSupabase() {
    if (this.supabaseInstance) {
      return this.supabaseInstance
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL is not defined. ' +
        'This error should only occur at runtime, not during build. ' +
        'If you see this during build, ensure NEXT_PUBLIC_SUPABASE_URL is set in your build environment.'
      )
    }

    if (!supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not defined. ' +
        'This error should only occur at runtime, not during build. ' +
        'If you see this during build, ensure SUPABASE_SERVICE_ROLE_KEY is set in your build environment.'
      )
    }

    this.supabaseInstance = createClient(supabaseUrl, supabaseServiceKey)
    return this.supabaseInstance
  }

  private static get supabase() {
    return this.getSupabase()
  }

  /**
   * Generate a PDF invoice for a payment
   */
  static async generateInvoice(paymentId: string): Promise<string> {
    try {
      // Get invoice data
      const invoiceData = await PaymentHistoryService.getInvoiceData(paymentId)
      
      // Generate PDF
      const pdfBuffer = await this.createInvoicePDF(invoiceData)
      
      // Upload to Supabase storage
      const pdfUrl = await this.uploadInvoiceToStorage(pdfBuffer, paymentId)
      
      // Update payment record with PDF URL
      await PaymentHistoryService.updatePaymentPdfUrl(paymentId, pdfUrl)
      
      return pdfUrl
    } catch (error) {
      console.error('Error generating invoice:', error)
      throw new Error('Failed to generate invoice')
    }
  }

  /**
   * Create PDF invoice using jsPDF
   */
  private static async createInvoicePDF(invoiceData: InvoiceData): Promise<Buffer> {
    const doc = new jsPDF()
    
    // Company details
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Noto'
    const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Your Company Address'
    const companyEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'billing@noto.com'
    const companyPhone = process.env.NEXT_PUBLIC_COMPANY_PHONE || '+1 (555) 123-4567'

    // Header
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text(companyName, 20, 30)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(companyAddress, 20, 40)
    doc.text(`Email: ${companyEmail}`, 20, 45)
    doc.text(`Phone: ${companyPhone}`, 20, 50)

    // Invoice title and number
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 150, 30)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, 150, 40)
    doc.text(`Date: ${invoiceData.invoiceDate.toLocaleDateString()}`, 150, 45)
    doc.text(`Due: ${invoiceData.dueDate.toLocaleDateString()}`, 150, 50)

    // Customer details
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Bill To:', 20, 70)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(invoiceData.customer.name, 20, 80)
    doc.text(invoiceData.customer.email, 20, 85)
    if (invoiceData.customer.address) {
      doc.text(invoiceData.customer.address, 20, 90)
    }

    // Items table header
    const tableTop = 110
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Description', 20, tableTop)
    doc.text('Qty', 120, tableTop)
    doc.text('Unit Price', 140, tableTop)
    doc.text('Amount', 170, tableTop)

    // Draw table line
    doc.line(20, tableTop + 5, 190, tableTop + 5)

    // Get currency for formatting
    const currency = invoiceData.currency || 'USD'
    
    // Items
    let currentY = tableTop + 15
    doc.setFont('helvetica', 'normal')
    
    invoiceData.items.forEach((item) => {
      doc.text(item.description, 20, currentY)
      doc.text(item.quantity.toString(), 120, currentY)
      // Format amounts using the payment's currency
      const unitPriceFormatted = formatCurrency(item.unitPrice, true, currency)
      const amountFormatted = formatCurrency(item.amount, true, currency)
      doc.text(unitPriceFormatted, 140, currentY)
      doc.text(amountFormatted, 170, currentY)
      currentY += 10
    })

    // Totals
    const totalsY = currentY + 10
    doc.setFont('helvetica', 'bold')
    doc.text('Subtotal:', 140, totalsY)
    const subtotalFormatted = formatCurrency(invoiceData.subtotal, true, currency)
    doc.text(subtotalFormatted, 170, totalsY)
    
    if (invoiceData.tax > 0) {
      doc.text('Tax:', 140, totalsY + 10)
      const taxFormatted = formatCurrency(invoiceData.tax, true, currency)
      doc.text(taxFormatted, 170, totalsY + 10)
    }
    
    doc.setFontSize(12)
    doc.text('Total:', 140, totalsY + 25)
    const totalFormatted = formatCurrency(invoiceData.total, true, currency)
    doc.text(totalFormatted, 170, totalsY + 25)

    // Status
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Status: ${invoiceData.status}`, 20, totalsY + 40)

    // Footer
    doc.setFontSize(8)
    doc.text('Thank you for your business!', 20, 280)
    doc.text('For support, contact us at ' + companyEmail, 20, 285)

    // Convert to buffer
    const pdfOutput = doc.output('arraybuffer')
    return Buffer.from(pdfOutput)
  }

  /**
   * Upload PDF to Supabase storage
   */
  private static async uploadInvoiceToStorage(
    pdfBuffer: Buffer, 
    paymentId: string
  ): Promise<string> {
    const fileName = `invoice-${paymentId}.pdf`
    const filePath = `invoices/${fileName}`

    const { error } = await this.supabase.storage
      .from('invoices')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (error) {
      console.error('Error uploading invoice to storage:', error)
      throw new Error('Failed to upload invoice')
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from('invoices')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  }

  /**
   * Get invoice URL for a payment
   */
  static async getInvoiceUrl(paymentId: string): Promise<string | null> {
    const payment = await PaymentHistoryService.getPaymentById(paymentId)
    return payment?.invoicePdfUrl || null
  }
}
