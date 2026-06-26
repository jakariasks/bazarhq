// src/pages/superadmin/dashboard.jsx
// A3 SRS: Platform overview — total merchants, active shops, orders today/month, revenue
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import {
  Users, ShoppingBag, TrendingUp, Store,
  ArrowUpRight, ArrowDownRight, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function StatCard({ label, value, sub, icon: Icon, color, change }) {
  const up = change > 0;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-400">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      {change != null && (
        <p className={`text-xs flex items-center gap-1 mt-1 font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(change)}% vs last month
        </p>
      )}
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { writeAuditLog } = useAdminAuth();
  const [stats,   setStats]   = useState(null);
  const [regGraph, setRegGraph] = useState([]);
  const [ordGraph, setOrdGraph] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load() {
    setLoading(true);
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Total merchants
    const { count: totalMerchants } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true });

    // Active shops
    const { count: activeShops } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("storefront_published", true);

    // Orders today
    const { count: ordersToday } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today.toISOString());

    // Orders this month
    const { count: ordersMonth } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString());

    // Revenue this month
    const { data: revenueData } = await supabase
      .from("orders")
      .select("total")
      .gte("created_at", monthStart.toISOString())
      .neq("status", "cancelled");
    const revenueMonth = (revenueData || []).reduce((s, o) => s + Number(o.total || 0), 0);

    // Revenue last month (for change %)
    const { data: lastRevData } = await supabase
      .from("orders")
      .select("total")
      .gte("created_at", lastMonthStart.toISOString())
      .lt("created_at", monthStart.toISOString())
      .neq("status", "cancelled");
    const revenueLast = (lastRevData || []).reduce((s, o) => s + Number(o.total || 0), 0);
    const revenueChange = revenueLast
      ? Math.round(((revenueMonth - revenueLast) / revenueLast) * 100)
      : null;

    setStats({ totalMerchants, activeShops, ordersToday, ordersMonth, revenueMonth, revenueChange });

    // 30-day merchant registration graph
    const { data: regData } = await supabase
      .from("stores")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

    const regMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      regMap[key] = { date: key, merchants: 0 };
    }
    (regData || []).forEach((r) => {
      const key = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (regMap[key]) regMap[key].merchants++;
    });
    setRegGraph(Object.values(regMap));

    // 30-day order volume graph
    const { data: ordData } = await supabase
      .from("orders")
      .select("created_at, total")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

    const ordMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      ordMap[key] = { date: key, orders: 0, revenue: 0 };
    }
    (ordData || []).forEach((o) => {
      const key = new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (ordMap[key]) { ordMap[key].orders++; ordMap[key].revenue += Number(o.total || 0); }
    });
    setOrdGraph(Object.values(ordMap));

    setLastUpdated(new Date());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const fmt = (n) => n >= 1000000
    ? `৳${(n / 1000000).toFixed(1)}M`
    : n >= 1000 ? `৳${(n / 1000).toFixed(1)}K`
    : `৳${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Overview</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-0.5">
              Last updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Merchants"  value={stats.totalMerchants?.toLocaleString() || "0"} sub="All time"            icon={Users}       color="bg-violet-600" />
          <StatCard label="Active Shops"     value={stats.activeShops?.toLocaleString()    || "0"} sub="Published storefronts" icon={Store}       color="bg-blue-600"   />
          <StatCard label="Orders Today"     value={stats.ordersToday?.toLocaleString()    || "0"} sub={`${stats.ordersMonth?.toLocaleString()} this month`} icon={ShoppingBag} color="bg-emerald-600" />
          <StatCard label="Revenue / Month"  value={fmt(stats.revenueMonth || 0)}                  sub="This month"           icon={TrendingUp}  color="bg-amber-600"  change={stats.revenueChange} />
        </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Merchant registrations */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">New Merchant Registrations — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={regGraph} margin={{ top:0, right:10, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill:"#6b7280", fontSize:10 }} tickLine={false} axisLine={false}
                interval={6} />
              <YAxis tick={{ fill:"#6b7280", fontSize:10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor:"#111827", border:"1px solid #374151", borderRadius:"8px", color:"#f3f4f6" }} />
              <Bar dataKey="merchants" fill="#7c3aed" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Order volume */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Platform Order Volume — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ordGraph} margin={{ top:0, right:10, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill:"#6b7280", fontSize:10 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fill:"#6b7280", fontSize:10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor:"#111827", border:"1px solid #374151", borderRadius:"8px", color:"#f3f4f6" }} />
              <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r:4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
