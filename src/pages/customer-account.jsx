// src/pages/customer-account.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { openInvoicePdf } from "@/lib/invoice";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileDown,
  Home,
  LogOut,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Trash2,
  Truck,
} from "lucide-react";

const STATUS_COLORS = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  processing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  shipped: "border-violet-200 bg-violet-50 text-violet-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  archived: "border-slate-200 bg-slate-100 text-slate-600",
};

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  archived: "Archived",
};

const DISTRICTS = [
  "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh",
  "Cumilla", "Narayanganj", "Gazipur", "Cox's Bazar", "Feni", "Noakhali", "Brahmanbaria",
  "Habiganj", "Moulvibazar", "Sunamganj", "Bogura", "Pabna", "Sirajganj", "Dinajpur",
  "Kurigram", "Gaibandha", "Lalmonirhat", "Nilphamari", "Thakurgaon", "Jashore", "Satkhira",
  "Narail", "Bagerhat", "Jhenaidah", "Kushtia", "Meherpur", "Bhola", "Patuakhali", "Pirojpur",
  "Barguna", "Kishoreganj", "Netrokona", "Jamalpur", "Sherpur", "Tangail", "Faridpur",
  "Madaripur", "Shariatpur", "Gopalganj", "Manikganj", "Munshiganj", "Narsingdi", "Natore", "Naogaon",
];

const pageMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: "easeOut" },
};

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function money(value) {
  return `BDT ${Number(value || 0).toLocaleString("en-BD")}`;
}

function countItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + Number(item?.quantity || item?.qty || 1), 0);
}

function AccountStat({ value, label, icon: Icon, tone = "indigo" }) {
  const tones = {
    indigo: "from-indigo-500/15 to-violet-500/5 text-indigo-700 ring-indigo-200/70",
    emerald: "from-emerald-500/15 to-cyan-500/5 text-emerald-700 ring-emerald-200/70",
    amber: "from-amber-400/20 to-orange-500/5 text-amber-700 ring-amber-200/70",
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ duration: 0.22 }}
      className="group rounded-[1.35rem] border border-white/80 bg-white/72 p-4 shadow-[0_18px_45px_-30px_rgba(79,70,229,.24)] backdrop-blur-xl"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${tones[tone]}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <p className="mt-4 text-2xl font-black tracking-[-0.03em] text-slate-950">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </motion.div>
  );
}

