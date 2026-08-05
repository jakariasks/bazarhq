function numberValue(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function money(value) {
  const amount = numberValue(value)
  return `৳ ${amount.toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function escapeHtml(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback

  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeImageUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (raw.startsWith('/')) return escapeHtml(raw, '')

  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href, '') : ''
  } catch {
    return ''
  }
}

function safeLinkUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (raw.startsWith('/')) return escapeHtml(raw, '')

  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href, '') : ''
  } catch {
    return ''
  }
}

function displayUrl(value) {
  const url = safeLinkUrl(value)
  if (!url) return ''

  return escapeHtml(
    String(value)
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, ''),
    '',
  )
}

function normalizeItems(order) {
  if (Array.isArray(order?.items)) return order.items
  if (Array.isArray(order?.order_items)) return order.order_items
  if (Array.isArray(order?.products)) return order.products
  return []
}

function itemName(item) {
  return item?.product_name || item?.name || item?.title || item?.products?.name || 'Product'
}

function itemVariant(item) {
  return item?.variant_name || item?.variant || item?.option_name || ''
}

function itemQty(item) {
  return Math.max(1, numberValue(item?.quantity ?? item?.qty ?? 1))
}

function itemPrice(item) {
  return numberValue(item?.price ?? item?.unit_price ?? item?.product_price)
}

function itemTotal(item) {
  return numberValue(
    item?.line_total
      ?? item?.total
      ?? item?.total_price
      ?? itemPrice(item) * itemQty(item),
  )
}

function invoiceNumber(order) {
  return order?.order_number || order?.order_id || order?.public_order_id || order?.id || 'ORDER'
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function titleCase(value) {
  const text = String(value || '').trim().replaceAll('_', ' ')
  if (!text) return '—'
  return text.replace(/\b\w/g, (character) => character.toUpperCase())
}

function paymentMethodLabel(method) {
  const normalized = String(method || '').toLowerCase()
  if (normalized === 'cod') return 'Cash on Delivery'
  if (['ssl', 'sslcommerz'].includes(normalized)) return 'SSLCommerz'
  return titleCase(normalized)
}

function paymentStatusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'collected'].includes(normalized)) return 'Paid'
  if (normalized === 'pending_verification') return 'Pending Verification'
  if (normalized === 'failed') return 'Payment Failed'
  if (normalized === 'cancelled') return 'Payment Cancelled'
  return normalized ? titleCase(normalized) : 'Pending Collection'
}

function splitPolicyText(value) {
  const text = String(value || '').trim()
  if (!text) return []

  return text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function addressParts(order) {
  const direct = order.delivery_address || order.shipping_address || order.address || ''
  const regional = [order.area, order.district, order.division].filter(Boolean).join(', ')

  if (direct && regional && !String(direct).toLowerCase().includes(String(order.district || '').toLowerCase())) {
    return [direct, regional]
  }

  return [direct || regional].filter(Boolean)
}

export function buildInvoiceHtml(order = {}, store = {}, options = {}) {
  const items = normalizeItems(order)
  const calculatedSubtotal = items.reduce((sum, item) => sum + itemTotal(item), 0)
  const subtotal = numberValue(order.subtotal ?? order.subtotal_amount ?? calculatedSubtotal)
  const delivery = numberValue(order.delivery_charge ?? order.shipping_charge)
  const discount = numberValue(order.discount_amount ?? order.coupon_discount)
  const total = numberValue(order.total_amount ?? order.total ?? subtotal + delivery - discount)

  const shopName = store.shop_name || store.name || order.shop_name || 'BazarHQ Store'
  const shopLogo = safeImageUrl(store.logo_url || order.shop_logo)
  const shopAddress = [store.address, store.city, store.district].filter(Boolean).join(', ')
  const shopPhone = store.phone || store.contact_phone || ''
  const shopWhatsApp = store.whatsapp_number || ''
  const shopEmail = store.contact_email || store.email || ''
  const shopWebsite = safeLinkUrl(store.website_url || store.storefront_url)
  const shopWebsiteLabel = displayUrl(store.website_url || store.storefront_url)
  const shopTagline = store.tagline || ''
  const vatNumber = store.vat_registration_number || store.vat_number || store.bin_number || ''

  const customerName = order.customer_name || order.full_name || order.name || 'Customer'
  const customerPhone = order.customer_phone || order.phone || order.customer_phone_masked || ''
  const customerEmail = order.customer_email || order.email || ''
  const deliveryAddresses = addressParts(order)

  const orderStatus = titleCase(order.status)
  const paymentMethod = paymentMethodLabel(order.payment_method)
  const paymentStatus = paymentStatusLabel(order.payment_status)
  const transactionReference = order.transaction_reference || order.txn_id || order.transaction_id || ''
  const cancellationReason = order.cancellation_reason || options.cancellationReason || ''
  const invoiceId = invoiceNumber(order)
  const invoiceDate = order.created_at || order.order_date
  const dueDate = order.due_date || order.payment_due_date || ''
  const documentTitle = `${shopName} Invoice ${invoiceId}`.replace(/[<>:"/\\|?*]+/g, '-')
  const includePolicies = options.includePolicies !== false

  const rows = items.length
    ? items.map((item) => `
      <tr>
        <td class="qty">${escapeHtml(itemQty(item))}</td>
        <td class="description">
          <div class="item-name">${escapeHtml(itemName(item))}</div>
          ${itemVariant(item) ? `<div class="item-variant">Variant: ${escapeHtml(itemVariant(item))}</div>` : ''}
        </td>
        <td class="amount">${escapeHtml(money(itemPrice(item)))}</td>
        <td class="amount strong">${escapeHtml(money(itemTotal(item)))}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="empty">No item details found</td></tr>'

  const policyItems = includePolicies
    ? [
        ...splitPolicyText(store.return_policy),
        ...splitPolicyText(store.shipping_policy),
        ...splitPolicyText(store.payment_policy),
      ].slice(0, 7)
    : []

  const policyHtml = policyItems.length
    ? policyItems.map((policy) => `<li>${escapeHtml(policy)}</li>`).join('')
    : `
      <li>Keep this invoice as proof of purchase.</li>
      <li>For return or delivery concerns, contact the shop directly.</li>
      <li>Payment method: ${escapeHtml(paymentMethod)}.</li>
    `

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    :root {
      --ink: #202327;
      --deep: #111315;
      --muted: #666a70;
      --line: #b8bbc0;
      --soft-line: #dddddf;
      --paper: #ffffff;
    }

    * { box-sizing: border-box; }

    html, body { min-height: 100%; }

    body {
      margin: 0;
      padding: 24px;
      background: #ececec;
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .invoice-page {
      width: min(100%, 210mm);
      min-height: 297mm;
      margin: 0 auto;
      padding: 15mm 14mm 12mm;
      background: var(--paper);
      box-shadow: 0 12px 42px rgba(0, 0, 0, 0.13);
    }

    h1, h2, h3, p { margin: 0; }

    .top-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 0.95fr);
      gap: 36px;
      align-items: start;
    }

    .shop-name {
      margin-bottom: 13px;
      color: var(--deep);
      font-size: 23px;
      font-weight: 800;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }

    .shop-tagline {
      margin: -5px 0 13px;
      color: var(--muted);
      font-size: 11px;
      font-style: italic;
    }

    .shop-details {
      display: grid;
      gap: 7px;
      font-size: 11.5px;
      line-height: 1.45;
    }

    .detail-row {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 5px;
      align-items: start;
    }

    .detail-icon {
      color: var(--deep);
      font-weight: 800;
      text-align: center;
    }

    .vat-line { margin-top: 9px; font-size: 11.5px; }

    .invoice-heading { text-align: right; }

    .logo-box {
      width: 100%;
      min-height: 80px;
      margin-left: auto;
      border: 1.5px solid #4b4e52;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #fff;
    }

    .logo-box img {
      max-width: 82%;
      max-height: 62px;
      object-fit: contain;
      filter: grayscale(1) contrast(1.06);
    }

    .logo-fallback {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #3f4246;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .logo-mark {
      display: grid;
      width: 42px;
      height: 42px;
      place-items: center;
      border: 2px solid currentColor;
      border-radius: 50%;
      font-size: 17px;
      font-weight: 900;
    }

    .invoice-heading h1 {
      margin-top: 28px;
      color: #2b2e32;
      font-size: 39px;
      font-weight: 900;
      letter-spacing: 0.11em;
      line-height: 1.03;
      text-transform: uppercase;
    }

    .billing-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(250px, 0.85fr);
      gap: 46px;
      margin-top: 34px;
      align-items: end;
    }

    .section-label {
      display: inline-block;
      min-width: 225px;
      padding-bottom: 7px;
      border-bottom: 1.5px solid var(--deep);
      color: #292c30;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .customer-name {
      margin-top: 11px;
      color: #202327;
      font-size: 20px;
      line-height: 1.2;
    }

    .customer-details {
      margin-top: 9px;
      display: grid;
      gap: 4px;
      color: #383b3f;
      font-size: 11.5px;
      line-height: 1.4;
    }

    .invoice-meta {
      padding-left: 26px;
      border-left: 1px solid #777a7e;
      display: grid;
      gap: 13px;
      align-self: stretch;
      align-content: center;
    }

    .meta-row {
      display: grid;
      grid-template-columns: 108px 10px minmax(0, 1fr);
      gap: 6px;
      align-items: baseline;
      font-size: 11.5px;
    }

    .meta-row strong { color: #2e3135; }

    .status-note {
      margin-top: 20px;
      border: 1.4px solid var(--deep);
      padding: 9px 11px;
      font-size: 11px;
      line-height: 1.5;
    }

    .items-table {
      width: 100%;
      margin-top: 33px;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .items-table thead { display: table-header-group; }

    .items-table th {
      padding: 11px 12px;
      background: #2d3034;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      text-align: left;
      text-transform: uppercase;
    }

    .items-table th:nth-child(1) { width: 10%; text-align: center; }
    .items-table th:nth-child(2) { width: 48%; }
    .items-table th:nth-child(3) { width: 21%; text-align: right; }
    .items-table th:nth-child(4) { width: 21%; text-align: right; }

    .items-table td {
      padding: 12px;
      border-bottom: 1px dotted #aaaaad;
      color: #272a2e;
      font-size: 11.5px;
      vertical-align: top;
    }

    .items-table tbody tr:last-child td { border-bottom: 1.5px solid var(--deep); }
    .items-table .qty { text-align: center; }
    .items-table .amount { text-align: right; white-space: nowrap; }
    .items-table .strong { font-weight: 700; }
    .item-name { font-weight: 600; line-height: 1.35; }
    .item-variant { margin-top: 3px; color: var(--muted); font-size: 9.5px; }
    .empty { padding: 24px !important; text-align: center; color: var(--muted) !important; }

    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 6px;
    }

    .totals {
      width: min(100%, 390px);
      color: #272a2e;
      font-size: 11.5px;
    }

    .total-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 30px;
      padding: 7px 8px;
    }

    .total-row span:last-child { min-width: 112px; text-align: right; }

    .grand-total {
      margin-top: 2px;
      padding: 10px 9px;
      border: 1.8px solid var(--deep);
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .grand-total span:last-child { font-size: 18px; }

    .bottom-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 235px;
      gap: 38px;
      margin-top: 38px;
      align-items: stretch;
    }

    .terms-title {
      padding-bottom: 7px;
      border-bottom: 1.5px solid var(--deep);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .terms-list {
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
      color: #3e4145;
      font-size: 10.5px;
      line-height: 1.35;
    }

    .terms-list li {
      position: relative;
      padding-left: 19px;
    }

    .terms-list li::before {
      content: '○';
      position: absolute;
      left: 0;
      top: -1px;
      color: var(--deep);
      font-size: 14px;
      font-weight: 700;
    }

    .thank-you {
      min-height: 125px;
      padding-left: 28px;
      border-left: 1px solid #777a7e;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .thank-line { width: 100%; border-top: 1.5px solid var(--deep); }
    .heart { margin: 11px 0 5px; font-size: 29px; line-height: 1; }
    .thank-you strong { font-size: 15px; letter-spacing: 0.04em; }
    .thank-you p { margin: 4px 0 11px; color: var(--muted); font-size: 10.5px; }

    .cancellation-box {
      margin-top: 18px;
      padding: 10px 12px;
      border: 1.5px solid var(--deep);
      font-size: 11px;
      line-height: 1.5;
    }

    .footer {
      margin-top: 24px;
      padding-top: 9px;
      border-top: 1px solid var(--deep);
      color: #55585c;
      text-align: center;
      font-size: 9px;
      line-height: 1.45;
    }

    .footer strong { color: #33363a; }

    .print-actions {
      width: min(100%, 210mm);
      margin: 14px auto 0;
      display: flex;
      justify-content: flex-end;
      gap: 9px;
    }

    button {
      border-radius: 6px;
      padding: 10px 15px;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .secondary-button { border: 1px solid #333; background: #fff; color: #222; }
    .primary-button { border: 1px solid #111; background: #202225; color: #fff; }

    @media (max-width: 720px) {
      body { padding: 0; background: #fff; }
      .invoice-page { width: 100%; min-height: auto; padding: 22px 18px; box-shadow: none; }
      .top-grid, .billing-grid, .bottom-grid { grid-template-columns: 1fr; gap: 24px; }
      .invoice-heading { text-align: left; }
      .invoice-heading h1 { margin-top: 18px; font-size: 31px; }
      .invoice-meta, .thank-you { padding-left: 0; border-left: 0; }
      .invoice-meta { padding-top: 18px; border-top: 1px solid var(--line); }
      .thank-you { padding-top: 18px; }
      .section-label { min-width: 180px; }
      .items-table th, .items-table td { padding: 9px 7px; font-size: 10px; }
      .print-actions { padding: 0 12px 12px; }
    }

    @page { size: A4 portrait; margin: 0; }

    @media print {
      html, body { width: 210mm; min-height: 297mm; background: #fff; }
      body { padding: 0; }
      .invoice-page { width: 210mm; min-height: 297mm; margin: 0; box-shadow: none; }
      .print-actions { display: none !important; }
      .items-table tr, .totals, .bottom-grid, .cancellation-box { break-inside: avoid; }
      .items-table th { background: #2d3034 !important; color: #fff !important; }
    }
  </style>
</head>
<body>
  <main class="invoice-page">
    <section class="top-grid">
      <div>
        <h2 class="shop-name">${escapeHtml(shopName)}</h2>
        ${shopTagline ? `<p class="shop-tagline">${escapeHtml(shopTagline)}</p>` : ''}
        <div class="shop-details">
          ${shopAddress ? `<div class="detail-row"><span class="detail-icon">●</span><span>${escapeHtml(shopAddress)}</span></div>` : ''}
          ${shopPhone ? `<div class="detail-row"><span class="detail-icon">☎</span><span>${escapeHtml(shopPhone)}</span></div>` : ''}
          ${shopWhatsApp && shopWhatsApp !== shopPhone ? `<div class="detail-row"><span class="detail-icon">W</span><span>${escapeHtml(shopWhatsApp)}</span></div>` : ''}
          ${shopEmail ? `<div class="detail-row"><span class="detail-icon">✉</span><span>${escapeHtml(shopEmail)}</span></div>` : ''}
          ${shopWebsite ? `<div class="detail-row"><span class="detail-icon">◎</span><span>${shopWebsiteLabel}</span></div>` : ''}
        </div>
        ${vatNumber ? `<p class="vat-line"><strong>VAT/BIN No:</strong> ${escapeHtml(vatNumber)}</p>` : ''}
      </div>

      <div class="invoice-heading">
        <div class="logo-box">
          ${shopLogo
            ? `<img src="${shopLogo}" alt="${escapeHtml(shopName)} logo" />`
            : `<div class="logo-fallback"><span class="logo-mark">${escapeHtml(shopName).slice(0, 1).toUpperCase()}</span><span>Shop Logo</span></div>`}
        </div>
        <h1>Ecommerce<br />Invoice</h1>
      </div>
    </section>

    <section class="billing-grid">
      <div>
        <h3 class="section-label">Bill To</h3>
        <p class="customer-name">${escapeHtml(customerName)}</p>
        <div class="customer-details">
          ${deliveryAddresses.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          ${customerPhone ? `<p>Phone: ${escapeHtml(customerPhone)}</p>` : ''}
          ${customerEmail ? `<p>Email: ${escapeHtml(customerEmail)}</p>` : ''}
          ${order.delivery_note ? `<p>Note: ${escapeHtml(order.delivery_note)}</p>` : ''}
        </div>
      </div>

      <div class="invoice-meta">
        <div class="meta-row"><strong>Invoice No.</strong><span>:</span><span>${escapeHtml(invoiceId)}</span></div>
        <div class="meta-row"><strong>Invoice Date</strong><span>:</span><span>${escapeHtml(formatDate(invoiceDate))}</span></div>
        ${dueDate ? `<div class="meta-row"><strong>Due Date</strong><span>:</span><span>${escapeHtml(formatDate(dueDate))}</span></div>` : ''}
        <div class="meta-row"><strong>Order Status</strong><span>:</span><span>${escapeHtml(orderStatus)}</span></div>
        <div class="meta-row"><strong>Payment</strong><span>:</span><span>${escapeHtml(paymentMethod)}</span></div>
        <div class="meta-row"><strong>Pay Status</strong><span>:</span><span>${escapeHtml(paymentStatus)}</span></div>
        ${transactionReference ? `<div class="meta-row"><strong>Reference</strong><span>:</span><span>${escapeHtml(transactionReference)}</span></div>` : ''}
      </div>
    </section>

    ${cancellationReason ? `<section class="cancellation-box"><strong>Cancellation reason:</strong> ${escapeHtml(cancellationReason)}</section>` : ''}

    <table class="items-table">
      <thead>
        <tr>
          <th>Qty</th>
          <th>Description</th>
          <th>Unit Price (BDT)</th>
          <th>Amount (BDT)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <section class="totals-wrap">
      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>${escapeHtml(money(subtotal))}</span></div>
        <div class="total-row"><span>Delivery Charge</span><span>${delivery === 0 ? '৳ 0.00' : escapeHtml(money(delivery))}</span></div>
        ${discount > 0 ? `<div class="total-row"><span>Discount</span><span>− ${escapeHtml(money(discount))}</span></div>` : ''}
        <div class="total-row grand-total"><span>Total (BDT)</span><span>${escapeHtml(money(total))}</span></div>
      </div>
    </section>

    <section class="bottom-grid">
      <div>
        <h3 class="terms-title">Shop Policies / Terms &amp; Conditions</h3>
        <ul class="terms-list">${policyHtml}</ul>
      </div>

      <div class="thank-you">
        <div class="thank-line"></div>
        <div class="heart">♡</div>
        <strong>THANK YOU</strong>
        <p>for shopping with us!</p>
        <div class="thank-line"></div>
      </div>
    </section>

    <footer class="footer">
      <p><strong>This is a computer-generated invoice and does not require a signature.</strong></p>
      <p>Verified through BazarHQ using the shop slug, Order ID, and registered customer phone number.</p>
      <p>Generated: ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
    </footer>
  </main>

  <div class="print-actions">
    <button class="secondary-button" type="button" onclick="window.close()">Close</button>
    <button class="primary-button" type="button" onclick="window.print()">Download / Print PDF</button>
  </div>
</body>
</html>`
}

function openInvoiceWindow(order = {}, store = {}, options = {}) {
  const html = buildInvoiceHtml(order, store, options)
  const invoiceWindow = window.open('', '_blank', 'width=1040,height=820')

  if (!invoiceWindow) {
    window.alert('Popup blocked. Please allow popups to view or download the invoice.')
    return false
  }

  invoiceWindow.document.open()
  invoiceWindow.document.write(html)
  invoiceWindow.document.close()
  invoiceWindow.focus()

  if (options.autoPrint) {
    window.setTimeout(() => {
      if (!invoiceWindow.closed) invoiceWindow.print()
    }, 700)
  }

  return true
}

export function openInvoicePreview(order = {}, store = {}, options = {}) {
  return openInvoiceWindow(order, store, { ...options, autoPrint: false })
}

export function openInvoicePdf(order = {}, store = {}, options = {}) {
  return openInvoiceWindow(order, store, { ...options, autoPrint: true })
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
  openInvoicePreview,
  openInvoicePdf,
  downloadInvoicePdf,
  printInvoice,
  generateInvoice,
}
