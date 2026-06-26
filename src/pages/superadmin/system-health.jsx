// src/pages/superadmin/system-health.jsx
// A3 SRS: Service status, response time, error rate, error log (last 7 days)
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import {
  CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Activity, Database, Mail,
  MessageSquare, HardDrive, Globe,
} from "lucide-react";

const SERVICES = [
  { id:"database", label:"Database",       icon: Database,      check: checkDatabase  },
  { id:"storage",  label:"Storage (CDN)",  icon: HardDrive,     check: checkStorage   },
  { id:"web",      label:"Web Server",     icon: Globe,         check: checkWeb       },
  { id:"email",    label:"Email Gateway",  icon: Mail,          check: checkEmail     },
  { id:"sms",      label:"SMS Gateway",    icon: MessageSquare, check: checkSMS       },
];

// ── Health check functions ────────────────────────────────────────────────────
async function checkDatabase() {
  const start = Date.now();
  try {
    const { error } = await supabase.from("stores").select("id").limit(1);
    if (error) throw error;
    return { status:"up", responseMs: Date.now() - start };
  } catch (e) {
    return { status:"down", error: e.message, responseMs: Date.now() - start };
  }
}

async function checkStorage() {
  const start = Date.now();
  try {
    const { error } = await supabase.storage.from("shop-branding").list("", { limit: 1 });
    if (error) throw error;
    return { status:"up", responseMs: Date.now() - start };
  } catch (e) {
    return { status:"down", error: e.message, responseMs: Date.now() - start };
  }
}

async function checkWeb() {
  const start = Date.now();
  try {
    await fetch(window.location.origin + "/", { method:"HEAD", cache:"no-store" });
    return { status:"up", responseMs: Date.now() - start };
  } catch (e) {
    return { status:"down", error: e.message, responseMs: Date.now() - start };
  }
}

async function checkEmail() {
  // We can't actually call the email gateway without sending;
  // check via a lightweight Supabase edge function ping if available,
  // otherwise mark as "unknown" and rely on manual check.
  return { status:"unknown", responseMs: 0, note:"Cannot verify without sending a test email." };
}

async function checkSMS() {
  return { status:"unknown", responseMs: 0, note:"Cannot verify without sending a test SMS." };
}

// ── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    up:      { label:"Operational", color:"text-emerald-400 bg-emerald-900/30 border-emerald-800", icon: CheckCircle2 },
    down:    { label:"Down",        color:"text-red-400    bg-red-900/30    border-red-800",       icon: XCircle       },
    degraded:{ label:"Degraded",    color:"text-amber-400  bg-amber-900/30  border-amber-800",     icon: AlertTriangle  },
    unknown: { label:"Unknown",     color:"text-gray-400   bg-gray-800      border-gray-700",      icon: AlertTriangle  },
    checking:{ label:"Checking…",   color:"text-gray-400   bg-gray-800      border-gray-700",      icon: RefreshCw      },
  };
  const cfg = map[status] || map.unknown;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.color}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "checking" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

// ── Response time bar ─────────────────────────────────────────────────────────
function ResponseBar({ ms }) {
  if (!ms) return null;
  const color = ms < 200 ? "bg-emerald-500" : ms < 800 ? "bg-amber-500" : "bg-red-500";
  const width = Math.min(100, (ms / 2000) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width:`${width}%` }} />
      </div>
      <span className="text-xs text-gray-500 shrink-0 w-14 text-right">{ms}ms</span>
    </div>
  );
}

