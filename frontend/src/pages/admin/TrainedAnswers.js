import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, GraduationCap } from "lucide-react";

export default function TrainedAnswers() {
  const [items, setItems] = useState([]);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/admin/trained-answers"); setItems(data); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (formData) => {
    try {
      if (dialog.mode === "create") {
        await api.post("/admin/trained-answers", formData);
        toast.success("Trained answer created");
      } else {
        await api.put(`/admin/trained-answers/${dialog.data._id}`, formData);
        toast.success("Trained answer updated");
      }
      load();
      setDialog(null);
    } catch { toast.error("Failed to save"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this trained answer?")) return;
    try { await api.delete(`/admin/trained-answers/${id}`); load(); toast.success("Deleted"); } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="space-y-6" data-testid="trained-answers">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Trained Answers</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Train Astra with verified Q&A pairs. These get highest priority in responses.</p>
        </div>
        <Button size="sm" className="gap-1.5 text-white" style={{ background: '#FF6B00' }}
          onClick={() => setDialog({ mode: "create", data: {} })} data-testid="create-trained-answer-button">
          <Plus className="w-3.5 h-3.5" /> Add Trained Answer
        </Button>
      </div>

      <Card className="border border-[#E2E8F0] bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
            <GraduationCap className="w-4 h-4 text-[#FF6B00]" /> All Trained Answers ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question Pattern</TableHead>
                <TableHead>Answer (preview)</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item._id} data-testid={`trained-row-${item._id}`}>
                  <TableCell className="font-medium max-w-[250px]" style={{ color: '#0A101D' }}>{item.question_pattern}</TableCell>
                  <TableCell className="max-w-[300px] truncate" style={{ color: '#64748B' }}>{item.answer?.slice(0, 100)}...</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(item.keywords || []).slice(0, 4).map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDialog({ mode: "edit", data: item })}>
                        <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => remove(item._id)}>
                        <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-[#64748B]">
                  <GraduationCap className="w-8 h-8 mx-auto mb-2 text-[#64748B]" />
                  No trained answers yet. Add Q&A pairs to improve Astra's accuracy.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {dialog && <TrainedDialog dialog={dialog} onClose={() => setDialog(null)} onSave={save} />}
    </div>
  );
}

function TrainedDialog({ dialog, onClose, onSave }) {
  const [form, setForm] = useState({
    question_pattern: dialog.data?.question_pattern || "",
    answer: dialog.data?.answer || "",
    keywords: (dialog.data?.keywords || []).join(", "),
  });
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl" data-testid="trained-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>{dialog.mode === "create" ? "Add" : "Edit"} Trained Answer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Question Pattern</Label>
            <Input value={form.question_pattern} onChange={(e) => update("question_pattern", e.target.value)}
              placeholder="How do I create a Sales Order?" data-testid="trained-question-input" />
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>The question users are likely to ask</p>
          </div>
          <div>
            <Label>Answer</Label>
            <Textarea value={form.answer} onChange={(e) => update("answer", e.target.value)}
              className="min-h-[150px]" placeholder="Provide the complete, correct answer..." data-testid="trained-answer-input" />
          </div>
          <div>
            <Label>Keywords (comma separated)</Label>
            <Input value={form.keywords} onChange={(e) => update("keywords", e.target.value)}
              placeholder="sales order, create, customer" data-testid="trained-keywords-input" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="text-white" style={{ background: '#FF6B00' }} data-testid="save-trained-button"
            onClick={() => onSave({
              question_pattern: form.question_pattern,
              answer: form.answer,
              keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
            })}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
