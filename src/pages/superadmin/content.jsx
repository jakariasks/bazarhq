// src/pages/superadmin/content.jsx
// A4 SRS: Update ToS, Privacy Policy, FAQ — dual admin approval required
import { useEffect, useState } from "react";
import { supabase }     from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Shield, HelpCircle, CheckCircle2, Clock, AlertCircle, Save } from "lucide-react";

const CONTENT_TYPES = [
  { id:"terms_of_service", label:"Terms of Service", icon: FileText  },
  { id:"privacy_policy",   label:"Privacy Policy",   icon: Shield    },
  { id:"faq",              label:"FAQ",               icon: HelpCircle },
];

function ContentEditor({ contentType, isFullAccess }) {
  const { admin, writeAuditLog } = useAdminAuth();
  const [record,   setRecord]   = useState(null);
  const [draft,    setDraft]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [approving,setApproving]= useState(false);
  const [msg,      setMsg]      = useState({ type:"", text:"" });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("platform_content")
      .select("*")
      .eq("content_type", contentType)
      .single();
    setRecord(data);
    setDraft(data?.body || "");
    setLoading(false);
  }

  useEffect(() => { load(); }, [contentType]);

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type:"", text:"" }), 4000);
  }

  // Submit pending update (requires second admin to approve)
  async function handleSubmit() {
    if (!record) return;
    setSaving(true);
    const { error } = await supabase
      .from("platform_content")
      .update({
        pending_body: draft,
        pending_by:   admin?.id,
      })
      .eq("content_type", contentType);
    if (error) { flash("error", error.message); }
    else {
      await writeAuditLog("content.submit_for_approval", { contentType }, "content", contentType);
      flash("success", "Submitted for second-admin approval. Changes will go live once approved.");
      await load();
    }
    setSaving(false);
  }

  // Second admin approves
  async function handleApprove() {
    if (!record?.pending_body) return;
    if (record.pending_by === admin?.id) {
      flash("error", "You cannot approve your own submission. A different admin must approve.");
      return;
    }
    setApproving(true);
    const { error } = await supabase
      .from("platform_content")
      .update({
        body:        record.pending_body,
        pending_body: null,
        pending_by:   null,
        approved_by:  admin?.id,
        version:      (record.version || 1) + 1,
        updated_at:   new Date().toISOString(),
      })
      .eq("content_type", contentType);
    if (error) { flash("error", error.message); }
    else {
      await writeAuditLog("content.approve", { contentType }, "content", contentType);
      flash("success", "Content approved and published successfully.");
      await load();
    }
    setApproving(false);
  }

  // Discard pending
  async function handleDiscard() {
    await supabase.from("platform_content").update({ pending_body: null, pending_by: null }).eq("content_type", contentType);
    await writeAuditLog("content.discard_pending", { contentType }, "content", contentType);
    flash("success", "Pending changes discarded.");
    await load();
  }

  if (loading) return <div className="py-12 text-center text-gray-500 text-sm animate-pulse">Loading…</div>;

  const hasPending = !!record?.pending_body;
  const canApprove = hasPending && record.pending_by !== admin?.id;
  const isMyPending = hasPending && record.pending_by === admin?.id;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {hasPending && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${canApprove ? "bg-amber-900/20 border-amber-800" : "bg-blue-900/20 border-blue-800"}`}>
          {canApprove
            ? <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            : <Clock className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          }
          <div className="flex-1">
            <p className={`text-sm font-semibold ${canApprove ? "text-amber-300" : "text-blue-300"}`}>
              {canApprove
                ? "Pending Approval — Changes submitted by another admin"
                : "Pending Approval — Awaiting a second admin to approve"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Pending changes are shown below. Current live content is preserved until approved.
            </p>
            {canApprove && isFullAccess && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white gap-1.5"
                  onClick={handleApprove} disabled={approving}>
                  {approving ? "Approving…" : <><CheckCircle2 className="h-4 w-4" /> Approve & Publish</>}
                </Button>
                <Button size="sm" variant="outline" className="border-gray-700 text-gray-400"
                  onClick={handleDiscard}>
                  Discard
                </Button>
              </div>
            )}
            {isMyPending && (
              <Button size="sm" variant="outline" className="border-gray-700 text-gray-400 mt-2"
                onClick={handleDiscard}>
                Discard My Submission
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Current live content */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">
            Live Content
            {record?.version && <span className="text-gray-600 text-xs ml-2">v{record.version}</span>}
          </label>
          {record?.updated_at && (
            <span className="text-xs text-gray-600">
              Last updated: {new Date(record.updated_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
            </span>
          )}
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-300 min-h-[100px] max-h-40 overflow-y-auto whitespace-pre-wrap border border-gray-700">
          {record?.body || <span className="text-gray-600 italic">No content yet.</span>}
        </div>
      </div>

      {/* Pending content preview */}
      {hasPending && (
        <div>
          <label className="text-sm font-medium text-amber-400 mb-2 block">Pending Changes (not yet live)</label>
          <div className="bg-amber-900/10 border border-amber-900 rounded-xl p-4 text-sm text-gray-300 min-h-[100px] max-h-40 overflow-y-auto whitespace-pre-wrap">
            {record.pending_body}
          </div>
        </div>
      )}

      {/* Editor — only show if no pending or it's my pending */}
      {isFullAccess && !hasPending && (
        <>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">New Draft</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
              rows={10}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Write the ${CONTENT_TYPES.find(c=>c.id===contentType)?.label} here…`}
            />
            <p className="text-xs text-gray-600 mt-1">
              Submitting will require approval from a second admin before going live.
            </p>
          </div>

          {msg.text && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${msg.type === "success" ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-red-900/20 border-red-800 text-red-400"}`}>
              {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {msg.text}
            </div>
          )}

          <Button
            className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
            onClick={handleSubmit}
            disabled={saving || draft === record?.body}
          >
            {saving ? "Submitting…" : <><Save className="h-4 w-4" /> Submit for Approval</>}
          </Button>
        </>
      )}

      {msg.text && !isFullAccess && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${msg.type === "success" ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-red-900/20 border-red-800 text-red-400"}`}>
          {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}

export default function ContentPage() {
  const { isFullAccess } = useAdminAuth();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Platform Content</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          All content changes require approval from a second admin before going live.
        </p>
      </div>

      <Tabs defaultValue="terms_of_service">
        <TabsList className="bg-gray-900 border border-gray-800 p-1">
          {CONTENT_TYPES.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="data-[state=active]:bg-violet-700 data-[state=active]:text-white text-gray-400 gap-1.5 text-xs sm:text-sm"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CONTENT_TYPES.map(({ id }) => (
          <TabsContent key={id} value={id} className="mt-5">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <ContentEditor contentType={id} isFullAccess={isFullAccess} />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 flex items-start gap-2">
        <Shield className="h-4 w-4 shrink-0 text-gray-600 mt-0.5" />
        <span>
          Two-admin approval is enforced for all content changes.
          The submitting admin cannot approve their own changes — a different admin must review and approve.
          All actions are recorded in the Audit Log.
        </span>
      </div>
    </div>
  );
}
