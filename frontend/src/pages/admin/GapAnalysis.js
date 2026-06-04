import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Trash2, AlertCircle, CheckCircle, HelpCircle } from "lucide-react";

export default function GapAnalysis() {
  const [data, setData] = useState({ pending: [], added_to_kb: [] });
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [resources, setResources] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [createDialog, setCreateDialog] = useState(null);
  const [tab, setTab] = useState("pending");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/unanswered");
      setData(data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([
      api.get("/knowledge/modules"),
      api.get("/knowledge/topics"),
      api.get("/knowledge/resources"),
    ]).then(([m, t, r]) => {
      setModules(m.data);
      setTopics(t.data);
      setResources(r.data);
    }).catch(() => {});
  }, []);

  const handleAccept = (q) => {
    setCreateDialog(q);
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/admin/unanswered/${id}/reject`);
      load();
      toast.success("Question rejected");
    } catch { toast.error("Failed to reject"); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/unanswered/${id}`);
      load();
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected questions?`)) return;
    try {
      await api.post("/admin/unanswered/bulk-delete", { ids: Array.from(selected) });
      setSelected(new Set());
      load();
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === data.pending.length) setSelected(new Set());
    else setSelected(new Set(data.pending.map((q) => q._id)));
  };

  const saveKnowledgeItem = async (formData, questionId) => {
    try {
      await api.post("/knowledge/items", formData);
      await api.put(`/admin/unanswered/${questionId}/mark-added`);
      setCreateDialog(null);
      load();
      toast.success("Knowledge item created and question marked as resolved");
    } catch { toast.error("Failed to save"); }
  };

  return (
    <div className="space-y-6" data-testid="gap-analysis">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Knowledge Gaps</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Questions Astra couldn't answer from the knowledge base</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
            <AlertCircle className="w-3 h-3 text-[#FF6B00]" /> {data.pending.length} Pending
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
            <CheckCircle className="w-3 h-3 text-[#10B981]" /> {data.added_to_kb.length} Resolved
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#F1F5F9]">
          <TabsTrigger value="pending" className="gap-1.5 data-[state=active]:bg-white">
            <HelpCircle className="w-3.5 h-3.5" /> Pending ({data.pending.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1.5 data-[state=active]:bg-white">
            <CheckCircle className="w-3.5 h-3.5" /> Recently Added to KB ({data.added_to_kb.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="border border-[#E2E8F0] bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Unanswered Questions</CardTitle>
              {selected.size > 0 && (
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleBulkDelete} data-testid="bulk-delete-button">
                  <Trash2 className="w-3.5 h-3.5" /> Delete {selected.size} Selected
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox checked={selected.size === data.pending.length && data.pending.length > 0}
                        onCheckedChange={toggleAll} data-testid="select-all-unanswered" />
                    </TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-[80px]">Asked</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pending.map((q) => (
                    <TableRow key={q._id} data-testid={`unanswered-row-${q._id}`}>
                      <TableCell>
                        <Checkbox checked={selected.has(q._id)} onCheckedChange={() => toggleSelect(q._id)} />
                      </TableCell>
                      <TableCell className="font-medium" style={{ color: '#0A101D' }}>{q.question}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{q.asked_count}x</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleAccept(q)}
                            title="Add to Knowledge Base" data-testid={`accept-unanswered-${q._id}`}>
                            <Check className="w-4 h-4 text-[#10B981]" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleReject(q._id)}
                            title="Reject" data-testid={`reject-unanswered-${q._id}`}>
                            <X className="w-4 h-4 text-[#EF4444]" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDelete(q._id)}
                            title="Delete">
                            <Trash2 className="w-3.5 h-3.5 text-[#64748B]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.pending.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-[#64748B]">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#10B981]" />
                        No unanswered questions! Your knowledge base is doing great.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolved">
          <Card className="border border-[#E2E8F0] bg-white">
            <CardHeader>
              <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Recently Added to KB (latest 50)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Resolved At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.added_to_kb.map((q) => (
                    <TableRow key={q._id}>
                      <TableCell className="font-medium" style={{ color: '#0A101D' }}>{q.question}</TableCell>
                      <TableCell className="text-sm" style={{ color: '#64748B' }}>
                        {q.updated_at ? new Date(q.updated_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.added_to_kb.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-[#64748B]">No resolved questions yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Knowledge Item Dialog */}
      {createDialog && (
        <CreateKBItemDialog question={createDialog} modules={modules} topics={topics} resources={resources}
          onClose={() => setCreateDialog(null)} onSave={saveKnowledgeItem} />
      )}
    </div>
  );
}

function CreateKBItemDialog({ question, modules, topics, resources, onClose, onSave }) {
  const [form, setForm] = useState({
    title: question.question || "",
    answer_type: "how_to",
    question: question.question || "",
    explanation: "",
    steps: "",
    suggestions: "",
    keywords: question.question?.toLowerCase().split(/\s+/).filter((w) => w.length > 2).join(", ") || "",
    module_id: "",
    topic_id: "",
    resource_ids: [],
  });
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const filteredTopics = topics.filter((t) => !form.module_id || form.module_id === "all" || t.module_id === form.module_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="create-kb-from-gap">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>Create Knowledge Item from Unanswered Question</DialogTitle>
        </DialogHeader>
        <div className="p-3 rounded-lg bg-[#FFF0E5] border border-[#FF6B00]/20 mb-2">
          <p className="text-sm font-medium" style={{ color: '#FF6B00' }}>Original question: "{question.question}"</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>Asked {question.asked_count} time(s)</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => update("title", e.target.value)} data-testid="gap-item-title" /></div>
            <div>
              <Label>Answer Type</Label>
              <Select value={form.answer_type} onValueChange={(v) => update("answer_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="how_to">How To</SelectItem>
                  <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                  <SelectItem value="concept">Concept</SelectItem>
                  <SelectItem value="configuration">Configuration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Module</Label>
              <Select value={form.module_id} onValueChange={(v) => update("module_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                <SelectContent>{modules.map((m) => <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Topic</Label>
              <Select value={form.topic_id} onValueChange={(v) => update("topic_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                <SelectContent>{filteredTopics.map((t) => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Question</Label><Input value={form.question} onChange={(e) => update("question", e.target.value)} data-testid="gap-item-question" /></div>
          <div><Label>Explanation</Label><Textarea value={form.explanation} onChange={(e) => update("explanation", e.target.value)} className="min-h-[80px]" /></div>
          <div><Label>Steps (one per line)</Label><Textarea value={form.steps} onChange={(e) => update("steps", e.target.value)} className="min-h-[80px]" placeholder="Step 1...\nStep 2..." /></div>
          <div><Label>Suggestions (one per line)</Label><Textarea value={form.suggestions} onChange={(e) => update("suggestions", e.target.value)} className="min-h-[60px]" /></div>
          <div><Label>Keywords (comma separated)</Label><Input value={form.keywords} onChange={(e) => update("keywords", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="text-white" style={{ background: '#FF6B00' }} data-testid="save-gap-item-button"
            onClick={() => onSave({
              ...form,
              steps: form.steps.split("\n").filter(Boolean),
              suggestions: form.suggestions.split("\n").filter(Boolean),
              keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
            }, question._id)}>
            Save & Mark Resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