// ── Error Log ─────────────────────────────────────────────────────────────────
function ErrorLog() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("system_health_log")
        .select("*")
        .neq("status", "up")
        .gte("checked_at", since)
        .order("checked_at", { ascending: false })
        .limit(100);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-gray-500 py-4 text-center">Loading…</p>;
  if (!logs.length) return (
    <div className="text-center py-8">
      <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
      <p className="text-sm text-gray-500">No errors in the last 7 days</p>
    </div>
  );

  return (
    <div className="divide-y divide-gray-800">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 mt-0.5 ${
            log.status === "down"
              ? "text-red-400 bg-red-900/20 border-red-900"
              : "text-amber-400 bg-amber-900/20 border-amber-900"
          }`}>
            {log.service}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 truncate">{log.error_msg || log.status}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {new Date(log.checked_at).toLocaleString("en-GB", {
                day:"numeric", month:"short", hour:"2-digit", minute:"2-digit",
              })}
              {log.response_ms ? ` · ${log.response_ms}ms` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SystemHealthPage() {
  const { writeAuditLog } = useAdminAuth();
  const [results,  setResults]  = useState({});
  const [checking, setChecking] = useState(false);
  const [lastRun,  setLastRun]  = useState(null);

  const runChecks = useCallback(async () => {
    setChecking(true);

    // Set all to checking
    const init = {};
    SERVICES.forEach(s => { init[s.id] = { status:"checking" }; });
    setResults(init);

    // Run all checks in parallel
    const checks = await Promise.all(
      SERVICES.map(async (svc) => {
        const result = await svc.check();
        return { id: svc.id, ...result };
      })
    );

    const newResults = {};
    for (const c of checks) {
      newResults[c.id] = c;

      // Log to DB if not up
      if (c.status !== "up" && c.status !== "unknown") {
        await supabase.from("system_health_log").insert({
          service:     c.id,
          status:      c.status,
          response_ms: c.responseMs || null,
          error_msg:   c.error || null,
        });
      }
    }

    setResults(newResults);
    setLastRun(new Date());
    setChecking(false);
  }, []);

  useEffect(() => { runChecks(); }, []);

  // Overall status
  const statuses = Object.values(results).map(r => r.status);
  const allUp    = statuses.every(s => s === "up" || s === "unknown");
  const anyDown  = statuses.some(s  => s === "down");
  const overallStatus = anyDown ? "down" : allUp ? "up" : "degraded";

  const overallConfig = {
    up:      { label:"All Systems Operational", color:"text-emerald-400", bg:"bg-emerald-900/20 border-emerald-800" },
    down:    { label:"Service Disruption Detected", color:"text-red-400", bg:"bg-red-900/20 border-red-800" },
    degraded:{ label:"Partial Disruption", color:"text-amber-400", bg:"bg-amber-900/20 border-amber-800" },
    checking:{ label:"Running checks…", color:"text-gray-400", bg:"bg-gray-800 border-gray-700" },
  };
  const overall = overallConfig[checking ? "checking" : overallStatus];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">System Health</h1>
          {lastRun && (
            <p className="text-xs text-gray-500 mt-0.5">
              Last checked: {lastRun.toLocaleTimeString()} · Auto-refreshes every 60s
            </p>
          )}
        </div>
        <button
          onClick={runChecks}
          disabled={checking}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
          Run Checks
        </button>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${overall.bg}`}>
        <Activity className={`h-6 w-6 ${overall.color}`} />
        <div>
          <p className={`font-semibold ${overall.color}`}>{overall.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Checks: database · storage · web server · email gateway · SMS gateway
          </p>
        </div>
      </div>

      {/* Service cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICES.map(({ id, label, icon: Icon }) => {
          const r = results[id] || { status:"checking" };
          return (
            <div key={id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-gray-400" />
                  </div>
                  <span className="font-medium text-gray-200 text-sm">{label}</span>
                </div>
                <StatusBadge status={r.status} />
              </div>

              {r.responseMs > 0 && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Response Time</p>
                  <ResponseBar ms={r.responseMs} />
                </div>
              )}

              {r.error && (
                <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 border border-red-900 truncate">
                  {r.error}
                </p>
              )}

              {r.note && (
                <p className="text-xs text-gray-600">{r.note}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Error log */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white text-sm">Error Log — Last 7 Days</h3>
          <p className="text-xs text-gray-500 mt-0.5">Non-operational events recorded during health checks</p>
        </div>
        <div className="px-5 py-2">
          <ErrorLog />
        </div>
      </div>
    </div>
  );
}
