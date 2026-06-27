// src/pages/checkout.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { clearCart, getCart, getCartTotals, syncCartPrices } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";

const DISTRICTS = [
  "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh",
  "Cumilla", "Narayanganj", "Gazipur", "Cox's Bazar", "Feni", "Noakhali", "Lakshmipur",
  "Brahmanbaria", "Habiganj", "Moulvibazar", "Sunamganj", "Bogura", "Pabna", "Sirajganj",
  "Dinajpur", "Kurigram", "Gaibandha", "Lalmonirhat", "Nilphamari", "Panchagarh", "Thakurgaon",
  "Jashore", "Satkhira", "Narail", "Bagerhat", "Jhenaidah", "Magura", "Chuadanga", "Kushtia",
  "Meherpur", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur", "Barguna", "Kishoreganj",
  "Netrokona", "Jamalpur", "Sherpur", "Tangail", "Faridpur", "Madaripur", "Shariatpur",
  "Gopalganj", "Manikganj", "Munshiganj", "Narsingdi", "Natore", "Naogaon",
];

function getStoreSlug() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("store") || params.get("shop") || params.get("subdomain") || "").trim().toLowerCase();
}

function makeOrderId() {
  return "BHQ" + Date.now().toString(36).toUpperCase();
}

function money(value) {
  return `BDT ${Number(value || 0).toLocaleString()}`;
}

