// src/pages/customer-account.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  CheckCircle2,
  LogOut,
  MapPin,
  Package,
  Plus,
  Settings,
  Star,
  Trash2,
  FileDown,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { openInvoicePdf } from "@/lib/invoice";

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
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

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function money(value) {
  return `BDT ${Number(value || 0).toLocaleString()}`;
}

function OrdersTab({ customerId, customerEmail }) {
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
        .select("id, order_id, status, total, created_at, items, payment_method, customer_phone, stores(shop_name, subdomain)")
        .or(`customer_id.eq.${customerId},customer_email.eq.${customerEmail}`)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (queryError) {
        setError(queryError.message);
        setOrders([]);
      } else {
        setOrders(data || []);
      }

      setLoading(false);
    }

    loadOrders();
    return () => { mounted = false; };
  }, [customerId, customerEmail]);

  if (loading) {
    return <p className="text-sm text-center py-10 text-[var(--muted-foreground)]">Loading orders...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500 py-6">Could not load orders: {error}</p>;
  }

  if (!orders.length) {
    return (
      <div className="text-center py-16">
        <Package className="h-12 w-12 mx-auto opacity-20 mb-3" />
        <p className="text-[var(--muted-foreground)] text-sm">You have not placed any orders yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)] transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm">#{order.order_id}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {order.stores?.shop_name || "Shop"} · {formatDate(order.created_at)}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {Array.isArray(order.items) ? order.items.length : 0} item(s) · {order.payment_method?.toUpperCase()}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
              <span className="text-sm font-bold">{money(order.total)}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
            <Link
              to="/track"
              search={{ store: order.stores?.subdomain, order: order.order_id, phone: order.customer_phone || "" }}
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              Track order
            </Link>
            <button
              type="button"
              onClick={() => openInvoicePdf(order, order.stores || {})}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              <FileDown className="h-3.5 w-3.5" /> Invoice
            </button>
          </div>
        </div>
      ))}
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
    return <p className="text-sm text-center py-10 text-[var(--muted-foreground)]">Loading addresses...</p>;
  }

  return (
    <div className="space-y-3">
      {addresses.map((address) => (
        <div key={address.id} className={`border rounded-xl p-4 ${address.is_default ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)]"}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold bg-[var(--muted)] px-2 py-0.5 rounded-full">{address.label}</span>
                {address.is_default && (
                  <span className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" /> Default
                  </span>
                )}
              </div>
              <p className="text-sm font-medium">{address.full_name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{address.phone}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{address.address}, {address.district}</p>
            </div>

            <div className="flex items-center gap-1">
              {!address.is_default && (
                <button type="button" className="text-xs text-[var(--primary)] hover:underline px-2 py-1" onClick={() => setDefault(address.id)}>
                  Make default
                </button>
              )}
              <button
                type="button"
                className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                onClick={() => deleteAddress(address.id)}
                aria-label="Delete address"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {addresses.length < 3 && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add new address ({addresses.length}/3)
        </button>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="border border-[var(--border)] rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">New address</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Label</Label>
              <select
                className="w-full mt-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]"
                value={form.label}
                onChange={(event) => setForm((value) => ({ ...value, label: event.target.value }))}
              >
                {['Home', 'Office', 'Other'].map((label) => <option key={label} value={label}>{label}</option>)}
              </select>
            </div>

            <div>
              <Label className="text-xs">District *</Label>
              <select
                className="w-full mt-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]"
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
            <Label className="text-xs">Full name *</Label>
            <Input className="mt-1" required value={form.full_name} onChange={(event) => setForm((value) => ({ ...value, full_name: event.target.value }))} />
          </div>

          <div>
            <Label className="text-xs">Phone *</Label>
            <Input className="mt-1" required placeholder="01XXXXXXXXX" value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} />
          </div>

          <div>
            <Label className="text-xs">Address *</Label>
            <Input className="mt-1" required value={form.address} onChange={(event) => setForm((value) => ({ ...value, address: event.target.value }))} />
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving..." : "Save address"}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}
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
    <div className="space-y-6">
      <form onSubmit={handleProfileSubmit} className="space-y-3">
        <h3 className="font-semibold">Profile information</h3>
        <div>
          <Label className="text-xs">Full name</Label>
          <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Phone number</Label>
          <Input className="mt-1" value={phone} placeholder="01XXXXXXXXX" onChange={(event) => setPhone(event.target.value)} />
        </div>

        {message.text && (
          <p className={`text-xs flex items-center gap-1 ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
            {message.type === "success" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {message.text}
          </p>
        )}

        <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving..." : "Update profile"}</Button>
      </form>

      <Separator />

      {isGoogleUser ? (
        <div className="text-sm text-[var(--muted-foreground)] bg-[var(--muted)]/50 rounded-xl p-4">
          You signed in with Google. Manage your password from your Google account settings.
        </div>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <h3 className="font-semibold">Change password</h3>
          <div>
            <Label className="text-xs">Current password</Label>
            <Input className="mt-1" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div>
            <Label className="text-xs">New password</Label>
            <Input className="mt-1" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={saving}>Change password</Button>
        </form>
      )}

      <Separator />

      <div className="space-y-3">
        <h3 className="font-semibold text-red-500">Delete account</h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          Your saved profile and addresses will be deleted. Order records may remain with the merchant for business records.
        </p>

        {!showDeleteConfirm ? (
          <Button type="button" variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
            Delete account
          </Button>
        ) : (
          <div className="border border-red-200 rounded-xl p-4 space-y-3 bg-red-50/50 dark:bg-red-950/20">
            <p className="text-xs text-red-600">Type <strong>DELETE</strong> to confirm:</p>
            <Input placeholder="DELETE" value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="destructive" disabled={deletePhrase !== "DELETE"} onClick={deleteAccount}>
                Delete permanently
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setShowDeleteConfirm(false); setDeletePhrase(""); }}>
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
  const {
    customer,
    profile,
    loading,
    isLoggedIn,
    signOut,
    updateProfile,
    changePassword,
  } = useCustomerAuth();

  const [tab, setTab] = useState("orders");

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate({ to: "/customer/login", search: { redirect: "/customer/account" } });
    }
  }, [loading, isLoggedIn, navigate]);

  if (loading || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-sm text-[var(--muted-foreground)]">Loading account...</p>
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

    await signOut();
    navigate({ to: "/" });
  }

  const tabs = [
    { id: "orders", label: "Orders", icon: Package },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo className="h-7" />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[var(--muted-foreground)]"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">My account</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {profile?.full_name || customer?.user_metadata?.full_name || "Customer"} · {customer.email}
          </p>
        </div>

        <div className="flex border-b border-[var(--border)] mb-6 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "orders" && <OrdersTab customerId={customer.id} customerEmail={customer.email} />}
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
      </div>
    </div>
  );
}
