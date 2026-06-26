// src/pages/customer-account.jsx  (FINAL)
import { useState, useEffect } from "react";
import { useNavigate, Link }   from "@tanstack/react-router";
import { supabase }            from "@/integrations/supabase/client";
import { useCustomerAuth }     from "@/hooks/use-customer-auth";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Package, MapPin, Settings, LogOut, Plus, Trash2, Star, AlertCircle, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";

const STATUS_COLORS = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100   text-blue-700",
  shipped:   "bg-purple-100 text-purple-700",
  delivered: "bg-green-100  text-green-700",
  cancelled: "bg-red-100    text-red-700",
};
const STATUS_LABELS = { pending:"Pending", confirmed:"Confirmed", shipped:"Shipped", delivered:"Delivered", cancelled:"Cancelled" };
const fmt = (d) => new Date(d).toLocaleDateString("en-BD", { day:"numeric", month:"short", year:"numeric" });
const DISTRICTS = [
  "Dhaka","Chittagong","Sylhet","Rajshahi","Khulna","Barishal","Rangpur","Mymensingh",
  "Comilla","Narayanganj","Gazipur","Cox's Bazar","Feni","Noakhali","Brahmanbaria",
  "Habiganj","Moulvibazar","Sunamganj","Bogura","Pabna","Sirajganj","Dinajpur",
  "Kurigram","Gaibandha","Lalmonirhat","Nilphamari","Thakurgaon","Jessore","Satkhira",
  "Narail","Bagerhat","Jhenaidah","Kushtia","Meherpur","Bhola","Patuakhali","Pirojpur",
  "Barguna","Kishoreganj","Netrokona","Jamalpur","Sherpur","Tangail","Faridpur",
  "Madaripur","Shariatpur","Gopalganj","Manikganj","Munshiganj","Narsingdi","Natore","Naogaon",
];

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab({ customerId, customerEmail }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,order_id,status,total,created_at,items,payment_method,stores(shop_name,subdomain)")
        .or(`customer_id.eq.${customerId},customer_email.eq.${customerEmail}`)
        .order("created_at", { ascending: false });
      setOrders(data || []);
      setLoading(false);
    })();
  }, [customerId, customerEmail]);

  if (loading) return <p className="text-sm text-center py-10 text-[var(--muted-foreground)]">লোড হচ্ছে…</p>;
  if (!orders.length) return (
    <div className="text-center py-16">
      <Package className="h-12 w-12 mx-auto opacity-20 mb-3" />
      <p className="text-[var(--muted-foreground)] text-sm">এখনও কোনো order নেই।</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)] transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm">#{order.order_id}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{order.stores?.shop_name} · {fmt(order.created_at)}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {Array.isArray(order.items) ? order.items.length : 0} পণ্য · {order.payment_method?.toUpperCase()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
              <span className="text-sm font-bold">৳{Number(order.total).toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <Link to="/track" search={{ shop: order.stores?.subdomain, order_id: order.order_id }}
              className="text-xs font-medium text-[var(--primary)] hover:underline">
              Order Track করুন →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Addresses Tab ─────────────────────────────────────────────────────────────
function AddressesTab({ customerId }) {
  const [addresses, setAddresses] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [form,      setForm]      = useState({ label:"Home", full_name:"", phone:"", address:"", district:"" });

  const load = async () => {
    const { data } = await supabase.from("customer_addresses").select("*")
      .eq("customer_id", customerId).order("is_default", { ascending: false });
    setAddresses(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [customerId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (addresses.length >= 3) { setError("সর্বোচ্চ ৩টি address। আগে একটি মুছুন।"); return; }
    setSaving(true);
    const { error: err } = await supabase.from("customer_addresses").insert({
      customer_id: customerId, ...form, is_default: addresses.length === 0,
    });
    if (err) setError(err.message);
    else { setAdding(false); setForm({ label:"Home", full_name:"", phone:"", address:"", district:"" }); await load(); }
    setSaving(false);
  };

  const setDefault = async (id) => {
    await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", customerId);
    await supabase.from("customer_addresses").update({ is_default: true  }).eq("id", id);
    await load();
  };

  const del = async (id) => { await supabase.from("customer_addresses").delete().eq("id", id); await load(); };

  if (loading) return <p className="text-sm text-center py-10 text-[var(--muted-foreground)]">লোড হচ্ছে…</p>;

  return (
    <div className="space-y-3">
      {addresses.map((addr) => (
        <div key={addr.id} className={`border rounded-xl p-4 ${addr.is_default ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)]"}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold bg-[var(--muted)] px-2 py-0.5 rounded-full">{addr.label}</span>
                {addr.is_default && <span className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1"><Star className="h-3 w-3 fill-current" /> Default</span>}
              </div>
              <p className="text-sm font-medium">{addr.full_name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{addr.phone}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{addr.address}, {addr.district}</p>
            </div>
            <div className="flex items-center gap-1">
              {!addr.is_default && (
                <button className="text-xs text-[var(--primary)] hover:underline px-2 py-1" onClick={() => setDefault(addr.id)}>Default</button>
              )}
              <button className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500 transition-colors" onClick={() => del(addr.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-500 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {error}</p>}

      {addresses.length < 3 && !adding && (
        <button onClick={() => setAdding(true)}
          className="w-full border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" /> নতুন Address যোগ করুন ({addresses.length}/3)
        </button>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="border border-[var(--border)] rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">নতুন Address</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Label</Label>
              <select className="w-full mt-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]"
                value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}>
                {["Home","Office","Other"].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">জেলা *</Label>
              <select className="w-full mt-1 border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)]"
                value={form.district} onChange={(e) => setForm(f => ({ ...f, district: e.target.value }))} required>
                <option value="">বেছে নিন</option>
                {DISTRICTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div><Label className="text-xs">নাম *</Label><Input className="mt-1" required value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div><Label className="text-xs">ফোন *</Label><Input className="mt-1" required placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><Label className="text-xs">ঠিকানা *</Label><Input className="mt-1" required value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? "সেভ হচ্ছে…" : "Save করুন"}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>বাতিল</Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab({ profile, updateProfile, changePassword, deleteAccount, isGoogleUser }) {
  const [name,      setName]      = useState(profile?.full_name || "");
  const [phone,     setPhone]     = useState(profile?.phone     || "");
  const [curPw,     setCurPw]     = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [msg,       setMsg]       = useState({ type:"", text:"" });
  const [saving,    setSaving]    = useState(false);
  const [delPhrase, setDelPhrase] = useState("");
  const [showDel,   setShowDel]   = useState(false);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type:"", text:"" }), 4000); };

  const handleProfile = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await updateProfile({ fullName: name, phone }); flash("success","Profile আপডেট হয়েছে।"); }
    catch (err) { flash("error", err.message); }
    finally { setSaving(false); }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (newPw.length < 8 || !/\d/.test(newPw)) { flash("error","পাসওয়ার্ড ৮+ অক্ষর ও একটি সংখ্যা দিন।"); return; }
    setSaving(true);
    try { await changePassword({ currentPassword: curPw, newPassword: newPw }); setCurPw(""); setNewPw(""); flash("success","পাসওয়ার্ড পরিবর্তন হয়েছে।"); }
    catch (err) { flash("error", err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleProfile} className="space-y-3">
        <h3 className="font-semibold">প্রোফাইল তথ্য</h3>
        <div><Label className="text-xs">পূর্ণ নাম</Label><Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label className="text-xs">ফোন নম্বর</Label><Input className="mt-1" value={phone} placeholder="01XXXXXXXXX" onChange={(e) => setPhone(e.target.value)} /></div>
        {msg.text && (
          <p className={`text-xs flex items-center gap-1 ${msg.type === "success" ? "text-green-600" : "text-red-500"}`}>
            {msg.type === "success" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />} {msg.text}
          </p>
        )}
        <Button type="submit" size="sm" disabled={saving}>{saving ? "সেভ হচ্ছে…" : "Profile আপডেট"}</Button>
      </form>

      <Separator />

      {isGoogleUser ? (
        <div className="text-sm text-[var(--muted-foreground)] bg-[var(--muted)]/50 rounded-xl p-4">
          Google দিয়ে login করেছেন। পাসওয়ার্ড পরিবর্তন করতে Google account settings ব্যবহার করুন।
        </div>
      ) : (
        <form onSubmit={handlePwChange} className="space-y-3">
          <h3 className="font-semibold">পাসওয়ার্ড পরিবর্তন</h3>
          <div><Label className="text-xs">বর্তমান পাসওয়ার্ড</Label><Input className="mt-1" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required /></div>
          <div><Label className="text-xs">নতুন পাসওয়ার্ড</Label><Input className="mt-1" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required /></div>
          <Button type="submit" size="sm" variant="outline" disabled={saving}>পাসওয়ার্ড পরিবর্তন</Button>
        </form>
      )}

      <Separator />

      <div className="space-y-3">
        <h3 className="font-semibold text-red-500">Account মুছুন</h3>
        <p className="text-xs text-[var(--muted-foreground)]">সব saved data মুছে যাবে। Merchant-দের কাছে order records থাকবে।</p>
        {!showDel ? (
          <Button type="button" variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => setShowDel(true)}>Account মুছুন</Button>
        ) : (
          <div className="border border-red-200 rounded-xl p-4 space-y-3 bg-red-50/50 dark:bg-red-950/20">
            <p className="text-xs text-red-600">নিশ্চিত করতে <strong>DELETE</strong> লিখুন:</p>
            <Input placeholder="DELETE" value={delPhrase} onChange={(e) => setDelPhrase(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="destructive" disabled={delPhrase !== "DELETE"} onClick={deleteAccount}>চিরতরে মুছুন</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setShowDel(false); setDelPhrase(""); }}>বাতিল</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerAccountPage() {
  const navigate = useNavigate();
  const { customer, profile, loading, isLoggedIn, signOut, updateProfile, changePassword, deleteAccount } = useCustomerAuth();
  const [tab, setTab] = useState("orders");

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate({ to: "/customer/login", search: { redirect: "/customer/account" } });
  }, [loading, isLoggedIn, navigate]);

  if (loading || !isLoggedIn) return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <p className="text-sm text-[var(--muted-foreground)]">লোড হচ্ছে…</p>
    </div>
  );

  const isGoogleUser = customer?.app_metadata?.provider === "google";
  const TABS = [
    { id:"orders",    label:"Orders",    icon: Package  },
    { id:"addresses", label:"Addresses", icon: MapPin   },
    { id:"settings",  label:"Settings",  icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Logo className="h-7" />
          <Button variant="ghost" size="sm" className="gap-1.5 text-[var(--muted-foreground)]"
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">আমার Account</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{profile?.full_name || "Customer"} · {customer.email}</p>
        </div>

        <div className="flex border-b border-[var(--border)] mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "orders"    && <OrdersTab    customerId={customer.id} customerEmail={customer.email} />}
        {tab === "addresses" && <AddressesTab customerId={customer.id} />}
        {tab === "settings"  && <SettingsTab  profile={profile} updateProfile={updateProfile} changePassword={changePassword} deleteAccount={deleteAccount} isGoogleUser={isGoogleUser} />}
      </div>
    </div>
  );
}
