// src/pages/superadmin/merchants.jsx
// A2 SRS: List, search, filter, view detail, suspend/reinstate/delete merchants
import { useEffect, useState, useMemo } from "react";
import { supabase }      from "@/integrations/supabase/client";
import { useAdminAuth }  from "@/hooks/use-admin-auth";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Badge }    from "@/components/ui/badge";
import {
  Search, ChevronRight, ShieldOff, ShieldCheck,
  Trash2, ExternalLink, AlertCircle, X, Loader2,
  Users, Store, Package, ShoppingCart,
} from "lucide-react";

const STATUS_STYLES = {
  active:    "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  suspended: "bg-red-900/30    text-red-400    border-red-800",
  deleted:   "bg-gray-800      text-gray-500   border-gray-700",
};

// ── Merchant Detail Drawer ─────────────────────────────────────────────────────
function MerchantDetail({ merchant, onClose, onSuspend, onReinstate, onDelete, actionLoading }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!merchant) return;
    (async () => {
      const [{ count: products }, { count: orders }, { data: rev }] = await Promise.all([
        supabase.from("products").select("id", { count:"exact", head:true }).eq("store_id", merchant.id),
        supabase.from("orders").select("id",   { count:"exact", head:true }).eq("store_id", merchant.id),
        supabase.from("orders").select("total").eq("store_id", merchant.id).neq("status","cancelled"),
      ]);
      const revenue = (rev || []).reduce((s, o) => s + Number(o.total || 0), 0);
      setStats({ products, orders, revenue });
    })();
  }, [merchant?.id]);

  if (!merchant) return null;

  const status = merchant.account_status || "active";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-md bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="font-bold text-white">Merchant Detail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Basic info */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-800 flex items-center justify-center text-lg font-bold text-white shrink-0">
              {merchant.shop_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-semibold text-white">{merchant.shop_name || "Unnamed Shop"}</p>
              <p className="text-sm text-gray-400">{merchant.owner_email || merchant.subdomain}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[status]}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
                {merchant.storefront_published && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-blue-800 bg-blue-900/30 text-blue-400">Live</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:"Products", value: stats.products || 0, icon: Package },
                { label:"Orders",   value: stats.orders   || 0, icon: ShoppingCart },
                { label:"Revenue",  value: `৳${Math.round((stats.revenue || 0)/1000)}K`, icon: Store },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-3 text-center">
                  <Icon className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Details */}
          <div className="space-y-2 text-sm">
            <Row label="Subdomain"    value={merchant.subdomain ? `${merchant.subdomain}.bazarhq.com` : "—"} />
            <Row label="Category"     value={merchant.business_category || "—"} />
            <Row label="Registered"   value={new Date(merchant.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })} />
            {merchant.suspended_reason && <Row label="Suspension Reason" value={merchant.suspended_reason} highlight />}
          </div>

          {/* Live storefront link */}
          {merchant.subdomain && merchant.storefront_published && (
            <a href={`https://${merchant.subdomain}.bazarhq.com`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 hover:underline">
              <ExternalLink className="h-4 w-4" /> View Live Storefront
            </a>
          )}
        </div>

        {/* Actions */}
        {status !== "deleted" && (
          <div className="p-5 border-t border-gray-800 space-y-2">
            {status === "active" ? (
              <Button
                className="w-full bg-red-700 hover:bg-red-600 text-white gap-2"
                disabled={actionLoading}
                onClick={() => onSuspend(merchant)}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                Suspend Account
              </Button>
            ) : (
              <Button
                className="w-full bg-emerald-700 hover:bg-emerald-600 text-white gap-2"
                disabled={actionLoading}
                onClick={() => onReinstate(merchant)}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Reinstate Account
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-700 gap-2"
              disabled={actionLoading}
              onClick={() => onDelete(merchant)}
            >
              <Trash2 className="h-4 w-4" /> Delete Permanently
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-right ${highlight ? "text-red-400" : "text-gray-200"}`}>{value}</span>
    </div>
  );
}

// ── Suspend Modal ──────────────────────────────────────────────────────────────
function SuspendModal({ merchant, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Suspend Account</h3>
        <p className="text-sm text-gray-400">
          You are about to suspend <strong className="text-white">{merchant?.shop_name}</strong>.
          Their shop will be unpublished and all sessions terminated immediately.
        </p>
        <div>
          <Label className="text-gray-300 text-sm">Suspension Reason <span className="text-red-400">*</span></Label>
          <textarea
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
            rows={3}
            placeholder="e.g. Policy violation — fraudulent products reported"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-700 hover:bg-red-600 text-white"
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm(reason)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Suspension"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({ merchant, onConfirm, onClose, loading }) {
  const [phrase, setPhrase] = useState("");
  const CONFIRM = "DELETE";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-900 border border-red-900 rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="h-5 w-5" />
          <h3 className="text-lg font-bold">Permanently Delete Account</h3>
        </div>
        <p className="text-sm text-gray-400">
          This will permanently delete <strong className="text-white">{merchant?.shop_name}</strong>,
          all their products, and customization data. Order records are retained for compliance.
          <br /><br />
          <strong className="text-red-400">This action cannot be undone.</strong>
        </p>
        <div>
          <Label className="text-gray-300 text-sm">Type <strong>{CONFIRM}</strong> to proceed</Label>
          <Input
            className="mt-1 bg-gray-800 border-gray-700 text-white"
            placeholder={CONFIRM}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value.toUpperCase())}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-700 hover:bg-red-600 text-white"
            disabled={phrase !== CONFIRM || loading}
            onClick={onConfirm}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Permanently"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MerchantsPage() {
  const { writeAuditLog } = useAdminAuth();
  const [merchants,  setMerchants]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [q,          setQ]          = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page,       setPage]       = useState(1);
  const PER_PAGE = 50;

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("stores")
      .select("id, shop_name, subdomain, business_category, storefront_published, account_status, suspended_reason, created_at, owner_id")
      .order("created_at", { ascending: false });
    setMerchants(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Filter
  const filtered = useMemo(() => {
    let list = [...merchants];
    if (q.trim()) {
      const lq = q.toLowerCase();
      list = list.filter(m =>
        m.shop_name?.toLowerCase().includes(lq) ||
        m.subdomain?.toLowerCase().includes(lq) ||
        m.owner_id?.toLowerCase().includes(lq)
      );
    }
    if (statusFilter !== "all") list = list.filter(m => (m.account_status || "active") === statusFilter);
    return list;
  }, [merchants, q, statusFilter]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  // Suspend
  async function handleSuspend(reason) {
    if (!suspendTarget) return;
    setActionLoading(true);
    const { error } = await supabase.from("stores").update({
      account_status:    "suspended",
      storefront_published: false,
      suspended_reason:  reason,
      suspended_at:      new Date().toISOString(),
    }).eq("id", suspendTarget.id);
    if (!error) {
      await writeAuditLog("merchant.suspend", { reason }, "merchant", suspendTarget.id);
      await load();
      setSuspendTarget(null);
      setSelected(null);
    }
    setActionLoading(false);
  }

  // Reinstate
  async function handleReinstate(merchant) {
    setActionLoading(true);
    const { error } = await supabase.from("stores").update({
      account_status:    "active",
      suspended_reason:  null,
      suspended_at:      null,
    }).eq("id", merchant.id);
    if (!error) {
      await writeAuditLog("merchant.reinstate", {}, "merchant", merchant.id);
      await load();
      setSelected(null);
    }
    setActionLoading(false);
  }

  // Delete
  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    const { error } = await supabase.from("stores").update({
      account_status:       "deleted",
      storefront_published: false,
    }).eq("id", deleteTarget.id);
    if (!error) {
      await writeAuditLog("merchant.delete", {}, "merchant", deleteTarget.id);
      await load();
      setDeleteTarget(null);
      setSelected(null);
    }
    setActionLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Merchant Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">{merchants.length} total merchants</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by shop name or subdomain…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Loading merchants…</div>
        ) : paginated.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No merchants found</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_100px_90px_40px] gap-3 px-5 py-3 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Shop</span>
              <span>Subdomain</span>
              <span>Status</span>
              <span>Registered</span>
              <span />
            </div>
            {/* Rows */}
            {paginated.map((m) => {
              const status = m.account_status || "active";
              return (
                <div
                  key={m.id}
                  className="grid grid-cols-[1fr_1fr_100px_90px_40px] gap-3 px-5 py-3.5 border-b border-gray-800 hover:bg-gray-800/50 transition-colors items-center cursor-pointer"
                  onClick={() => setSelected(m)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.shop_name || "—"}</p>
                    <p className="text-xs text-gray-500 truncate">{m.business_category || "—"}</p>
                  </div>
                  <p className="text-sm text-gray-400 truncate">{m.subdomain || "—"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium w-fit ${STATUS_STYLES[status]}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                  <p className="text-xs text-gray-500">
                    {new Date(m.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                  </p>
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <p>Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
              className="px-3 py-1 border border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-500">
              Prev
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p+1)}
              className="px-3 py-1 border border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-500">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <MerchantDetail
          merchant={selected}
          onClose={() => setSelected(null)}
          onSuspend={(m)   => setSuspendTarget(m)}
          onReinstate={(m) => handleReinstate(m)}
          onDelete={(m)    => setDeleteTarget(m)}
          actionLoading={actionLoading}
        />
      )}

      {/* Suspend Modal */}
      {suspendTarget && (
        <SuspendModal
          merchant={suspendTarget}
          onConfirm={handleSuspend}
          onClose={() => setSuspendTarget(null)}
          loading={actionLoading}
        />
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <DeleteModal
          merchant={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
