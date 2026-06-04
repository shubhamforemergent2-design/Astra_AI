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
import { Plus, Pencil, Trash2, Video, Presentation, FileText, ExternalLink } from "lucide-react";

export default function ResourceManagement() {
  const [resources, setResources] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const params = filter && filter !== "all" ? `?resource_type=${filter}` : "";
      const { data } = await api.get(`/knowledge/resources${params}`);
      setResources(data);
    } catch {}
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const save = async (formData) => {
    try {
      if (dialog.mode === "create") {
        await api.post("/knowledge/resources", formData);
        toast.success("Resource created");
      } else {
        await api.put(`/knowledge/resources/${dialog.data._id}`, formData);
        toast.success("Resource updated");
      }
      load();
      setDialog(null);
    } catch { toast.error("Failed to save resource"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this resource?")) return;
    try { await api.delete(`/knowledge/resources/${id}`); load(); toast.success("Deleted"); } catch { toast.error("Failed to delete"); }
  };

  const typeIcon = (t) => {
    if (t === "video") return <Video className="w-3.5 h-3.5" />;
    if (t === "ppt") return <Presentation className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-6" data-testid="resource-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Resources</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Manage videos, PPTs, and documents</p>
        </div>
        <Button size="sm" className="gap-1.5 text-white" style={{ background: '#FF6B00' }}
          onClick={() => setDialog({ mode: "create", data: {} })} data-testid="create-resource-button">
          <Plus className="w-3.5 h-3.5" /> Add Resource
        </Button>
      </div>

      <Card className="border border-[#E2E8F0] bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>All Resources ({resources.length})</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40 h-8 text-sm" data-testid="filter-resource-type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="ppt">PPTs</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((r) => (
                <TableRow key={r._id} data-testid={`resource-row-${r._id}`}>
                  <TableCell className="font-medium" style={{ color: '#0A101D' }}>{r.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1 text-xs capitalize">{typeIcon(r.resource_type)} {r.resource_type}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#3B82F6] hover:underline">
                        Link <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell style={{ color: '#64748B' }}>{r.duration || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDialog({ mode: "edit", data: r })}>
                        <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => remove(r._id)}>
                        <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {resources.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-[#64748B]">No resources yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      {dialog && (
        <ResourceDialog dialog={dialog} onClose={() => setDialog(null)} onSave={save} />
      )}
    </div>
  );
}

function ResourceDialog({ dialog, onClose, onSave }) {
  const [form, setForm] = useState({
    title: dialog.data?.title || "",
    description: dialog.data?.description || "",
    resource_type: dialog.data?.resource_type || "document",
    url: dialog.data?.url || "",
    duration: dialog.data?.duration || "",
    timestamp: dialog.data?.timestamp || "",
  });
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="resource-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>{dialog.mode === "create" ? "Add" : "Edit"} Resource</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => update("title", e.target.value)} data-testid="resource-title-input" /></div>
          <div>
            <Label>Type</Label>
            <Select value={form.resource_type} onValueChange={(v) => update("resource_type", v)}>
              <SelectTrigger data-testid="resource-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="ppt">PPT</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>URL</Label><Input value={form.url} onChange={(e) => update("url", e.target.value)} placeholder="https://..." data-testid="resource-url-input" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
          {form.resource_type === "video" && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Duration</Label><Input value={form.duration} onChange={(e) => update("duration", e.target.value)} placeholder="5:30" /></div>
              <div><Label>Relevant Timestamp</Label><Input value={form.timestamp} onChange={(e) => update("timestamp", e.target.value)} placeholder="2:15" /></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} className="text-white" style={{ background: '#FF6B00' }} data-testid="save-resource-button">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