function StepIndicator({ current }) {
  const steps = ["Address", "Payment", "Review"];

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                done ? "bg-green-500 text-white" : active ? "bg-[var(--primary)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}
              >
                {done ? "✓" : step}
              </div>
              <span className={`text-xs mt-1 ${active ? "text-[var(--primary)] font-medium" : "text-[var(--muted-foreground)]"}`}>
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 ${done ? "bg-green-500" : "bg-[var(--border)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { customer, profile, isLoggedIn, loading: authLoading } = useCustomerAuth();
  const subdomain = useMemo(() => getStoreSlug(), []);

  const [store, setStore] = useState(null);
  const [storeStatus, setStoreStatus] = useState("loading");
  const [cartVersion, setCartVersion] = useState(0);
  const [priceChanges, setPriceChanges] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [step, setStep] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [deliveryErrors, setDeliveryErrors] = useState({});
  const [paymentError, setPaymentError] = useState("");
  const [availableMethods, setAvailableMethods] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [delivery, setDelivery] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    apartment: "",
    district: "",
    note: "",
  });

  const [paymentMethod, setPaymentMethod] = useState("");
  const [txnId, setTxnId] = useState("");

  useEffect(() => {
    if (!subdomain) {
      setStoreStatus("not-found");
      return;
    }

    async function loadStore() {
      const { data, error } = await supabase
        .from("stores")
        .select("id, shop_name, subdomain, return_policy, shipping_policy, logo_url")
        .eq("subdomain", subdomain)
        .maybeSingle();

      if (error || !data) {
        setStoreStatus("not-found");
        return;
      }

      setStore(data);
      setStoreStatus("ok");
    }

    loadStore();
  }, [subdomain]);

  useEffect(() => {
    if (!store?.id) return;

    const cartData = getCart(store.id);
    if (cartData.items.length === 0) {
      navigate({ to: "/shop", search: { store: subdomain } });
      return;
    }

    const productIds = [...new Set(cartData.items.map((item) => item.productId))];

    supabase
      .from("products")
      .select("id, price, stock, variants, has_variants")
      .in("id", productIds)
      .then(({ data }) => {
        if (data?.length) {
          const changed = syncCartPrices(store.id, data);
          if (changed.length) setPriceChanges(changed);
        }

        if (getCart(store.id).items.length === 0) {
          navigate({ to: "/shop", search: { store: subdomain } });
          return;
        }

        setCartVersion((value) => value + 1);
      });
  }, [store?.id, navigate, subdomain]);

  useEffect(() => {
    if (!isLoggedIn || !customer?.id) return;

    supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", customer.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => {
        const rows = data || [];
        setSavedAddresses(rows);

        const defaultAddress = rows.find((address) => address.is_default);
        if (defaultAddress) applySavedAddress(defaultAddress);
      });
  }, [isLoggedIn, customer?.id]);

  useEffect(() => {
    if (!profile && !customer) return;

    setDelivery((current) => ({
      ...current,
      full_name: current.full_name || profile?.full_name || customer?.user_metadata?.full_name || "",
      phone: current.phone || profile?.phone || customer?.user_metadata?.phone || "",
      email: current.email || customer?.email || "",
    }));
  }, [profile, customer]);

  const { subtotal, total, items } = useMemo(
    () => getCartTotals(store?.id || "", 0),
    [store?.id, cartVersion]
  );

  useEffect(() => {
    if (!store?.id) return;

    async function loadPaymentMethods() {
      setPaymentLoading(true);

      const { data, error } = await supabase.rpc("get_public_payment_methods", {
        p_store_id: store.id,
      });

      if (error) {
        setPaymentError("No payment method is available for this shop yet.");
        setAvailableMethods([]);
        setPaymentLoading(false);
        return;
      }

      const rows = (data || []).map((method) => ({
        id: method.method,
        label: method.label,
        needsTxn: !!method.needs_txn,
        merchantNumber: method.merchant_number || "",
      }));

      setAvailableMethods(rows);
      setPaymentLoading(false);
    }

    loadPaymentMethods();
  }, [store?.id]);

  useEffect(() => {
    if (!paymentMethod && availableMethods.length) {
      setPaymentMethod(availableMethods[0].id);
    }
    if (paymentMethod && availableMethods.length && !availableMethods.some((method) => method.id === paymentMethod)) {
      setPaymentMethod(availableMethods[0].id);
      setTxnId("");
    }
  }, [availableMethods, paymentMethod]);

  function applySavedAddress(address) {
    setSelectedAddressId(address.id);
    setDelivery((current) => ({
      ...current,
      full_name: address.full_name,
      phone: address.phone,
      address: address.address,
      district: address.district,
    }));
    setDeliveryErrors({});
  }

  function goToCustomerLogin() {
    navigate({
      to: "/customer/login",
      search: { redirect: `/checkout?store=${encodeURIComponent(subdomain)}` },
    });
  }

  function validateDelivery() {
    const errors = {};

    if (!delivery.full_name.trim()) errors.full_name = "Full name is required.";
    if (!/^01[3-9]\d{8}$/.test(delivery.phone)) errors.phone = "Enter a valid Bangladesh phone number.";
    if (!delivery.address.trim()) errors.address = "Delivery address is required.";
    if (!delivery.district) errors.district = "District is required.";

    setDeliveryErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validatePayment() {
    setPaymentError("");

    if (!availableMethods.length) {
      setPaymentError("This shop has no active payment method. Please contact the merchant.");
      return false;
    }

    if (!paymentMethod) {
      setPaymentError("Choose a payment method.");
      return false;
    }

    const method = availableMethods.find((item) => item.id === paymentMethod);
    if (method?.needsTxn && !txnId.trim()) {
      setPaymentError("Enter the transaction ID after payment.");
      return false;
    }

    return true;
  }

  function handleStep1Next() {
    if (validateDelivery()) setStep(2);
  }

  function handleStep2Next() {
    if (validatePayment()) setStep(3);
  }

  async function placeOrder() {
    if (authLoading) return;

    if (!isLoggedIn || !customer) {
      goToCustomerLogin();
      return;
    }

    if (!store || items.length === 0) {
      alert("Your cart is empty or the shop did not load correctly.");
      return;
    }

    if (!validateDelivery() || !validatePayment()) return;

    setPlacing(true);

    try {
      const publicOrderId = makeOrderId();
      const orderItems = items.map((item) => ({
        product_id: item.productId,
        title: item.title,
        variant_id: item.variantId,
        variant: item.variantLabel,
        price: Number(item.price),
        qty: Number(item.qty),
      }));

      const { data, error } = await supabase.rpc("place_customer_order", {
        p_order_id: publicOrderId,
        p_store_id: store.id,
        p_customer_name: delivery.full_name.trim(),
        p_customer_phone: delivery.phone.trim(),
        p_customer_email: delivery.email || customer.email || null,
        p_delivery_address: `${delivery.address}${delivery.apartment ? ", " + delivery.apartment : ""}`,
        p_district: delivery.district,
        p_delivery_note: delivery.note || null,
        p_payment_method: paymentMethod,
        p_payment_status: paymentMethod === "cod" ? "pending" : "pending_verification",
        p_txn_id: txnId || null,
        p_items: orderItems,
        p_total: total,
      });

      if (error) throw error;

      const createdOrderId = data?.order_id || publicOrderId;
      clearCart(store.id);
      setOrderId(createdOrderId);
      setCartVersion((value) => value + 1);
    } catch (err) {
      alert(
        "Could not place the order: " +
        (err.message || "Unknown error") +
        "\n\nMake sure supabase-order-rpc-fix.sql has been run in Supabase SQL Editor."
      );
    } finally {
      setPlacing(false);
    }
  }

  if (storeStatus === "loading" || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (storeStatus === "not-found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] text-center p-6">
        <h1 className="text-2xl font-bold">Shop not found</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Use /checkout?store=your-shop on localhost.</p>
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center shadow-sm">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-1">Order placed successfully</h1>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">Your order ID is:</p>
          <p className="font-mono text-lg font-bold bg-[var(--muted)] rounded-lg py-3 mb-6">{orderId}</p>
          <p className="text-xs text-[var(--muted-foreground)] mb-6">
            The merchant will review and process your order soon.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/track", search: { store: subdomain, order: orderId, phone: delivery.phone } })}
            >
              Track order
            </Button>
            <Button onClick={() => navigate({ to: "/shop", search: { store: subdomain } })}>
              Continue shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6"
          onClick={() => navigate({ to: "/shop", search: { store: subdomain } })}
        >
          <ChevronLeft className="h-4 w-4" /> Back to shop
        </button>

        <h1 className="text-2xl font-bold mb-1">Checkout</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-8">{store?.shop_name}</p>

        <StepIndicator current={step} />

        {priceChanges.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <AlertTriangle className="h-4 w-4" /> Some prices were updated
            </div>
            <ul className="list-disc list-inside space-y-1">
              {priceChanges.map((change) => (
                <li key={change.key}>{change.title}: {money(change.oldPrice)} to {money(change.newPrice)}</li>
              ))}
            </ul>
          </div>
        )}

        {!isLoggedIn && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-4 text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold">Customer login is required before placing the order.</p>
            <p className="mt-1 text-xs">You can prepare address and payment details, but final order placement requires login.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={goToCustomerLogin}>
              Customer login
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-bold">Delivery information</h2>

            {savedAddresses.length > 0 && (
              <div className="space-y-2">
                <Label>Saved addresses</Label>
                <div className="grid gap-2">
                  {savedAddresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      className={`text-left p-3 rounded-xl border ${selectedAddressId === address.id ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)]"}`}
                      onClick={() => applySavedAddress(address)}
                    >
                      <p className="font-medium text-sm">{address.label || "Saved address"}{address.is_default ? " · Default" : ""}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{address.full_name} · {address.phone}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{address.address}, {address.district}</p>
                    </button>
                  ))}
                </div>
                <button type="button" className="text-xs text-[var(--primary)] hover:underline" onClick={() => setSelectedAddressId("")}>
                  Use a new address
                </button>
              </div>
            )}

            <div className="grid gap-4">
              <div>
                <Label>Full name *</Label>
                <Input className="mt-1" value={delivery.full_name} onChange={(event) => setDelivery((value) => ({ ...value, full_name: event.target.value }))} />
                {deliveryErrors.full_name && <p className="text-xs text-red-500 mt-1">{deliveryErrors.full_name}</p>}
              </div>

              <div>
                <Label>Phone number *</Label>
                <Input className="mt-1" placeholder="01XXXXXXXXX" value={delivery.phone} onChange={(event) => setDelivery((value) => ({ ...value, phone: event.target.value }))} />
                {deliveryErrors.phone && <p className="text-xs text-red-500 mt-1">{deliveryErrors.phone}</p>}
              </div>

              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" placeholder="your@email.com" value={delivery.email} onChange={(event) => setDelivery((value) => ({ ...value, email: event.target.value }))} />
              </div>

              <div>
                <Label>Full address *</Label>
                <Input className="mt-1" placeholder="House, road, area" value={delivery.address} onChange={(event) => setDelivery((value) => ({ ...value, address: event.target.value }))} />
                {deliveryErrors.address && <p className="text-xs text-red-500 mt-1">{deliveryErrors.address}</p>}
              </div>

              <div>
                <Label>Apartment or floor</Label>
                <Input className="mt-1" placeholder="Example: 3rd floor, Flat B" value={delivery.apartment} onChange={(event) => setDelivery((value) => ({ ...value, apartment: event.target.value }))} />
              </div>

              <div>
                <Label>District *</Label>
                <select
                  className="w-full mt-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]"
                  value={delivery.district}
                  onChange={(event) => setDelivery((value) => ({ ...value, district: event.target.value }))}
                >
                  <option value="">Choose district</option>
                  {DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
                {deliveryErrors.district && <p className="text-xs text-red-500 mt-1">{deliveryErrors.district}</p>}
              </div>

              <div>
                <Label>Delivery note</Label>
                <Input className="mt-1" placeholder="Any special delivery instruction" value={delivery.note} onChange={(event) => setDelivery((value) => ({ ...value, note: event.target.value }))} />
              </div>
            </div>

            <Button className="w-full mt-2" onClick={handleStep1Next}>Next: Payment</Button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-bold">Payment method</h2>

            {paymentLoading ? (
              <div className="flex items-center justify-center rounded-xl border border-[var(--border)] p-6 text-sm text-[var(--muted-foreground)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading payment methods...
              </div>
            ) : availableMethods.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                This shop has no active payment method. Please contact the merchant before checkout.
              </div>
            ) : (
              <div className="space-y-2">
                {availableMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                      paymentMethod === method.id ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method.id}
                      checked={paymentMethod === method.id}
                      onChange={() => {
                        setPaymentMethod(method.id);
                        setTxnId("");
                        setPaymentError("");
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{method.label}</p>
                      {method.merchantNumber && (
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Merchant number: {method.merchantNumber}</p>
                      )}
                      {paymentMethod === method.id && method.needsTxn && (
                        <div className="mt-3">
                          <p className="text-xs text-[var(--muted-foreground)] mb-1">
                            Complete the payment first, then enter the transaction ID.
                          </p>
                          <Input placeholder="Transaction ID or reference" value={txnId} onChange={(event) => setTxnId(event.target.value)} className="text-sm" />
                        </div>
                      )}
                      {paymentMethod === method.id && method.id === "cod" && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">Pay in cash when the order is delivered.</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {paymentError && <p className="text-sm text-red-500">{paymentError}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleStep2Next} disabled={paymentLoading || availableMethods.length === 0}>Review order</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-5">
            <h2 className="text-lg font-bold">Review your order</h2>

            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                <h3 className="font-semibold text-sm">Items</h3>
              </div>
              {items.map((item) => (
                <div key={item.key} className="flex gap-3 p-4 border-b border-[var(--border)] last:border-0">
                  {item.image && <img src={item.image} alt={item.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.variantLabel && <p className="text-xs text-[var(--muted-foreground)]">{item.variantLabel}</p>}
                    <p className="text-xs text-[var(--muted-foreground)]">Quantity: {item.qty}</p>
                  </div>
                  <p className="text-sm font-semibold whitespace-nowrap">{money(item.price * item.qty)}</p>
                </div>
              ))}

              <div className="p-4 bg-[var(--muted)]/30 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">Delivery</span>
                  <span className="text-green-600">Set by merchant</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{money(subtotal)}+</span>
                </div>
              </div>
            </div>

            <div className="border border-[var(--border)] rounded-xl p-4 space-y-1">
              <h3 className="font-semibold text-sm mb-2">Delivery address</h3>
              <p className="text-sm">{delivery.full_name} · {delivery.phone}</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {delivery.address}{delivery.apartment ? ", " + delivery.apartment : ""}, {delivery.district}
              </p>
              {delivery.note && <p className="text-xs text-[var(--muted-foreground)]">Note: {delivery.note}</p>}
            </div>

            <div className="border border-[var(--border)] rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-1">Payment</h3>
              <p className="text-sm">{availableMethods.find((method) => method.id === paymentMethod)?.label || paymentMethod}</p>
              {txnId && <p className="text-xs text-[var(--muted-foreground)]">Transaction ID: {txnId}</p>}
            </div>

            {(store?.return_policy || store?.shipping_policy) && (
              <div className="text-xs text-[var(--muted-foreground)] text-center space-y-1">
                <p>Please review the shop policies before placing your order.</p>
                <div className="flex justify-center gap-4">
                  {store.return_policy && <button type="button" className="text-[var(--primary)] hover:underline" onClick={() => alert(store.return_policy)}>Return policy</button>}
                  {store.shipping_policy && <button type="button" className="text-[var(--primary)] hover:underline" onClick={() => alert(store.shipping_policy)}>Shipping policy</button>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button disabled={placing} onClick={placeOrder}>
                {placing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Placing...</> : isLoggedIn ? "Place order" : "Log in to order"}
              </Button>
            </div>

            <p className="text-xs text-center text-[var(--muted-foreground)]">
              Contact the merchant if you need to change anything after placing the order.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
