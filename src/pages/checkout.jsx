// src/pages/checkout.jsx
// C3 SRS: 3-step checkout · guest allowed · BD phone validation ·
//          saved address pre-fill · policy links on review · price sync
import { useState, useEffect } from "react";
import { useNavigate }  from "@tanstack/react-router";
import { supabase }     from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { getCart, getCartTotals, syncCartPrices, clearCart } from "@/lib/cart";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Badge }     from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";

const DISTRICTS = [
  "Dhaka","Chittagong","Sylhet","Rajshahi","Khulna","Barishal","Rangpur","Mymensingh",
  "Comilla","Narayanganj","Gazipur","Cox's Bazar","Feni","Noakhali","Lakshmipur",
  "Brahmanbaria","Habiganj","Moulvibazar","Sunamganj","Bogura","Pabna","Sirajganj",
  "Dinajpur","Rangpur","Kurigram","Gaibandha","Lalmonirhat","Nilphamari","Panchagarh",
  "Thakurgaon","Jessore","Satkhira","Narail","Bagerhat","Jhenaidah","Magura",
  "Chuadanga","Kushtia","Meherpur","Bhola","Jhalokati","Patuakhali","Pirojpur","Barguna",
  "Kishoreganj","Netrokona","Jamalpur","Sherpur","Tangail","Faridpur","Madaripur",
  "Shariatpur","Gopalganj","Manikganj","Munshiganj","Narsingdi","Natore","Naogaon",
];

function genOrderId() {
  return "BHQ" + Date.now().toString(36).toUpperCase();
}

