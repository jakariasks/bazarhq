function money(value) {
  const amount = Number(value || 0)
  return `৳${amount.toLocaleString('en-BD')}`
}

function safe(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function normalizeItems(order) {
  if (Array.isArray(order?.items)) return order.items
  if (Array.isArray(order?.order_items)) return order.order_items
  if (Array.isArray(order?.products)) return order.products
  return []
}

function itemName(item) {
  return (
    item.product_name ||
    item.name ||
    item.title ||
    item.products?.name ||
    'Product'
  )
}

function itemQty(item) {
  return Number(item.quantity || item.qty || 1)
}

function itemPrice(item) {
  return Number(item.price || item.unit_price || item.product_price || 0)
}

function itemTotal(item) {
  return Number(item.total || item.total_price || itemPrice(item) * itemQty(item))
}

function invoiceNumber(order) {
  return order?.order_number || order?.order_id || order?.id || 'ORDER'
}

function formatDate(value) {
  if (!value) return new Date().toLocaleDateString('en-BD')
  return new Date(value).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function buildInvoiceHtml(order = {}, store = {}, options = {}) {
  const items = normalizeItems(order)
  const subtotal = Number(order.subtotal || order.subtotal_amount || 0)
  const delivery = Number(order.delivery_charge || order.shipping_charge || 0)
  const discount = Number(order.discount_amount || order.coupon_discount || 0)
  const total = Number(order.total_amount || order.total || subtotal + delivery - discount)

  const shopName = store.shop_name || store.name || order.shop_name || 'BazarHQ Store'
  const shopLogo = store.logo_url || order.shop_logo || ''
  const shopEmail = store.email || store.contact_email || ''
  const shopPhone = store.phone || store.contact_phone || ''

  const customerName = order.customer_name || order.full_name || order.name || 'Customer'
  const customerPhone = order.customer_phone || order.phone || ''
  const customerEmail = order.customer_email || order.email || ''
  const deliveryAddress =
    order.delivery_address ||
    order.shipping_address ||
    order.address ||
    [order.area, order.district, order.division].filter(Boolean).join(', ')

  const rows = items.length
    ? items
        .map(
          (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>
                <strong>${safe(itemName(item))}</strong>
                ${
                  item.variant_name || item.variant
                    ? `<div class="muted">Variant: ${safe(item.variant_name || item.variant)}</div>`
                    : ''
                }
              </td>
              <td class="right">${itemQty(item)}</td>
              <td class="right">${money(itemPrice(item))}</td>
              <td class="right">${money(itemTotal(item))}</td>
            </tr>
          `
        )
        .join('')
    : `
      <tr>
        <td colspan="5" class="center muted">No item details found</td>
      </tr>
    `

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${safe(invoiceNumber(order))}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 32px;
      background: #f8fafc;
      color: #0f172a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .invoice {
      max-width: 860px;
      margin: 0 auto;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
    }

    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 32px;
      background: linear-gradient(135deg, #0f172a, #312e81);
      color: white;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo {
      width: 56px;
      height: 56px;
      border-radius: 18px;
      object-fit: cover;
      background: rgba(255, 255, 255, 0.16);
    }

    .logo-fallback {
      width: 56px;
      height: 56px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: rgba(255, 255, 255, 0.16);
      font-weight: 800;
      font-size: 24px;
    }

    h1, h2, h3, p {
      margin: 0;
    }

    .invoice-title {
      text-align: right;
    }

    .invoice-title h1 {
      font-size: 30px;
      letter-spacing: -0.04em;
    }

    .invoice-title p,
    .brand p {
      margin-top: 6px;
      color: rgba(255, 255, 255, 0.72);
      font-size: 13px;
    }

    .content {
      padding: 32px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 26px;
    }

    .box {
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 18px;
      background: #f8fafc;
    }

    .box h3 {
      margin-bottom: 10px;
      font-size: 14px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .box p {
      margin-top: 4px;
      font-size: 14px;
      color: #0f172a;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 18px;
      border: 1px solid #e2e8f0;
    }

    th {
      background: #f1f5f9;
      color: #475569;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-align: left;
      padding: 14px;
    }

    td {
      padding: 14px;
      border-top: 1px solid #e2e8f0;
      font-size: 14px;
      vertical-align: top;
    }

    .right {
      text-align: right;
    }

    .center {
      text-align: center;
    }

    .muted {
      color: #64748b;
      font-size: 12px;
      margin-top: 3px;
    }

    .totals {
      margin-top: 24px;
      display: flex;
      justify-content: flex-end;
    }

    .summary {
      width: 320px;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      overflow: hidden;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 13px 16px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }

    .summary-row:last-child {
      border-bottom: 0;
    }

    .summary-row.total {
      background: #0f172a;
      color: white;
      font-size: 18px;
      font-weight: 800;
    }

    .footer {
      margin-top: 28px;
      border-top: 1px solid #e2e8f0;
      padding-top: 18px;
      color: #64748b;
      font-size: 13px;
      line-height: 1.7;
    }

    .print-actions {
      max-width: 860px;
      margin: 18px auto 0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      font-weight: 700;
      cursor: pointer;
    }

    .primary {
      background: #4f46e5;
      color: white;
    }

    .secondary {
      background: white;
      color: #0f172a;
      border: 1px solid #e2e8f0;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .invoice {
        box-shadow: none;
        border: 0;
        border-radius: 0;
      }

      .print-actions {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="brand">
        ${
          shopLogo
            ? `<img class="logo" src="${shopLogo}" alt="${safe(shopName)} logo" />`
            : `<div class="logo-fallback">${safe(shopName).slice(0, 1).toUpperCase()}</div>`
        }
        <div>
          <h2>${safe(shopName)}</h2>
          ${shopEmail ? `<p>${safe(shopEmail)}</p>` : ''}
          ${shopPhone ? `<p>${safe(shopPhone)}</p>` : ''}
        </div>
      </div>

      <div class="invoice-title">
        <h1>Invoice</h1>
        <p>#${safe(invoiceNumber(order))}</p>
        <p>${formatDate(order.created_at || order.order_date)}</p>
      </div>
    </div>

    <div class="content">
      <div class="grid">
        <div class="box">
          <h3>Customer</h3>
          <p><strong>${safe(customerName)}</strong></p>
          ${customerPhone ? `<p>${safe(customerPhone)}</p>` : ''}
          ${customerEmail ? `<p>${safe(customerEmail)}</p>` : ''}
        </div>

        <div class="box">
          <h3>Delivery</h3>
          <p>${safe(deliveryAddress)}</p>
          ${order.district ? `<p>District: ${safe(order.district)}</p>` : ''}
          ${order.status ? `<p>Status: ${safe(order.status)}</p>` : ''}
          ${order.payment_method ? `<p>Payment: ${safe(order.payment_method)}</p>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 52px;">#</th>
            <th>Item</th>
            <th class="right">Qty</th>
            <th class="right">Price</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="totals">
        <div class="summary">
          <div class="summary-row">
            <span>Subtotal</span>
            <strong>${money(subtotal)}</strong>
          </div>
          <div class="summary-row">
            <span>Delivery</span>
            <strong>${money(delivery)}</strong>
          </div>
          ${
            discount > 0
              ? `
              <div class="summary-row">
                <span>Discount</span>
                <strong>- ${money(discount)}</strong>
              </div>
            `
              : ''
          }
          <div class="summary-row total">
            <span>Total</span>
            <span>${money(total)}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <p><strong>Thank you for shopping with ${safe(shopName)}.</strong></p>
        <p>This invoice was generated by BazarHQ Commerce OS.</p>
      </div>
    </div>
  </div>

  <div class="print-actions">
    <button class="secondary" onclick="window.close()">Close</button>
    <button class="primary" onclick="window.print()">Download / Print PDF</button>
  </div>
</body>
</html>
`
}

export function openInvoicePdf(order = {}, store = {}, options = {}) {
  const html = buildInvoiceHtml(order, store, options)
  const invoiceWindow = window.open('', '_blank', 'width=980,height=760')

  if (!invoiceWindow) {
    alert('Popup blocked. Please allow popups to open the invoice.')
    return false
  }

  invoiceWindow.document.open()
  invoiceWindow.document.write(html)
  invoiceWindow.document.close()
  invoiceWindow.focus()

  setTimeout(() => {
    invoiceWindow.print()
  }, 500)

  return true
}

export function downloadInvoicePdf(order = {}, store = {}, options = {}) {
  return openInvoicePdf(order, store, options)
}

export function printInvoice(order = {}, store = {}, options = {}) {
  return openInvoicePdf(order, store, options)
}

export function generateInvoice(order = {}, store = {}, options = {}) {
  return buildInvoiceHtml(order, store, options)
}

export default {
  buildInvoiceHtml,
  openInvoicePdf,
  downloadInvoicePdf,
  printInvoice,
  generateInvoice,
}