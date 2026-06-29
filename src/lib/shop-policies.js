export const DEFAULT_RETURN_POLICY =
  'Return or exchange requests must be discussed with the merchant within 3 days of delivery. Items should be unused and in original condition unless they arrived damaged or incorrect.';

export const DEFAULT_SHIPPING_POLICY =
  'Delivery time and charge depend on the merchant, courier partner, and destination. The merchant will confirm delivery details after reviewing the order.';

export const DEFAULT_PAYMENT_POLICY =
  'Cash on Delivery remains pending until delivery. Mobile banking payments remain pending verification until the merchant confirms the transaction ID. Online card payments are processed through the selected gateway.';

export function getPolicyText(store, key) {
  if (!store) {
    if (key === 'return') return DEFAULT_RETURN_POLICY;
    if (key === 'shipping') return DEFAULT_SHIPPING_POLICY;
    return DEFAULT_PAYMENT_POLICY;
  }

  if (key === 'return') return store.return_policy || DEFAULT_RETURN_POLICY;
  if (key === 'shipping') return store.shipping_policy || DEFAULT_SHIPPING_POLICY;
  if (key === 'payment') return store.payment_policy || DEFAULT_PAYMENT_POLICY;
  return '';
}
