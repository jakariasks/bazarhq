// src/pages/checkout.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { clearCart, getCart, getCartTotals, reconcileCartWithProducts } from "@/lib/cart";
import { trackStoreEvent } from "@/lib/analytics-tracker";
import { getPolicyText } from "@/lib/shop-policies";
import { clearCheckoutDraft, getCheckoutDraft, saveCheckoutDraft } from "@/lib/checkout-draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2, ShieldCheck, TicketPercent, XCircle } from "lucide-react";

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
  const [stockChanges, setStockChanges] = useState([]);
  const [stockChangesAccepted, setStockChangesAccepted] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const restoredDraftHadAddressRef = useRef(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [step, setStep] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [deliveryErrors, setDeliveryErrors] = useState({});
  const [paymentError, setPaymentError] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [priceChangesAccepted, setPriceChangesAccepted] = useState(false);
  const [availableMethods, setAvailableMethods] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [productDeliveryRules, setProductDeliveryRules] = useState({});
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);

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
        .select("id, shop_name, subdomain, return_policy, shipping_policy, logo_url, delivery_charge_dhaka, delivery_charge_outside_dhaka, free_delivery_min_amount")
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

    const draft = getCheckoutDraft(store.id);
    restoredDraftHadAddressRef.current = Boolean(draft?.delivery?.address);

    if (draft) {
      setDelivery((current) => ({ ...current, ...draft.delivery }));
      setSelectedAddressId(draft.selectedAddressId || "");
      setPaymentMethod(draft.paymentMethod || "");
      setTxnId(draft.txnId || "");
      setCouponCode(draft.couponCode || "");
      setPolicyAccepted(Boolean(draft.policyAccepted));
      setStep(draft.step || 1);
      setCheckoutNotice("Your saved checkout information has been restored.");
    }

    setDraftReady(true);
  }, [store?.id]);

  useEffect(() => {
    if (!store?.id) return;

    const cartData = getCart(store.id);
    if (cartData.items.length === 0) {
      navigate({ to: "/shop", search: { store: subdomain } });
      return;
    }

    refreshCartFromServer({ finalCheck: false });
  }, [store?.id, navigate, subdomain]);

  useEffect(() => {
    if (!store?.id || !draftReady || orderId) return;

    const timer = window.setTimeout(() => {
      persistCheckoutDraft();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    store?.id,
    draftReady,
    orderId,
    delivery,
    selectedAddressId,
    paymentMethod,
    txnId,
    couponCode,
    policyAccepted,
    step,
  ]);

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
        if (defaultAddress && !restoredDraftHadAddressRef.current) applySavedAddress(defaultAddress);
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

  const { subtotal, items } = useMemo(
    () => getCartTotals(store?.id || "", 0),
    [store?.id, cartVersion]
  );

  const isDhakaDelivery = delivery.district.trim().toLowerCase() === "dhaka";
  const storeDefaultDeliveryCharge = isDhakaDelivery
    ? Number(store?.delivery_charge_dhaka ?? 60)
    : Number(store?.delivery_charge_outside_dhaka ?? 120);
  const freeDeliveryMin = Number(store?.free_delivery_min_amount ?? 0);
  const productDeliveryBreakdown = useMemo(() => {
    if (!delivery.district) return [];
    return items.map((item) => {
      const rule = productDeliveryRules[item.productId] || {};
      const mode = rule.mode || "store_default";
      let amount = Math.max(0, Number(storeDefaultDeliveryCharge || 0));
      let label = "Store default";

      if (mode === "free") {
        amount = 0;
        label = "Free delivery offer";
      } else if (mode === "custom") {
        const customAmount = isDhakaDelivery ? rule.dhaka : rule.outsideDhaka;
        amount = Math.max(0, Number(customAmount ?? storeDefaultDeliveryCharge ?? 0));
        label = "Product delivery charge";
      }

      return {
        key: item.key,
        title: item.title,
        amount,
        label,
      };
    });
  }, [delivery.district, items, productDeliveryRules, storeDefaultDeliveryCharge, isDhakaDelivery]);
  const deliveryCharge = delivery.district
    ? (freeDeliveryMin > 0 && subtotal >= freeDeliveryMin
        ? 0
        : productDeliveryBreakdown.reduce((max, item) => Math.max(max, item.amount), 0))
    : 0;
  const deliveryZoneLabel = !delivery.district
    ? "Select district"
    : isDhakaDelivery ? "Inside Dhaka" : "Outside Dhaka";
  const totalBeforeDiscount = subtotal + deliveryCharge;
  const discountAmount = Math.min(
    Math.max(0, Number(appliedCoupon?.discount_amount || 0)),
    totalBeforeDiscount
  );
  const total = Math.max(0, totalBeforeDiscount - discountAmount);

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

  function persistCheckoutDraft(overrides = {}) {
    if (!store?.id) return;

    saveCheckoutDraft(store.id, {
      delivery,
      selectedAddressId,
      paymentMethod,
      txnId,
      couponCode,
      policyAccepted,
      step,
      ...overrides,
    });
  }

  async function refreshCartFromServer({ finalCheck = false } = {}) {
    if (!store?.id) return { ok: false, priceChanges: [], stockChanges: [] };

    const cartData = getCart(store.id);
    if (!cartData.items.length) {
      navigate({ to: "/shop", search: { store: subdomain } });
      return { ok: false, priceChanges: [], stockChanges: [] };
    }

    const productIds = [...new Set(cartData.items.map((item) => item.productId).filter(Boolean))];
    const { data, error } = await supabase
      .from("products")
      .select("id, title, price, stock, status, variants, has_variants, delivery_charge_mode, delivery_charge_dhaka, delivery_charge_outside_dhaka")
      .in("id", productIds);

    if (error) {
      setPaymentError("Could not verify the latest prices and stock. Please try again.");
      return { ok: false, priceChanges: [], stockChanges: [] };
    }

    const deliveryRules = {};
    (data || []).forEach((product) => {
      deliveryRules[product.id] = {
        mode: product.delivery_charge_mode || "store_default",
        dhaka: product.delivery_charge_dhaka,
        outsideDhaka: product.delivery_charge_outside_dhaka,
      };
    });
    setProductDeliveryRules(deliveryRules);

    const result = reconcileCartWithProducts(store.id, data || []);
    setCartVersion((value) => value + 1);

    if (result.priceChanges.length) {
      setPriceChanges(result.priceChanges);
      setPriceChangesAccepted(false);
      setAppliedCoupon(null);
      if (couponCode.trim()) {
        setCouponError("Prices changed. Please apply the coupon again after accepting the new prices.");
      }
    }

    if (result.stockChanges.length) {
      setStockChanges(result.stockChanges);
      setStockChangesAccepted(false);
    }

    if (!getCart(store.id).items.length) {
      navigate({ to: "/shop", search: { store: subdomain } });
      return { ok: false, ...result };
    }

    const hasChanges = result.priceChanges.length > 0 || result.stockChanges.length > 0;
    if (finalCheck && hasChanges) {
      setPaymentError("Your cart changed while checking out. Review and confirm the updated cart before placing the order.");
      setStep(2);
    }

    return { ok: !hasChanges, ...result };
  }

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
    persistCheckoutDraft();
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
    if (priceChanges.length > 0 && !priceChangesAccepted) {
      setPaymentError("Please accept the updated cart prices before reviewing the order.");
      return;
    }
    if (stockChanges.length > 0 && !stockChangesAccepted) {
      setPaymentError("Please acknowledge the stock adjustment before reviewing the order.");
      return;
    }
    if (validatePayment()) setStep(3);
  }


  async function applyCoupon() {
    setCouponError("");
    const code = couponCode.trim().toUpperCase();

    if (!code) {
      setCouponError("Enter a coupon code.");
      return;
    }

    if (!store?.id) {
      setCouponError("Shop is not loaded yet.");
      return;
    }

    if (subtotal <= 0) {
      setCouponError("Add products before using a coupon.");
      return;
    }

    setCouponLoading(true);
    const { data, error } = await supabase.rpc("validate_coupon", {
      p_store_id: store.id,
      p_code: code,
      p_subtotal: subtotal,
    });
    setCouponLoading(false);

    if (error) {
      setAppliedCoupon(null);
      setCouponError(error.message || "Coupon could not be applied.");
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.valid) {
      setAppliedCoupon(null);
      setCouponError(result?.message || "Invalid coupon code.");
      return;
    }

    setAppliedCoupon(result);
    setCouponCode(result.code || code);
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponError("");
    setCouponCode("");
  }


  async function verifyCartBeforeOrder() {
    const result = await refreshCartFromServer({ finalCheck: true });
    return result.ok;
  }

  async function placeOrder() {
    if (authLoading || placing) return;

    if (!isLoggedIn || !customer) {
      persistCheckoutDraft({ step: 3 });
      goToCustomerLogin();
      return;
    }

    if (!store || items.length === 0) {
      alert("Your cart is empty or the shop did not load correctly.");
      return;
    }

    if (priceChanges.length > 0 && !priceChangesAccepted) {
      setPaymentError("Please accept the updated cart prices before placing the order.");
      setStep(2);
      return;
    }

    if (stockChanges.length > 0 && !stockChangesAccepted) {
      setPaymentError("Please acknowledge the latest stock adjustment before placing the order.");
      setStep(2);
      return;
    }

    if (!policyAccepted) {
      alert("Please review and accept the shop policies before placing the order.");
      return;
    }

    if (!validateDelivery() || !validatePayment()) return;

    setPlacing(true);

    try {
      const cartStillValid = await verifyCartBeforeOrder();
      if (!cartStillValid) return;

      const freshCart = getCartTotals(store.id, 0);
      if (!freshCart.items.length) {
        navigate({ to: "/shop", search: { store: subdomain } });
        return;
      }

      const freshSubtotal = freshCart.subtotal;
      const freshTotalBeforeDiscount = freshSubtotal + deliveryCharge;
      const freshDiscountAmount = Math.min(
        Math.max(0, Number(appliedCoupon?.discount_amount || 0)),
        freshTotalBeforeDiscount
      );
      const freshTotal = Math.max(0, freshTotalBeforeDiscount - freshDiscountAmount);

      const publicOrderId = makeOrderId();
      const orderItems = freshCart.items.map((item) => ({
        product_id: item.productId,
        title: item.title,
        variant_id: item.variantId,
        variant: item.variantLabel,
        price: Number(item.price),
        qty: Number(item.qty),
      }));

      const { data, error } = await supabase.rpc("place_customer_order_v2", {
        p_order_id: publicOrderId,
        p_store_id: store.id,
        p_customer_name: delivery.full_name.trim(),
        p_customer_phone: delivery.phone.trim(),
        p_customer_email: delivery.email || customer.email || null,
        p_delivery_address: `${delivery.address}${delivery.apartment ? ", " + delivery.apartment : ""}`,
        p_district: delivery.district,
        p_delivery_note: delivery.note || null,
        p_payment_method: paymentMethod,
        p_payment_status: paymentMethod === "ssl"
          ? "pending_gateway"
          : paymentMethod === "cod"
            ? "pending"
            : "pending_verification",
        p_txn_id: txnId || null,
        p_items: orderItems,
        p_total: freshTotal,
        p_coupon_code: appliedCoupon?.code || null,
      });

      if (error) throw error;

      const createdOrderId = data?.order_id || publicOrderId;

      // Kick the durable notification worker immediately so merchant SMS/email
      // delivery normally starts within seconds. Cron remains the retry fallback.
      try {
        await Promise.race([
          supabase.functions.invoke("process-notification-queue", {
            body: { storeId: store.id, orderId: createdOrderId, reason: "order_placed" },
          }),
          new Promise((resolve) => window.setTimeout(resolve, 10_000)),
        ]);
      } catch {
        // Order placement must never fail because a notification provider is slow.
      }

      await trackStoreEvent({
        storeSlug: subdomain,
        storeId: store.id,
        eventType: "order_completed",
        path: window.location.pathname,
        metadata: {
          order_id: createdOrderId,
          subtotal: freshSubtotal,
          delivery_charge: deliveryCharge,
          discount_amount: freshDiscountAmount,
          coupon_code: appliedCoupon?.code || null,
          total: freshTotal,
          payment_method: paymentMethod,
        },
      });

      if (paymentMethod === "ssl") {
        const { data: gateway, error: gatewayError } = await supabase.functions.invoke("sslcommerz-initiate", {
          body: {
            order_id: createdOrderId,
            store_slug: subdomain,
          },
        });

        clearCart(store.id);
        clearCheckoutDraft(store.id);
        setCartVersion((value) => value + 1);

        if (gatewayError || !gateway?.gateway_url) {
          const reason = gateway?.code || "gateway-init-failed";
          window.location.assign(
            `/payment/fail?store=${encodeURIComponent(subdomain)}&order=${encodeURIComponent(createdOrderId)}&reason=${encodeURIComponent(reason)}`
          );
          return;
        }

        window.location.assign(gateway.gateway_url);
        return;
      }

      clearCart(store.id);
      clearCheckoutDraft(store.id);
      setOrderId(createdOrderId);
      setCartVersion((value) => value + 1);
    } catch (err) {
      const message = err?.message || "Unknown error";
      const isCartConflict = /only\s+\d+\s+left|product unavailable|selected variant is unavailable|order total changed|cart is empty/i.test(message);

      if (isCartConflict) {
        await refreshCartFromServer({ finalCheck: true });
        setPaymentError("Price or stock changed before the order was finalized. Review the updated cart and try again.");
        setStep(2);
        return;
      }

      alert(
        "Could not place the order: " +
        message +
        "\n\nMake sure the current customer checkout migration has been applied in Supabase."
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

        {checkoutNotice && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 p-4 text-sm text-green-800 dark:text-green-200">
            <div className="flex items-center justify-between gap-3">
              <span>{checkoutNotice}</span>
              <button type="button" className="text-xs font-medium underline" onClick={() => setCheckoutNotice("")}>Dismiss</button>
            </div>
          </div>
        )}

        {stockChanges.length > 0 && (
          <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 p-4 text-sm text-orange-800 dark:text-orange-200">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <AlertTriangle className="h-4 w-4" /> Stock changed while checking out
            </div>
            <ul className="list-disc list-inside space-y-1">
              {stockChanges.map((change) => <li key={`${change.key}-${change.type}`}>{change.message}</li>)}
            </ul>
            <Button
              type="button"
              size="sm"
              variant={stockChangesAccepted ? "outline" : "default"}
              className="mt-3"
              onClick={() => setStockChangesAccepted(true)}
            >
              {stockChangesAccepted ? "Stock update acknowledged" : "Acknowledge stock update"}
            </Button>
          </div>
        )}

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
            <Button
              type="button"
              size="sm"
              variant={priceChangesAccepted ? "outline" : "default"}
              className="mt-3"
              onClick={() => setPriceChangesAccepted(true)}
            >
              {priceChangesAccepted ? "Updated prices accepted" : "Accept updated prices"}
            </Button>
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
                {delivery.district && (
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--muted-foreground)]">Delivery charge · {deliveryZoneLabel}</span>
                      <span className="font-semibold">{deliveryCharge === 0 ? "Free" : money(deliveryCharge)}</span>
                    </div>
                    {freeDeliveryMin > 0 && deliveryCharge > 0 && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">Free delivery from {money(freeDeliveryMin)} order value.</p>
                    )}
                    {productDeliveryBreakdown.length > 0 && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        Delivery is calculated from the highest applicable product delivery charge in this cart.
                      </p>
                    )}
                  </div>
                )}
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
                      {paymentMethod === method.id && method.id === "ssl" && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">You will be redirected to SSLCommerz secure payment gateway after placing the order.</p>
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
                  <span className="text-[var(--muted-foreground)]">Delivery · {deliveryZoneLabel}</span>
                  <span className={deliveryCharge === 0 ? "text-green-600" : ""}>{deliveryCharge === 0 ? "Free" : money(deliveryCharge)}</span>
                </div>
                {productDeliveryBreakdown.length > 0 && (
                  <div className="rounded-lg bg-[var(--background)]/70 p-2 text-[11px] text-[var(--muted-foreground)] space-y-1">
                    {productDeliveryBreakdown.map((row) => (
                      <div key={row.key} className="flex justify-between gap-3">
                        <span className="truncate">{row.title} · {row.label}</span>
                        <span className="whitespace-nowrap">{row.amount === 0 ? "Free" : money(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <TicketPercent className="h-4 w-4 text-[var(--primary)]" />
                    Coupon code
                  </div>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                      <span>
                        <b>{appliedCoupon.code}</b> applied · {money(discountAmount)} discount
                      </span>
                      <button type="button" onClick={removeCoupon} className="inline-flex items-center gap-1 text-xs font-bold text-green-800 hover:underline">
                        <XCircle className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={couponCode}
                        onChange={(event) => {
                          setCouponCode(event.target.value.toUpperCase());
                          setCouponError("");
                        }}
                        placeholder="Enter coupon code"
                        className="uppercase"
                      />
                      <Button type="button" variant="outline" onClick={applyCoupon} disabled={couponLoading}>
                        {couponLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Apply
                      </Button>
                    </div>
                  )}
                  {couponError && <p className="mt-2 text-xs font-semibold text-red-500">{couponError}</p>}
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm font-semibold text-green-600">
                    <span>Discount {appliedCoupon?.code ? `· ${appliedCoupon.code}` : ""}</span>
                    <span>-{money(discountAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{money(total)}</span>
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

            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                <h3 className="text-sm font-semibold">Shop policies</h3>
              </div>
              <p className="mb-3 text-xs text-[var(--muted-foreground)]">
                Review the shop policies before placing your order.
              </p>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <button type="button" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left hover:border-[var(--primary)]" onClick={() => alert(getPolicyText(store, "return"))}>
                  Return policy
                </button>
                <button type="button" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left hover:border-[var(--primary)]" onClick={() => alert(getPolicyText(store, "shipping"))}>
                  Shipping policy
                </button>
                <button type="button" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left hover:border-[var(--primary)]" onClick={() => alert(getPolicyText(store, "payment"))}>
                  Payment policy
                </button>
              </div>
              <label className="mt-4 flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(event) => setPolicyAccepted(event.target.checked)}
                  className="mt-0.5"
                />
                <span>I have reviewed and agree to this shop's order, payment, return, and delivery policies.</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button disabled={placing} onClick={placeOrder}>
                {placing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {paymentMethod === "ssl" ? "Opening secure payment..." : "Placing..."}
                  </>
                ) : isLoggedIn ? (paymentMethod === "ssl" ? "Pay securely" : "Place order") : "Log in to order"}
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