function OrdersTab({ customerId, customerEmail, onSummary }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("orders")
        .select("id, order_id, status, total, created_at, items, payment_method, customer_phone, stores(shop_name, subdomain, logo_url)")
        .or(`customer_id.eq.${customerId},customer_email.eq.${customerEmail}`)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (queryError) {
        setError(queryError.message);
        setOrders([]);
        onSummary?.({ total: 0, active: 0, delivered: 0 });
      } else {
        const rows = data || [];
        setOrders(rows);
        onSummary?.({
          total: rows.length,
          active: rows.filter((order) => ["pending", "confirmed", "processing", "shipped"].includes(order.status)).length,
          delivered: rows.filter((order) => order.status === "delivered").length,
        });
      }

      setLoading(false);
    }

    loadOrders();
    return () => { mounted = false; };
  }, [customerId, customerEmail, onSummary]);

  if (loading) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-40 animate-pulse rounded-[1.4rem] border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
        Could not load orders: {error}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[1.6rem] border border-dashed border-slate-300 bg-gradient-to-br from-white to-indigo-50/60 px-6 py-14 text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-xl font-black text-slate-950">Start your first marketplace order</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Browse products from multiple independent shops, compare prices, and place an order from any storefront.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-indigo-600"
        >
          Explore marketplace <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order, index) => {
        const shopSlug = order.stores?.subdomain;
        const itemCount = countItems(order.items);
        const canShopAgain = Boolean(shopSlug);

        return (
          <motion.article
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.04 }}
            whileHover={{ y: -3 }}
            className="group overflow-hidden rounded-[1.45rem] border border-slate-200 bg-white shadow-[0_18px_52px_-38px_rgba(15,23,42,.35)] transition hover:border-indigo-200 hover:shadow-[0_28px_60px_-40px_rgba(79,70,229,.4)]"
          >
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                {order.stores?.logo_url ? (
                  <img src={order.stores.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-2xl border border-slate-200 object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                    {String(order.stores?.shop_name || "S").charAt(0)}
                  </span>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-slate-950">#{order.order_id}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${STATUS_COLORS[order.status] || "border-slate-200 bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-700">{order.stores?.shop_name || "Marketplace shop"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {formatDate(order.created_at)} · {itemCount} item{itemCount === 1 ? "" : "s"} · {order.payment_method?.toUpperCase() || "PAYMENT"}
                  </p>
                </div>
              </div>

              <div className="shrink-0 sm:text-right">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Order total</p>
                <p className="mt-1 text-lg font-black text-slate-950">{money(order.total)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/75 px-5 py-3">
              <Link
                to="/track"
                search={{ store: shopSlug, order: order.order_id, phone: order.customer_phone || "" }}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
              >
                <Truck className="h-3.5 w-3.5" /> Track order
              </Link>

              <button
                type="button"
                onClick={() => openInvoicePdf(order, order.stores || {})}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
              >
                <FileDown className="h-3.5 w-3.5" /> Invoice
              </button>

              {canShopAgain && (
                <Link
                  to="/shop/$storeSlug"
                  params={{ storeSlug: shopSlug }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-indigo-600"
                >
                  Shop again <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

function AddressesTab({ customerId, profile }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    label: "Home",
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    address: "",
    district: "",
  });

  async function loadAddresses() {
    const { data, error: queryError } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false });

    if (queryError) setError(queryError.message);
    else setAddresses(data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function handleAdd(event) {
    event.preventDefault();
    setError("");

    if (addresses.length >= 3) {
      setError("You can save up to 3 addresses. Delete one address first.");
      return;
    }

    if (!/^01[3-9]\d{8}$/.test(form.phone)) {
      setError("Enter a valid Bangladesh phone number.");
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from("customer_addresses").insert({
      customer_id: customerId,
      label: form.label,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      district: form.district,
      is_default: addresses.length === 0,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setAdding(false);
      setForm({ label: "Home", full_name: profile?.full_name || "", phone: profile?.phone || "", address: "", district: "" });
      await loadAddresses();
    }

    setSaving(false);
  }

  async function setDefault(id) {
    await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", customerId);
    await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id);
    await loadAddresses();
  }

  async function deleteAddress(id) {
    await supabase.from("customer_addresses").delete().eq("id", id);
    await loadAddresses();
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-[1.4rem] bg-slate-100" />;
  }

  return (
    <div className="space-y-4">
      {addresses.map((address, index) => (
        <motion.div
          key={address.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
          whileHover={{ y: -2 }}
          className={`rounded-[1.35rem] border p-5 shadow-sm transition ${address.is_default ? "border-indigo-200 bg-indigo-50/70" : "border-slate-200 bg-white hover:border-indigo-200"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">{address.label}</span>
                {address.is_default && (
                  <span className="flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-black text-white">
                    <Star className="h-3 w-3 fill-current" /> Default
                  </span>
                )}
              </div>
              <p className="text-sm font-black text-slate-950">{address.full_name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{address.phone}</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{address.address}, {address.district}</p>
            </div>

            <div className="flex items-center gap-1">
              {!address.is_default && (
                <button type="button" className="rounded-full px-3 py-1.5 text-xs font-black text-indigo-600 transition hover:bg-indigo-50" onClick={() => setDefault(address.id)}>
                  Make default
                </button>
              )}
              <button
                type="button"
                className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                onClick={() => deleteAddress(address.id)}
                aria-label="Delete address"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      ))}

      {error && (
        <p className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {addresses.length < 3 && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[1.35rem] border-2 border-dashed border-slate-300 bg-white p-5 text-sm font-black text-slate-500 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600"
        >
          <Plus className="h-4 w-4" /> Add new address ({addresses.length}/3)
        </button>
      )}

      <AnimatePresence>
        {adding && (
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            onSubmit={handleAdd}
            className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="font-black text-slate-950">New delivery address</h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-bold">Label</Label>
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-400"
                  value={form.label}
                  onChange={(event) => setForm((value) => ({ ...value, label: event.target.value }))}
                >
                  {["Home", "Office", "Other"].map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold">District *</Label>
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-400"
                  value={form.district}
                  onChange={(event) => setForm((value) => ({ ...value, district: event.target.value }))}
                  required
                >
                  <option value="">Choose district</option>
                  {DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Full name *</Label>
              <Input className="mt-1 rounded-xl" required value={form.full_name} onChange={(event) => setForm((value) => ({ ...value, full_name: event.target.value }))} />
            </div>

            <div>
              <Label className="text-xs font-bold">Phone *</Label>
              <Input className="mt-1 rounded-xl" required placeholder="01XXXXXXXXX" value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} />
            </div>

            <div>
              <Label className="text-xs font-bold">Address *</Label>
              <Input className="mt-1 rounded-xl" required value={form.address} onChange={(event) => setForm((value) => ({ ...value, address: event.target.value }))} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm" className="rounded-full" disabled={saving}>{saving ? "Saving..." : "Save address"}</Button>
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsTab({ customer, profile, updateProfile, changePassword, deleteAccount }) {
  const [name, setName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isGoogleUser = customer?.app_metadata?.provider === "google";

  useEffect(() => {
    setName(profile?.full_name || "");
    setPhone(profile?.phone || "");
  }, [profile]);

  function flash(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 4000);
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await updateProfile({ fullName: name, phone });
      flash("success", "Profile updated successfully.");
    } catch (err) {
      flash("error", err.message || "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      flash("error", "Password must be at least 8 characters and include one number.");
      return;
    }

    setSaving(true);

    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      flash("success", "Password changed successfully.");
    } catch (err) {
      flash("error", err.message || "Password update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-[1.45rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600">Account profile</p>
          <h3 className="mt-2 text-lg font-black text-slate-950">Profile information</h3>
        </div>
        <div>
          <Label className="text-xs font-bold">Full name</Label>
          <Input className="mt-1 rounded-xl" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-bold">Phone number</Label>
          <Input className="mt-1 rounded-xl" value={phone} placeholder="01XXXXXXXXX" onChange={(event) => setPhone(event.target.value)} />
        </div>

        {message.text && (
          <p className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${message.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
            {message.type === "success" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {message.text}
          </p>
        )}

        <Button type="submit" size="sm" className="rounded-full" disabled={saving}>{saving ? "Saving..." : "Update profile"}</Button>
      </form>

      {isGoogleUser ? (
        <div className="rounded-[1.45rem] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600">Security</p>
          <h3 className="mt-2 text-lg font-black text-slate-950">Google account</h3>
          <p className="mt-3 leading-7">You signed in with Google. Manage your password from your Google account settings.</p>
        </div>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-[1.45rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600">Security</p>
            <h3 className="mt-2 text-lg font-black text-slate-950">Change password</h3>
          </div>
          <div>
            <Label className="text-xs font-bold">Current password</Label>
            <Input className="mt-1 rounded-xl" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div>
            <Label className="text-xs font-bold">New password</Label>
            <Input className="mt-1 rounded-xl" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </div>
          <Button type="submit" size="sm" variant="outline" className="rounded-full" disabled={saving}>Change password</Button>
        </form>
      )}

      <div className="rounded-[1.45rem] border border-rose-200 bg-rose-50/70 p-5 lg:col-span-2">
        <h3 className="font-black text-rose-600">Delete customer access</h3>
        <p className="mt-2 text-xs leading-6 text-rose-700/75">
          Your saved customer profile and addresses will be deleted. Merchant access, if present, remains available. Order records may remain for business records.
        </p>

        {!showDeleteConfirm ? (
          <Button type="button" variant="outline" size="sm" className="mt-4 rounded-full border-rose-200 bg-white text-rose-500 hover:bg-rose-100" onClick={() => setShowDeleteConfirm(true)}>
            Delete customer access
          </Button>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-white p-4">
            <p className="text-xs text-rose-600">Type <strong>DELETE</strong> to confirm:</p>
            <Input className="rounded-xl" placeholder="DELETE" value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="destructive" className="rounded-full" disabled={deletePhrase !== "DELETE"} onClick={deleteAccount}>
                Delete permanently
              </Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => { setShowDeleteConfirm(false); setDeletePhrase(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerAccountPage() {
  const navigate = useNavigate();
  const { isMerchant, activateMerchantRole } = useAuth();
  const {
    customer,
    rawUser,
    profile,
    loading,
    roleError,
    isLoggedIn,
    activateCustomerRole,
    signOut,
    updateProfile,
    changePassword,
    refreshRoles: refreshCustomerRoles,
  } = useCustomerAuth();

  const [tab, setTab] = useState("orders");
  const [summary, setSummary] = useState({ total: 0, active: 0, delivered: 0 });
  const [preparingAccess, setPreparingAccess] = useState(false);
  const [accessError, setAccessError] = useState("");
  const activationAttemptedRef = useRef(false);

  const prepareCustomerAccess = useCallback(async () => {
    if (!rawUser || preparingAccess) return;
    setPreparingAccess(true);
    setAccessError("");
    try {
      await activateCustomerRole({
        fullName: rawUser.user_metadata?.full_name || rawUser.user_metadata?.name,
        phone: rawUser.user_metadata?.phone,
      });
      await refreshCustomerRoles();
    } catch (error) {
      setAccessError(error?.message || "Customer access could not be prepared.");
    } finally {
      setPreparingAccess(false);
    }
  }, [rawUser, preparingAccess, activateCustomerRole, refreshCustomerRoles]);

  useEffect(() => {
    if (!loading && !rawUser) {
      navigate({ to: "/customer/login", search: { redirect: "/customer/account" }, replace: true });
    }
  }, [loading, rawUser, navigate]);

  useEffect(() => {
    if (loading || !rawUser || isLoggedIn || roleError || activationAttemptedRef.current) return;
    activationAttemptedRef.current = true;
    void prepareCustomerAccess();
  }, [loading, rawUser, isLoggedIn, roleError, prepareCustomerAccess]);

  const displayName = useMemo(
    () => profile?.full_name || customer?.user_metadata?.full_name || "Customer",
    [profile?.full_name, customer?.user_metadata?.full_name],
  );

  if (loading || preparingAccess || (!rawUser && !isLoggedIn)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#f8fafc_100%)] p-4">
        <div className="w-full max-w-sm rounded-[1.6rem] border border-white/80 bg-white/95 p-7 text-center shadow-[0_30px_80px_-45px_rgba(15,23,42,.5)] backdrop-blur">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
          <p className="mt-4 text-base font-black text-slate-950">Preparing your customer account</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Confirming your secure session and marketplace access. This should take only a moment.</p>
        </div>
      </div>
    );
  }

  if (rawUser && !isLoggedIn) {
    const currentError = accessError || roleError;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#f8fafc_100%)] p-4">
        <div className="w-full max-w-md rounded-[1.7rem] border border-slate-200 bg-white p-7 text-center shadow-[0_30px_80px_-45px_rgba(15,23,42,.5)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-950">Customer access needs one more step</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your BazarHQ sign-in is active, so we will not send you back to the login page. Retry the role check or add Customer access to this same account.</p>
          {currentError && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{currentError}</p>}
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={async () => {
                setAccessError("");
                try {
                  await refreshCustomerRoles();
                } catch (error) {
                  setAccessError(error?.message || "Customer access could not be refreshed.");
                }
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Retry check
            </Button>
            <Button className="h-11 rounded-xl bg-slate-950 text-white" onClick={prepareCustomerAccess}>
              <ShoppingBag className="mr-2 h-4 w-4" /> Add customer access
            </Button>
          </div>
          <Link to="/" className="mt-5 inline-flex text-sm font-bold text-indigo-600 hover:underline">Return to marketplace</Link>
        </div>
      </div>
    );
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm("This will delete your customer profile and saved addresses. Your completed order records may remain with merchants for business records. Continue?");
    if (!confirmed) return;

    const { error } = await supabase.rpc("delete_customer_account");
    if (error) {
      window.alert(error.message || "Could not delete account.");
      return;
    }

    await refreshCustomerRoles();
    if (isMerchant) {
      navigate({ to: "/merchant" });
    } else {
      await signOut();
      navigate({ to: "/" });
    }
  }

  const tabs = [
    { id: "orders", label: "Orders", icon: Package },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const quickActions = [
    { title: "Shop marketplace", text: "Browse products from all shops", icon: ShoppingBag, to: "/", tone: "bg-indigo-50 text-indigo-600" },
    { title: "Track an order", text: "Use order ID and phone", icon: Truck, to: "/track", tone: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <motion.div {...pageMotion} className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] pb-14 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Go to BazarHQ marketplace" className="inline-flex items-center rounded-xl transition hover:opacity-80">
            <Logo size="md" />
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/"
              className="hidden h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-600 sm:inline-flex"
            >
              <ShoppingBag className="h-4 w-4" /> Marketplace
            </Link>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-slate-600"
              onClick={async () => {
                try {
                  if (!isMerchant) {
                    await activateMerchantRole({
                      fullName: profile?.full_name || customer?.user_metadata?.full_name,
                      phone: profile?.phone || customer?.user_metadata?.phone,
                    });
                  }
                  navigate({ to: "/merchant" });
                } catch (error) {
                  window.alert(error?.message || "Merchant access could not be prepared.");
                }
              }}
            >
              <Store className="h-4 w-4" /> <span className="hidden sm:inline">{isMerchant ? "Merchant" : "Start selling"}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-slate-600"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-indigo-100/80 bg-[linear-gradient(135deg,#f8faff_0%,#eef2ff_52%,#ecfeff_100%)] p-6 text-slate-950 shadow-[0_30px_90px_-48px_rgba(79,70,229,.34)] sm:p-8 lg:p-10">
          <motion.div
            aria-hidden="true"
            animate={{ x: [0, 16, 0], y: [0, -10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-300/28 blur-3xl"
          />
          <motion.div
            aria-hidden="true"
            animate={{ x: [0, -12, 0], y: [0, 12, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.72),rgba(255,255,255,.2)_46%,rgba(255,255,255,.48))]" />

          <div className="relative grid gap-8 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/75 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.17em] text-indigo-700 shadow-sm backdrop-blur-xl">
                <Sparkles className="h-3.5 w-3.5" /> Customer marketplace hub
              </span>

              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl lg:text-[2.75rem]">
                Welcome back, <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">{displayName}</span>
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Manage orders, saved addresses and account settings, then continue shopping across every active BazarHQ storefront.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-black text-white shadow-[0_14px_34px_-18px_rgba(79,70,229,.75)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(79,70,229,.82)]"
                >
                  Explore marketplace <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/track"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200/90 bg-white/75 px-5 text-sm font-black text-slate-700 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700"
                >
                  Track an order <Truck className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-white/85 bg-white/48 p-3 shadow-[0_20px_55px_-34px_rgba(79,70,229,.3)] backdrop-blur-2xl sm:p-4">
              <div className="mb-3 flex items-center justify-between px-1">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.17em] text-slate-500">Account overview</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">Your marketplace activity</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">Live</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <AccountStat value={summary.total} label="All orders" icon={Package} tone="indigo" />
                <AccountStat value={summary.active} label="In progress" icon={Truck} tone="amber" />
                <AccountStat value={summary.delivered} label="Delivered" icon={CheckCircle2} tone="emerald" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          {quickActions.map(({ title, text, icon: Icon, to, tone }) => (
            <motion.div key={title} whileHover={{ y: -3 }}>
              <Link
                to={to}
                className="group flex items-center gap-4 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_16px_45px_-36px_rgba(15,23,42,.35)] transition hover:border-indigo-200 hover:shadow-[0_22px_48px_-34px_rgba(79,70,229,.35)]"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-950">{title}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{text}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
              </Link>
            </motion.div>
          ))}
        </section>

        <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_70px_-52px_rgba(15,23,42,.45)]">
          <div className="border-b border-slate-200 px-4 sm:px-6">
            <div className="flex overflow-x-auto [scrollbar-width:none]">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`relative flex min-w-fit items-center gap-2 px-4 py-4 text-sm font-black transition ${
                    tab === id ? "text-indigo-600" : "text-slate-500 hover:text-slate-950"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                  {tab === id && <motion.span layoutId="customer-tab" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.22 }}
              >
                {tab === "orders" && <OrdersTab customerId={customer.id} customerEmail={customer.email} onSummary={setSummary} />}
                {tab === "addresses" && <AddressesTab customerId={customer.id} profile={profile} />}
                {tab === "settings" && (
                  <SettingsTab
                    customer={customer}
                    profile={profile}
                    updateProfile={updateProfile}
                    changePassword={changePassword}
                    deleteAccount={handleDeleteAccount}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-400">
          <Link to="/" className="inline-flex items-center gap-1.5 transition hover:text-indigo-600"><Home className="h-3.5 w-3.5" /> Marketplace home</Link>
          <span>•</span>
          <Link to="/track" className="transition hover:text-indigo-600">Track order</Link>
          <span>•</span>
          <button type="button" className="transition hover:text-indigo-600" onClick={() => setTab("settings")}>Account settings</button>
        </div>
      </main>
    </motion.div>
  );
}