// ── Step Indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = ["ঠিকানা", "পেমেন্ট", "পর্যালোচনা"];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                done   ? "bg-green-500 text-white"
                : active ? "bg-[var(--primary)] text-white"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}>
                {done ? "✓" : step}
              </div>
              <span className={`text-xs mt-1 ${active ? "text-[var(--primary)] font-medium" : "text-[var(--muted-foreground)]"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 ${done ? "bg-green-500" : "bg-[var(--border)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CheckoutPage() {
  const navigate   = useNavigate();
  const { customer, profile, isLoggedIn } = useCustomerAuth();

  const subdomain  = new URLSearchParams(window.location.search).get("shop") || "";
  const [store,    setStore]    = useState(null);
  const [cart,     setCart]     = useState({ items: [] });
  const [priceChanges, setPriceChanges] = useState([]); // C2: price change notice
  const [step,     setStep]     = useState(1);
  const [placing,  setPlacing]  = useState(false);
  const [orderId,  setOrderId]  = useState(null);

  // Saved addresses for logged-in customers
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);

  // Step 1 — Delivery info
  const [delivery, setDelivery] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    apartment: "",
    district: "",
    note: "",
  });
  const [deliveryErrors, setDeliveryErrors] = useState({});

  // Step 2 — Payment
  const [payMethod, setPayMethod] = useState("");
  const [txnId,     setTxnId]     = useState("");
  const [payError,  setPayError]  = useState("");

  // ── Load store ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!subdomain) return;
    supabase
      .from("stores")
      .select("id, shop_name, subdomain, payment_methods_configured, return_policy, shipping_policy, logo_url")
      .eq("subdomain", subdomain)
      .single()
      .then(({ data }) => setStore(data));
  }, [subdomain]);

  // ── Load cart + sync prices ──────────────────────────────────────────────────
  useEffect(() => {
    if (!store) return;
    const cartData = getCart(store.id);
    if (cartData.items.length === 0) { navigate({ to: "/" }); return; }

    // Sync prices from DB
    const productIds = [...new Set(cartData.items.map((i) => i.productId))];
    supabase
      .from("products")
      .select("id, price, stock, variants")
      .in("id", productIds)
      .then(({ data: freshProducts }) => {
        if (freshProducts?.length) {
          const changed = syncCartPrices(store.id, freshProducts);
          if (changed.length) setPriceChanges(changed);
        }
        setCart(getCart(store.id)); // re-read synced cart
      });
  }, [store, navigate]);

  // ── Load saved addresses ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !customer) return;
    supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", customer.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => {
        setSavedAddresses(data || []);
        // Pre-fill default address
        const def = data?.find((a) => a.is_default);
        if (def) {
          setSelectedAddrId(def.id);
          setDelivery((d) => ({
            ...d,
            full_name: def.full_name,
            phone:     def.phone,
            address:   def.address,
            district:  def.district,
          }));
        }
      });
  }, [isLoggedIn, customer]);

  // Pre-fill name from profile
  useEffect(() => {
    if (profile && !delivery.full_name) {
      setDelivery((d) => ({
        ...d,
        full_name: profile.full_name || "",
        phone:     profile.phone || "",
        email:     customer?.email || "",
      }));
    }
  }, [profile, customer]);

  const { subtotal, total, items } = getCartTotals(store?.id || "", 0);

  // ── Validate Step 1 ──────────────────────────────────────────────────────────
  function validateDelivery() {
    const errs = {};
    if (!delivery.full_name.trim()) errs.full_name = "নাম আবশ্যক";
    if (!/^01[3-9]\d{8}$/.test(delivery.phone))
      errs.phone = "বৈধ বাংলাদেশি নম্বর দিন (01XXXXXXXXX)";
    if (!delivery.address.trim()) errs.address = "ঠিকানা আবশ্যক";
    if (!delivery.district)       errs.district = "জেলা বেছে নিন";
    setDeliveryErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleStep1Next() {
    if (validateDelivery()) setStep(2);
  }

  // ── Validate Step 2 ──────────────────────────────────────────────────────────
  function validatePayment() {
    if (!payMethod) { setPayError("পেমেন্ট পদ্ধতি বেছে নিন।"); return false; }
    if (["bkash", "nagad", "rocket"].includes(payMethod) && !txnId.trim()) {
      setPayError("Transaction ID দিন।");
      return false;
    }
    return true;
  }

  function handleStep2Next() {
    setPayError("");
    if (validatePayment()) setStep(3);
  }

  // ── Place Order ──────────────────────────────────────────────────────────────
  async function placeOrder() {
    setPlacing(true);
    try {
      const newOrderId = genOrderId();
      const orderPayload = {
        order_id:         newOrderId,
        store_id:         store.id,
        customer_name:    delivery.full_name,
        customer_phone:   delivery.phone,
        customer_email:   delivery.email || null,
        customer_id:      customer?.id   || null,  // link if logged in
        delivery_address: `${delivery.address}${delivery.apartment ? ", " + delivery.apartment : ""}`,
        district:         delivery.district,
        delivery_note:    delivery.note || null,
        payment_method:   payMethod,
        payment_status:   payMethod === "cod" ? "pending" : "pending_verification",
        txn_id:           txnId || null,
        status:           "pending",
        total:            total,
        items:            items.map((i) => ({
          product_id:   i.productId,
          title:        i.title,
          variant:      i.variantLabel,
          price:        i.price,
          qty:          i.qty,
          line_total:   i.price * i.qty,
        })),
      };

      const { error } = await supabase.from("orders").insert(orderPayload);
      if (error) throw error;

      // Initial timeline entry
      await supabase.from("order_timeline").insert({
        order_id: newOrderId,
        status:   "pending",
        note:     "Order placed",
      });

      clearCart(store.id);
      setOrderId(newOrderId);
    } catch (err) {
      alert("Order দিতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setPlacing(false);
    }
  }

  // ── Payment methods ──────────────────────────────────────────────────────────
  const paymentConfig = store?.payment_methods_configured || {};
  const availableMethods = [
    paymentConfig.bkash     && { id: "bkash",     label: "bKash",      txn: true  },
    paymentConfig.nagad     && { id: "nagad",      label: "Nagad",      txn: true  },
    paymentConfig.rocket    && { id: "rocket",     label: "Rocket",     txn: true  },
    paymentConfig.sslcommerz && { id: "sslcommerz",label: "Card / Net", txn: false },
    paymentConfig.cod       && { id: "cod",        label: "Cash on Delivery (COD)", txn: false },
  ].filter(Boolean);

  // ── Success Screen ───────────────────────────────────────────────────────────
  if (orderId) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center shadow-sm">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-1">Order দেওয়া হয়েছে!</h1>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Order ID: <strong className="text-[var(--foreground)]">{orderId}</strong>
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            আপনার ফোনে একটি confirmation SMS পাঠানো হবে।
          </p>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => navigate({ to: "/track", search: { shop: subdomain } })}>
              Order Track করুন
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate({ to: "/shop", search: { shop: subdomain } })}>
              আরো কিনুন
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold">{store?.shop_name} — Checkout</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <StepIndicator current={step} />

        {/* Price change notice (C2-FR) */}
        {priceChanges.length > 0 && (
          <div className="mb-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-700 dark:text-orange-400">
              <strong>দাম পরিবর্তন হয়েছে:</strong>
              {priceChanges.map((c) => (
                <div key={c.key} className="text-xs mt-0.5">
                  {c.title}: ৳{c.oldPrice} → ৳{c.newPrice}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 1: Delivery Info ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">ডেলিভারি তথ্য</h2>

            {/* Saved address picker (logged-in only) */}
            {isLoggedIn && savedAddresses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Saved Address</p>
                {savedAddresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                      selectedAddrId === addr.id
                        ? "border-[var(--primary)] bg-[var(--primary)]/5"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="savedAddr"
                      checked={selectedAddrId === addr.id}
                      onChange={() => {
                        setSelectedAddrId(addr.id);
                        setDelivery((d) => ({
                          ...d,
                          full_name: addr.full_name,
                          phone:     addr.phone,
                          address:   addr.address,
                          district:  addr.district,
                        }));
                      }}
                      className="mt-1"
                    />
                    <div className="text-sm">
                      <p className="font-medium">{addr.full_name}</p>
                      <p className="text-[var(--muted-foreground)] text-xs">{addr.phone} · {addr.address}, {addr.district}</p>
                    </div>
                  </label>
                ))}
                <button
                  className="text-sm text-[var(--primary)] hover:underline"
                  onClick={() => setSelectedAddrId(null)}
                >
                  + নতুন ঠিকানা দিন
                </button>
                <Separator />
              </div>
            )}

            <div className="grid gap-4">
              <div>
                <Label>পূর্ণ নাম *</Label>
                <Input className="mt-1" value={delivery.full_name}
                  onChange={(e) => setDelivery((d) => ({ ...d, full_name: e.target.value }))} />
                {deliveryErrors.full_name && <p className="text-xs text-red-500 mt-1">{deliveryErrors.full_name}</p>}
              </div>
              <div>
                <Label>ফোন নম্বর *</Label>
                <Input className="mt-1" placeholder="01XXXXXXXXX" value={delivery.phone}
                  onChange={(e) => setDelivery((d) => ({ ...d, phone: e.target.value }))} />
                {deliveryErrors.phone && <p className="text-xs text-red-500 mt-1">{deliveryErrors.phone}</p>}
              </div>
              <div>
                <Label>ইমেইল (ঐচ্ছিক)</Label>
                <Input className="mt-1" type="email" placeholder="your@email.com" value={delivery.email}
                  onChange={(e) => setDelivery((d) => ({ ...d, email: e.target.value }))} />
              </div>
              <div>
                <Label>সম্পূর্ণ ঠিকানা *</Label>
                <Input className="mt-1" placeholder="বাড়ি/রোড/এলাকা" value={delivery.address}
                  onChange={(e) => setDelivery((d) => ({ ...d, address: e.target.value }))} />
                {deliveryErrors.address && <p className="text-xs text-red-500 mt-1">{deliveryErrors.address}</p>}
              </div>
              <div>
                <Label>Apartment / Floor (ঐচ্ছিক)</Label>
                <Input className="mt-1" placeholder="যেমন: ৩য় তলা, Flat B" value={delivery.apartment}
                  onChange={(e) => setDelivery((d) => ({ ...d, apartment: e.target.value }))} />
              </div>
              <div>
                <Label>জেলা *</Label>
                <select
                  className="w-full mt-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]"
                  value={delivery.district}
                  onChange={(e) => setDelivery((d) => ({ ...d, district: e.target.value }))}
                >
                  <option value="">জেলা বেছে নিন</option>
                  {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
                </select>
                {deliveryErrors.district && <p className="text-xs text-red-500 mt-1">{deliveryErrors.district}</p>}
              </div>
              <div>
                <Label>ডেলিভারি নোট (ঐচ্ছিক)</Label>
                <Input className="mt-1" placeholder="কোনো বিশেষ নির্দেশনা থাকলে লিখুন" value={delivery.note}
                  onChange={(e) => setDelivery((d) => ({ ...d, note: e.target.value }))} />
              </div>
            </div>

            <Button className="w-full mt-2" onClick={handleStep1Next}>পরবর্তী: পেমেন্ট →</Button>
          </div>
        )}

        {/* ── STEP 2: Payment ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">পেমেন্ট পদ্ধতি</h2>

            {availableMethods.length === 0 && (
              <p className="text-sm text-red-500">এই shop-এ কোনো পেমেন্ট পদ্ধতি চালু নেই।</p>
            )}

            <div className="space-y-2">
              {availableMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                    payMethod === method.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)]"
                  }`}
                >
                  <input type="radio" name="payment" value={method.id}
                    checked={payMethod === method.id}
                    onChange={() => { setPayMethod(method.id); setTxnId(""); setPayError(""); }}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium text-sm">{method.label}</p>
                    {payMethod === method.id && method.txn && (
                      <div className="mt-3">
                        <p className="text-xs text-[var(--muted-foreground)] mb-1">
                          পেমেন্ট করার পর Transaction ID দিন:
                        </p>
                        <Input
                          placeholder="TXN ID / Reference"
                          value={txnId}
                          onChange={(e) => setTxnId(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}
                    {payMethod === method.id && method.id === "cod" && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        ডেলিভারির সময় cash পরিশোধ করুন।
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {payError && <p className="text-sm text-red-500">{payError}</p>}
            <Button className="w-full" onClick={handleStep2Next}>পর্যালোচনা করুন →</Button>
          </div>
        )}

        {/* ── STEP 3: Review & Place ────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Order পর্যালোচনা করুন</h2>

            {/* Items */}
            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                <h3 className="font-semibold text-sm">পণ্যের তালিকা</h3>
              </div>
              {items.map((item) => (
                <div key={item.key} className="flex gap-3 p-4 border-b border-[var(--border)] last:border-0">
                  {item.image && (
                    <img src={item.image} alt={item.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.variantLabel && <p className="text-xs text-[var(--muted-foreground)]">{item.variantLabel}</p>}
                    <p className="text-xs text-[var(--muted-foreground)]">×{item.qty}</p>
                  </div>
                  <p className="text-sm font-semibold whitespace-nowrap">৳{(item.price * item.qty).toLocaleString()}</p>
                </div>
              ))}
              <div className="p-4 bg-[var(--muted)]/30 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">Subtotal</span>
                  <span>৳{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">Delivery</span>
                  <span className="text-green-600">Merchant নির্ধারণ করবেন</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>মোট</span>
                  <span>৳{subtotal.toLocaleString()}+</span>
                </div>
              </div>
            </div>

            {/* Delivery summary */}
            <div className="border border-[var(--border)] rounded-xl p-4 space-y-1">
              <h3 className="font-semibold text-sm mb-2">ডেলিভারি ঠিকানা</h3>
              <p className="text-sm">{delivery.full_name} · {delivery.phone}</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {delivery.address}{delivery.apartment ? ", " + delivery.apartment : ""}, {delivery.district}
              </p>
              {delivery.note && <p className="text-xs text-[var(--muted-foreground)]">নোট: {delivery.note}</p>}
            </div>

            {/* Payment summary */}
            <div className="border border-[var(--border)] rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-1">পেমেন্ট</h3>
              <p className="text-sm capitalize">{payMethod}</p>
              {txnId && <p className="text-xs text-[var(--muted-foreground)]">TXN: {txnId}</p>}
            </div>

            {/* ─── Policy Links (C3-FR: show on review step) ─────────────────── */}
            {(store?.return_policy || store?.shipping_policy) && (
              <div className="text-xs text-[var(--muted-foreground)] text-center space-y-1">
                <p>Order দেওয়ার আগে আমাদের policy পড়ুন:</p>
                <div className="flex justify-center gap-4">
                  {store.return_policy && (
                    <button
                      className="text-[var(--primary)] hover:underline"
                      onClick={() => alert(store.return_policy)}
                    >
                      Return Policy
                    </button>
                  )}
                  {store.shipping_policy && (
                    <button
                      className="text-[var(--primary)] hover:underline"
                      onClick={() => alert(store.shipping_policy)}
                    >
                      Shipping Policy
                    </button>
                  )}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={placing}
              onClick={placeOrder}
            >
              {placing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Order দেওয়া হচ্ছে…</>
              ) : "Order দিন"}
            </Button>

            <p className="text-xs text-center text-[var(--muted-foreground)]">
              Order দেওয়ার পর পরিবর্তন করতে merchant-এর সাথে যোগাযোগ করুন।
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
