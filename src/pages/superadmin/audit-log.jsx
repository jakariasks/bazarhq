// src/pages/superadmin/audit-log.jsx
// A3 SRS: Immutable audit log — search, filter by action/admin/date, read-only
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input }    from "@/components/ui/input";
import {
  ShieldAlert, Search, ChevronDown, ChevronUp,
  RefreshCw, Filter,
} from "lucide-react";

const ACTION_COLORS = {
  "login.success":        "text-emerald-400 bg-emerald-900/20 border-emerald-900",
  "login.lockout":        "text-red-400    bg-red-900/20    border-red-900",
  "logout":               "text-gray-400   bg-gray-800      border-gray-700",
  "merchant.suspend":     "text-red-400    bg-red-900/20    border-red-900",
  "merchant.reinstate":   "text-emerald-400 bg-emerald-900/20 border-emerald-900",
  "merchant.delete":      "text-red-500    bg-red-950/30    border-red-900",
  "announcement.send":    "text-blue-400   bg-blue-900/20   border-blue-900",
  "announcement.cancel":  "text-amber-400  bg-amber-900/20  border-amber-900",
  "content.submit_for_approval": "text-amber-400 bg-amber-900/20 border-amber-900",
  "content.approve":      "text-emerald-400 bg-emerald-900/20 border-emerald-900",
  "theme.activate":       "text-violet-400 bg-violet-900/20 border-violet-900",
  "theme.deactivate":     "text-gray-400   bg-gray-800      border-gray-700",
  "theme.set_default":    "text-violet-400 bg-violet-900/20 border-violet-900",
};

const ACTION_LABELS = {
  "login.success":              "Login Success",
  "login.lockout":              "Account Locked",
  "logout":                     "Logout",
  "merchant.suspend":           "Merchant Suspended",
  "merchant.reinstate":         "Merchant Reinstated",
  "merchant.delete":            "Merchant Deleted",
  "announcement.send":          "Announcement Sent",
  "announcement.cancel":        "Announcement Cancelled",
  "content.submit_for_approval":"Content Submitted",
  "content.approve":            "Content Approved",
  "content.discard_pending":    "Pending Content Discarded",
  "theme.activate":             "Theme Activated",
  "theme.deactivate":           "Theme Deactivated",
  "theme.set_default":          "Default Theme Set",
};

function fmt(d) {
  return new Date(d).toLocaleString("en-GB", {
    day:"numeric", month:"short", year:"numeric",
    hour:"2-digit", minute:"2-digit", second:"2-digit",
  });
}

function LogRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = ACTION_COLORS[entry.action] || "text-gray-400 bg-gray-800 border-gray-700";
  const label      = ACTION_LABELS[entry.action] || entry.action;
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  return (
    <div className="border-b border-gray-800 last:border-0">
      <div
        className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/40 transition-colors ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={() => hasDetails && setExpanded(v => !v)}
      >
        {/* Action badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${colorClass}`}>
          {label}
        </span>

        {/* Admin */}
        <span className="text-sm text-gray-300 truncate hidden sm:block min-w-0 flex-1">
          {entry.admin_email || "—"}
        </span>

        {/* Target */}
        {entry.target_id && (
          <span className="text-xs text-gray-600 font-mono truncate hidden lg:block max-w-[120px]">
            {entry.target_id.slice(0, 12)}…
          </span>
        )}

        {/* IP */}
        <span className="text-xs text-gray-600 font-mono shrink-0 hidden md:block">
          {entry.ip_address || "—"}
        </span>

        {/* Time */}
        <span className="text-xs text-gray-500 shrink-0">
          {fmt(entry.created_at)}
        </span>

        {hasDetails && (
          <span className="text-gray-600 shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="px-5 pb-3">
          <pre className="text-xs text-gray-400 bg-gray-800 rounded-lg p-3 overflow-x-auto border border-gray-700">
            {JSON.stringify(entry.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page,    setPage]    = useState(1);
  const PER_PAGE = 50;

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Unique actions for filter dropdown
  const uniqueActions = useMemo(() => {
    const acts = [...new Set(logs.map(l => l.action))].sort();
    return acts;
  }, [logs]);

  // Filter
  const filtered = useMemo(() => {
    let list = [...logs];
    if (q.trim()) {
      const lq = q.toLowerCase();
      list = list.filter(l =>
        l.admin_email?.toLowerCase().includes(lq) ||
        l.action?.toLowerCase().includes(lq) ||
        l.target_id?.toLowerCase().includes(lq) ||
        l.ip_address?.includes(lq)
      );
    }
    if (actionFilter !== "all") list = list.filter(l => l.action === actionFilter);
    return list;
  }, [logs, q, actionFilter]);

  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Audit Log</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Immutable record of all admin actions · Read-only
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by email, action, IP…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value="all">All Actions</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span>{logs.length} total entries</span>
        {filtered.length !== logs.length && <span>{filtered.length} matching</span>}
      </div>

      {/* Log table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[180px_1fr_100px_120px_20px] gap-3 px-5 py-3 border-b border-gray-800 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden sm:grid">
          <span>Action</span>
          <span>Admin</span>
          <span className="hidden md:block">IP</span>
          <span>Timestamp</span>
          <span />
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 text-sm">Loading audit log…</div>
        ) : paginated.length === 0 ? (
          <div className="py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No log entries found</p>
          </div>
        ) : (
          paginated.map(entry => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <p>
            Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p-1)}
              className="px-3 py-1 border border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-500 transition-colors"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p+1)}
              className="px-3 py-1 border border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-500 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-700 text-center">
        Audit log entries are immutable — no modification or deletion is possible.
        Retained for minimum 2 years per SRS A3 requirements.
      </div>
    </div>
  );
}
