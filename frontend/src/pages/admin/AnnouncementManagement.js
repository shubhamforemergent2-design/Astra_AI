import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";

export default function AnnouncementManagement() {
  const [items, setItems] = useState([]);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/admin/announcements"); setItems(data); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (formData) => {
    try {
      if (dialog.mode === "create") {
        await api.post("/admin/announcements", formData);
        toast.success("Announcement created");
      } else {
        await api.put(`/admin/announcements/${dialog.data._id}`, formData);
        toast.success("Announcement updated");
      }
      load();
      setDialog(null);
    } catch { toast.error("Failed to save"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try { await api.delete(`/admin/announcements/${id}`); load(); toast.success("Deleted"); } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="space-y-6" data-testid="announcement-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Announcements</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Manage announcements shown to users</p>
        </div>
        <Button size="sm" className="gap-1.5 text-white" style={{ background: '#FF6B00' }}
          onClick={() => setDialog({ mode: "create", data: {} })} data-testid="create-announcement-button">
          <Plus className="w-3.5 h-3.5" /> New Announcement
        </Button>
      </div>

      <Card className="border border-[#E2E8F0] bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
            <Megaphone className="w-4 h-4 text-[#FF6B00]" /> All Announcements ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item._id} data-testid={`announcement-row-${item._id}`}>
                  <TableCell className="font-medium" style={{ color: '#0A101D' }}>{item.title}</TableCell>
                  <TableCell className="max-w-[300px] truncate" style={{ color: '#64748B' }}>{item.content}</TableCell>
                  <TableCell>
                    <Badge variant={item.is_active ? "default" : "secondary"} className={`text-xs ${item.is_active ? 'bg-[#10B981] text-white' : ''}`}>
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
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
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-[#64748B]">No announcements yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {dialog && <AnnouncementDialog dialog={dialog} onClose={() => setDialog(null)} onSave={save} />}
    </div>
  );
}

function AnnouncementDialog({ dialog, onClose, onSave }) {
  const [form, setForm] = useState({
    title: dialog.data?.title || "",
    content: dialog.data?.content || "",
    is_active: dialog.data?.is_active !== false,
  });
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="announcement-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>{dialog.mode === "create" ? "Create" : "Edit"} Announcement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => update("title", e.target.value)} data-testid="announcement-title-input" /></div>
          <div><Label>Content</Label><Textarea value={form.content} onChange={(e) => update("content", e.target.value)} className="min-h-[100px]" data-testid="announcement-content-input" /></div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} data-testid="announcement-active-switch" />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} className="text-white" style={{ background: '#FF6B00' }} data-testid="save-announcement-button">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
