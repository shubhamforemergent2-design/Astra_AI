import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, BookOpen, FolderTree, FileText } from "lucide-react";

export default function KnowledgeManagement() {
  const [tab, setTab] = useState("modules");
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [items, setItems] = useState([]);
  const [resources, setResources] = useState([]);
  const [dialog, setDialog] = useState(null); // { type: 'module'|'topic'|'item', mode: 'create'|'edit', data: {} }
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  const loadModules = useCallback(async () => {
    try { const { data } = await api.get("/knowledge/modules"); setModules(data); } catch {}
  }, []);

  const loadTopics = useCallback(async () => {
    try {
      const params = selectedModule && selectedModule !== "all" ? `?module_id=${selectedModule}` : "";
      const { data } = await api.get(`/knowledge/topics${params}`);
      setTopics(data);
    } catch {}
  }, [selectedModule]);

  const loadItems = useCallback(async () => {
    try {
      let params = [];
      if (selectedModule && selectedModule !== "all") params.push(`module_id=${selectedModule}`);
      if (selectedTopic && selectedTopic !== "all") params.push(`topic_id=${selectedTopic}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      const { data } = await api.get(`/knowledge/items${qs}`);
      setItems(data);
    } catch {}
  }, [selectedModule, selectedTopic]);

  const loadResources = useCallback(async () => {
    try { const { data } = await api.get("/knowledge/resources"); setResources(data); } catch {}
  }, []);

  useEffect(() => { loadModules(); loadResources(); }, [loadModules, loadResources]);
  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadItems(); }, [loadItems]);

  // Module CRUD
  const saveModule = async (formData) => {
    try {
      if (dialog.mode === "create") {
        await api.post("/knowledge/modules", formData);
        toast.success("Module created");
      } else {
        await api.put(`/knowledge/modules/${dialog.data._id}`, formData);
        toast.success("Module updated");
      }
      loadModules();
      setDialog(null);
    } catch { toast.error("Failed to save module"); }
  };

  const deleteModule = async (id) => {
    if (!window.confirm("Delete this module and all its topics/items?")) return;
    try { await api.delete(`/knowledge/modules/${id}`); loadModules(); loadTopics(); loadItems(); toast.success("Deleted"); } catch { toast.error("Failed to delete"); }
  };

  // Topic CRUD
  const saveTopic = async (formData) => {
    try {
      if (dialog.mode === "create") {
        await api.post("/knowledge/topics", formData);
        toast.success("Topic created");
      } else {
        await api.put(`/knowledge/topics/${dialog.data._id}`, formData);
        toast.success("Topic updated");
      }
      loadTopics();
      setDialog(null);
    } catch { toast.error("Failed to save topic"); }
  };

  const deleteTopic = async (id) => {
    if (!window.confirm("Delete this topic and all its items?")) return;
    try { await api.delete(`/knowledge/topics/${id}`); loadTopics(); loadItems(); toast.success("Deleted"); } catch { toast.error("Failed to delete"); }
  };

  // Item CRUD
  const saveItem = async (formData) => {
    try {
      if (dialog.mode === "create") {
        await api.post("/knowledge/items", formData);
        toast.success("Knowledge item created");
      } else {
        await api.put(`/knowledge/items/${dialog.data._id}`, formData);
        toast.success("Knowledge item updated");
      }
      loadItems();
      setDialog(null);
    } catch { toast.error("Failed to save item"); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Delete this knowledge item?")) return;
    try { await api.delete(`/knowledge/items/${id}`); loadItems(); toast.success("Deleted"); } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="space-y-6" data-testid="knowledge-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Knowledge Base</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Manage modules, topics, and knowledge items</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#F1F5F9]">
          <TabsTrigger value="modules" className="gap-1.5 data-[state=active]:bg-white"><BookOpen className="w-3.5 h-3.5" /> Modules</TabsTrigger>
          <TabsTrigger value="topics" className="gap-1.5 data-[state=active]:bg-white"><FolderTree className="w-3.5 h-3.5" /> Topics</TabsTrigger>
          <TabsTrigger value="items" className="gap-1.5 data-[state=active]:bg-white"><FileText className="w-3.5 h-3.5" /> Knowledge Items</TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules">
          <Card className="border border-[#E2E8F0] bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Modules ({modules.length})</CardTitle>
              <Button size="sm" className="gap-1.5 text-white" style={{ background: '#FF6B00' }}
                onClick={() => setDialog({ type: "module", mode: "create", data: {} })} data-testid="create-module-button">
                <Plus className="w-3.5 h-3.5" /> Add Module
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((m) => (
                    <TableRow key={m._id} data-testid={`module-row-${m._id}`}>
                      <TableCell className="font-medium" style={{ color: '#0A101D' }}>{m.name}</TableCell>
                      <TableCell style={{ color: '#64748B' }}>{m.description || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDialog({ type: "module", mode: "edit", data: m })}>
                            <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteModule(m._id)}>
                            <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {modules.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-[#64748B]">No modules yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topics Tab */}
        <TabsContent value="topics">
          <Card className="border border-[#E2E8F0] bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Topics ({topics.length})</CardTitle>
                <Select value={selectedModule} onValueChange={setSelectedModule}>
                  <SelectTrigger className="w-48 h-8 text-sm" data-testid="filter-module-select">
                    <SelectValue placeholder="All modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>
                    {modules.map((m) => <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="gap-1.5 text-white" style={{ background: '#FF6B00' }}
                onClick={() => setDialog({ type: "topic", mode: "create", data: {} })} data-testid="create-topic-button">
                <Plus className="w-3.5 h-3.5" /> Add Topic
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topics.map((t) => (
                    <TableRow key={t._id} data-testid={`topic-row-${t._id}`}>
                      <TableCell className="font-medium" style={{ color: '#0A101D' }}>{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{modules.find((m) => m._id === t.module_id)?.name || "—"}</Badge>
                      </TableCell>
                      <TableCell style={{ color: '#64748B' }}>{t.description || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDialog({ type: "topic", mode: "edit", data: t })}>
                            <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteTopic(t._id)}>
                            <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {topics.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-[#64748B]">No topics yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items">
          <Card className="border border-[#E2E8F0] bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Items ({items.length})</CardTitle>
                <Select value={selectedModule} onValueChange={(v) => { setSelectedModule(v); setSelectedTopic(""); }}>
                  <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All modules" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>
                    {modules.map((m) => <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All topics" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All topics</SelectItem>
                    {topics.map((t) => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="gap-1.5 text-white" style={{ background: '#FF6B00' }}
                onClick={() => setDialog({ type: "item", mode: "create", data: {} })} data-testid="create-item-button">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Keywords</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item._id} data-testid={`item-row-${item._id}`}>
                      <TableCell className="font-medium max-w-[250px] truncate" style={{ color: '#0A101D' }}>{item.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{item.answer_type?.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{modules.find((m) => m._id === item.module_id)?.name || "—"}</Badge></TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="flex gap-1 flex-wrap">
                          {(item.keywords || []).slice(0, 3).map((kw, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDialog({ type: "item", mode: "edit", data: item })}>
                            <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteItem(item._id)}>
                            <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-[#64748B]">No knowledge items yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {dialog?.type === "module" && (
        <ModuleDialog dialog={dialog} onClose={() => setDialog(null)} onSave={saveModule} />
      )}
      {dialog?.type === "topic" && (
        <TopicDialog dialog={dialog} modules={modules} onClose={() => setDialog(null)} onSave={saveTopic} />
      )}
      {dialog?.type === "item" && (
        <ItemDialog dialog={dialog} modules={modules} topics={topics} resources={resources} onClose={() => setDialog(null)} onSave={saveItem} />
      )}
    </div>
  );
}

function ModuleDialog({ dialog, onClose, onSave }) {
  const [name, setName] = useState(dialog.data?.name || "");
  const [description, setDescription] = useState(dialog.data?.description || "");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="module-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>{dialog.mode === "create" ? "Create" : "Edit"} Module</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="module-name-input" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} data-testid="module-desc-input" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ name, description })} className="text-white" style={{ background: '#FF6B00' }} data-testid="save-module-button">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopicDialog({ dialog, modules, onClose, onSave }) {
  const [name, setName] = useState(dialog.data?.name || "");
  const [description, setDescription] = useState(dialog.data?.description || "");
  const [moduleId, setModuleId] = useState(dialog.data?.module_id || "");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="topic-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>{dialog.mode === "create" ? "Create" : "Edit"} Topic</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="topic-name-input" /></div>
          <div>
            <Label>Module</Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger data-testid="topic-module-select"><SelectValue placeholder="Select module" /></SelectTrigger>
              <SelectContent>{modules.map((m) => <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ name, description, module_id: moduleId })} className="text-white" style={{ background: '#FF6B00' }} data-testid="save-topic-button">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ dialog, modules, topics, resources, onClose, onSave }) {
  const [form, setForm] = useState({
    title: dialog.data?.title || "",
    answer_type: dialog.data?.answer_type || "how_to",
    question: dialog.data?.question || "",
    explanation: dialog.data?.explanation || "",
    steps: (dialog.data?.steps || []).join("\n"),
    suggestions: (dialog.data?.suggestions || []).join("\n"),
    keywords: (dialog.data?.keywords || []).join(", "),
    module_id: dialog.data?.module_id || "",
    topic_id: dialog.data?.topic_id || "",
    resource_ids: dialog.data?.resource_ids || [],
  });

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const filteredTopics = topics.filter((t) => !form.module_id || form.module_id === "all" || t.module_id === form.module_id);

  const handleSave = () => {
    onSave({
      ...form,
      steps: form.steps.split("\n").filter(Boolean),
      suggestions: form.suggestions.split("\n").filter(Boolean),
      keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="item-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>{dialog.mode === "create" ? "Create" : "Edit"} Knowledge Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => update("title", e.target.value)} data-testid="item-title-input" /></div>
            <div>
              <Label>Answer Type</Label>
              <Select value={form.answer_type} onValueChange={(v) => update("answer_type", v)}>
                <SelectTrigger data-testid="item-type-select"><SelectValue /></SelectTrigger>
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
          <div><Label>Question</Label><Input value={form.question} onChange={(e) => update("question", e.target.value)} data-testid="item-question-input" /></div>
          <div><Label>Explanation</Label><Textarea value={form.explanation} onChange={(e) => update("explanation", e.target.value)} className="min-h-[80px]" /></div>
          <div><Label>Steps (one per line)</Label><Textarea value={form.steps} onChange={(e) => update("steps", e.target.value)} className="min-h-[80px]" placeholder="Go to Sales > Sales Order\nClick Create New\n..." /></div>
          <div><Label>Suggestions (one per line)</Label><Textarea value={form.suggestions} onChange={(e) => update("suggestions", e.target.value)} className="min-h-[60px]" /></div>
          <div><Label>Keywords (comma separated)</Label><Input value={form.keywords} onChange={(e) => update("keywords", e.target.value)} placeholder="sales order, create, customer" data-testid="item-keywords-input" /></div>
          <div>
            <Label>Resources</Label>
            <Select value="" onValueChange={(v) => { if (!form.resource_ids.includes(v)) update("resource_ids", [...form.resource_ids, v]); }}>
              <SelectTrigger><SelectValue placeholder="Attach resources..." /></SelectTrigger>
              <SelectContent>{resources.map((r) => <SelectItem key={r._id} value={r._id}>{r.title} ({r.resource_type})</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {form.resource_ids.map((rid) => {
                const r = resources.find((res) => res._id === rid);
                return r ? (
                  <Badge key={rid} variant="secondary" className="gap-1 cursor-pointer" onClick={() => update("resource_ids", form.resource_ids.filter((x) => x !== rid))}>
                    {r.title} <span className="text-[#EF4444]">&times;</span>
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="text-white" style={{ background: '#FF6B00' }} data-testid="save-item-button">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
