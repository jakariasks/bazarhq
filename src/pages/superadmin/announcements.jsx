// src/pages/superadmin/announcements.jsx
// A4 SRS: Compose, schedule, send broadcast announcements to all merchants
import { useEffect, useState } from "react";
import { supabase }     from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import {
  Megaphone, Plus, Send, Clock, CheckCircle2,
  XCircle, Trash2, AlertCircle, Loader2, X,
} from "lucide-react";

const STATUS_STYLES = {
  draft:     "bg-gray-800 text-gray-400 border-gray-700",
  scheduled: "bg-amber-900/30 text-amber-400 border-amber-800",
  sent:      "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  cancelled: "bg-gray-800 text-gray-600 border-gray-700",
};
const STATUS_ICONS = {
  draft:     Clock,
  scheduled: Clock,
  sent:      CheckCircle2,
  cancelled: XCircle,
};

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit",
  });
}

// ── Compose Modal ──────────────────────────────────────────────────────────────
function ComposeModal({ onClose, onSent, adminId }) {
  const [title,     setTitle]     = useState("");
  const [body,      setBody]      = useState("");
  const [schedule,  setSchedule]  = useState(false);
  const [sendAt,    setSendAt]    = useState("");
  const [step,      setStep]      = useState("compose"); // compose | confirm
  const [recipientCount, setRecipientCount] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  async function loadRecipientCount() {
    const { count } = await supabase
      .from("stores")
      .select("id", { count:"exact", head:true })
      .neq("account_status", "deleted");
    setRecipientCount(count || 0);
  }

  async function handlePreview(e) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    if (!body.trim())  { setError("Message body is required."); return; }
    if (schedule && !sendAt) { setError("Please set a scheduled time."); return; }
    await loadRecipientCount();
    setStep("confirm");
  }

  async function handleSend() {
    setLoading(true);
    setError("");
    try {
      const payload = {
        title:           title.trim(),
        body:            body.trim(),
        created_by:      adminId,
        status:          schedule ? "scheduled" : "sent",
        scheduled_at:    schedule ? new Date(sendAt).toISOString() : null,
        sent_at:         schedule ? null : new Date().toISOString(),
        recipient_count: recipientCount,
      };
      const { error: err } = await supabase.from("platform_announcements").insert(payload);
      if (err) throw err;
      onSent();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-bold text-white">
            {step === "compose" ? "New Announcement" : "Confirm & Send"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {step === "compose" ? (
            <form onSubmit={handlePreview} className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm">Title *</Label>
                <Input
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                  placeholder="e.g. Platform Maintenance Notice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
                <p className="text-xs text-gray-600 mt-1 text-right">{title.length}/120</p>
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Message *</Label>
                <textarea
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
                  rows={5}
                  placeholder="Write your announcement here…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                />
                <p className="text-xs text-gray-600 mt-1 text-right">{body.length}/2000</p>
              </div>

              {/* Schedule toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="schedule"
                  checked={schedule}
                  onChange={(e) => setSchedule(e.target.checked)}
                  className="w-4 h-4 accent-violet-600"
                />
                <Label htmlFor="schedule" className="text-gray-300 text-sm cursor-pointer">
                  Schedule for later
                </Label>
              </div>

              {schedule && (
                <div>
                  <Label className="text-gray-300 text-sm">Send At *</Label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                    value={sendAt}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setSendAt(e.target.value)}
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-violet-600 hover:bg-violet-500 text-white" type="submit">
                  Preview →
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                <p className="font-semibold text-white">{title}</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{body}</p>
              </div>

              {/* Recipient info */}
              <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-300">
                  <p className="font-semibold mb-1">Ready to send to {recipientCount} merchant(s)</p>
                  {schedule
                    ? <p>Scheduled for: <strong>{fmt(sendAt)}</strong></p>
                    : <p>This announcement will be sent <strong>immediately</strong> and <strong>cannot be recalled</strong>.</p>
                  }
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-gray-700 text-gray-300"
                  onClick={() => setStep("compose")} disabled={loading}>
                  ← Edit
                </Button>
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white gap-2"
                  onClick={handleSend}
                  disabled={loading}
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : schedule ? <><Clock className="h-4 w-4" /> Schedule</> : <><Send className="h-4 w-4" /> Send Now</>
                  }
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const { admin, writeAuditLog, isFullAccess } = useAdminAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [composing,     setComposing]     = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("platform_announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setAnnouncements(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id) {
    if (!window.confirm("Cancel this scheduled announcement?")) return;
    await supabase.from("platform_announcements").update({ status:"cancelled" }).eq("id", id);
    await writeAuditLog("announcement.cancel", {}, "announcement", id);
    await load();
  }

  async function handleSent() {
    await writeAuditLog("announcement.send", {}, "announcement", null);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Announcements</h1>
          <p className="text-sm text-gray-400 mt-0.5">Broadcast messages to all registered merchants</p>
        </div>
        {isFullAccess && (
          <Button
            className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
            onClick={() => setComposing(true)}
          >
            <Plus className="h-4 w-4" /> New Announcement
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-24 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Megaphone className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const Icon = STATUS_ICONS[ann.status] || Clock;
            return (
              <div key={ann.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium inline-flex items-center gap-1 ${STATUS_STYLES[ann.status]}`}>
                        <Icon className="h-3 w-3" />
                        {ann.status.charAt(0).toUpperCase() + ann.status.slice(1)}
                      </span>
                      {ann.recipient_count > 0 && (
                        <span className="text-xs text-gray-500">{ann.recipient_count} recipients</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white truncate">{ann.title}</h3>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{ann.body}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-600">
                      <span>Created: {fmt(ann.created_at)}</span>
                      {ann.scheduled_at && <span>Scheduled: {fmt(ann.scheduled_at)}</span>}
                      {ann.sent_at      && <span>Sent: {fmt(ann.sent_at)}</span>}
                    </div>
                  </div>
                  {isFullAccess && ann.status === "scheduled" && (
                    <button
                      onClick={() => handleCancel(ann.id)}
                      className="shrink-0 p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Cancel scheduled announcement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {composing && (
        <ComposeModal
          onClose={() => setComposing(false)}
          onSent={handleSent}
          adminId={admin?.id}
        />
      )}
    </div>
  );
}
