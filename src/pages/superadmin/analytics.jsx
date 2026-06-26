// src/pages/superadmin/analytics.jsx
// A3 SRS: Merchant analytics, order/revenue by status & payment method, CSV export
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const PAY_COLORS   = { bkash:"#e2136e", nagad:"#f7941d", rocket:"#8b3fc8", cod:"#10b981", ssl:"#3b82f6" };
const STATUS_COLORS = { pending:"#f59e0b", confirmed:"#3b82f6", shipped:"#8b5cf6", delivered:"#10b981", cancelled:"#ef4444" };

function Section({ title, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period,  setPeriod]  = useState("30");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const days      = parseInt(period, 10);
    const since     = new Date(Date.now() - days * 86400000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // All orders in period
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, status, payment_method, created_at, store_id")
      .gte("created_at", since);

    // Top merchants by revenue
    const revenueMap = {};
    (orders || []).filter(o => o.status !== "cancelled").forEach(o => {
      revenueMap[o.store_id] = (revenueMap[o.store_id] || 0) + Number(o.total || 0);
    });
    const topStoreIds = Object.entries(revenueMap).sort((a,b) => b[1]-a[1]).slice(0,10).map(e => e[0]);
    const { data: topStores } = await supabase
      .from("stores")
      .select("id, shop_name, subdomain")
      .in("id", topStoreIds);

    const topMerchants = (topStores || []).map(s => ({
      name:    s.shop_name || s.subdomain || s.id.slice(0,8),
      revenue: Math.round(revenueMap[s.id] || 0),
    })).sort((a,b) => b.revenue - a.revenue);

    // Orders by status
    const statusMap = {};
    (orders || []).forEach(o => { statusMap[o.status] = (statusMap[o.status]||0) + 1; });
    const ordersByStatus = Object.entries(statusMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: STATUS_COLORS[name] || "#6b7280",
    }));

    // Revenue by payment method
    const payMap = {};
    (orders || []).filter(o => o.status !== "cancelled").forEach(o => {
      const m = o.payment_method || "other";
      payMap[m] = (payMap[m] || 0) + Number(o.total || 0);
    });
    const revenueByPayment = Object.entries(payMap).map(([name, value]) => ({
      name: name.toUpperCase(),
      value: Math.round(value),
      color: PAY_COLORS[name] || "#6b7280",
    }));

    // New merchants in period
    const { count: newMerchants } = await supabase
      .from("stores")
      .select("id", { count:"exact", head:true })
      .gte("created_at", since);

    // Merchants with published shops
    const { count: published } = await supabase
      .from("stores")
      .select("id", { count:"exact", head:true })
      .eq("storefront_published", true);

    // Onboarding incomplete (no published shop)
    const { count: total } = await supabase.from("stores").select("id", { count:"exact", head:true });
    const incomplete = (total || 0) - (published || 0);

    setData({
      orders:         orders || [],
      topMerchants,
      ordersByStatus,
      revenueByPayment,
      newMerchants:   newMerchants || 0,
      published:      published    || 0,
      incomplete,
      total:          total        || 0,
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, [period]);

  // CSV export
  function exportCSV() {
    if (!data?.orders?.length) return;
    const headers = ["Order ID","Store ID","Status","Payment","Total","Date"];
    const rows = data.orders.map(o => [
      o.id, o.store_id, o.status, o.payment_method,
      o.total, new Date(o.created_at).toLocaleDateString("en-GB"),
    ]);
    const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `bazarhq-analytics-${period}d.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const totalRevenue = useMemo(() =>
    (data?.orders || []).filter(o => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total || 0), 0),
  [data]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Read-only aggregated data</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300 hover:text-white gap-2"
            onClick={exportCSV}
            disabled={loading}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <div key={i} className="h-28 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label:"Total Orders",    value: data.orders.length.toLocaleString() },
              { label:"Platform Revenue",value: `৳${Math.round(totalRevenue).toLocaleString()}` },
              { label:"New Merchants",   value: data.newMerchants.toLocaleString() },
              { label:"Published Shops", value: data.published.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Merchant stats */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label:"Total Merchants",            value: data.total },
              { label:"Published Storefronts",      value: data.published },
              { label:"Onboarding Incomplete",      value: data.incomplete },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="text-xl font-bold text-white">{value}</span>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid lg:grid-cols-2 gap-5">

            {/* Orders by status */}
            <Section title="Orders by Status">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data.ordersByStatus} cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {data.ordersByStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor:"#111827", border:"1px solid #374151", borderRadius:"8px", color:"#f3f4f6" }}
                    formatter={(v, n) => [v.toLocaleString(), n]}
                  />
                  <Legend iconType="circle" iconSize={8}
                    formatter={(v) => <span style={{ color:"#9ca3af", fontSize:12 }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Section>

            {/* Revenue by payment method */}
            <Section title="Revenue by Payment Method">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.revenueByPayment} margin={{ top:0, right:0, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="name" tick={{ fill:"#6b7280", fontSize:11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill:"#6b7280", fontSize:11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `৳${(v/1000).toFixed(0)}K` : `৳${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor:"#111827", border:"1px solid #374151", borderRadius:"8px", color:"#f3f4f6" }}
                    formatter={(v) => [`৳${v.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {data.revenueByPayment.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Top 10 Merchants */}
          <Section title="Top 10 Merchants by Revenue">
            {data.topMerchants.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No order data for this period.</p>
            ) : (
              <div className="space-y-2">
                {data.topMerchants.map((m, i) => {
                  const maxRev = data.topMerchants[0]?.revenue || 1;
                  const pct    = Math.round((m.revenue / maxRev) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-5 text-right shrink-0">#{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-200 truncate">{m.name}</span>
                          <span className="text-sm font-semibold text-white shrink-0 ml-2">
                            ৳{m.revenue.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-600 rounded-full transition-all" style={{ width:`${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
