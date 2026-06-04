import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, UserPlus } from "lucide-react";

const ROLES = [
  { value: "super_admin", label: "Super Admin", color: "#FF6B00" },
  { value: "knowledge_manager", label: "Knowledge Manager", color: "#3B82F6" },
  { value: "support_manager", label: "Support Manager", color: "#10B981" },
  { value: "contributor", label: "Contributor", color: "#8B5CF6" },
  { value: "end_user", label: "End User", color: "#64748B" },
];

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/admin/users"); setUsers(data); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveUser = async (formData) => {
    try {
      if (dialog.mode === "create") {
        await api.post("/admin/users", formData);
        toast.success("User created");
      } else {
        await api.put(`/admin/users/${dialog.data._id}`, { name: formData.name, role: formData.role, is_active: formData.is_active });
        toast.success("User updated");
      }
      load();
      setDialog(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save user");
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try { await api.delete(`/admin/users/${id}`); load(); toast.success("Deleted"); } catch (err) { toast.error(err.response?.data?.detail || "Failed to delete"); }
  };

  const getRoleBadge = (role) => {
    const r = ROLES.find((x) => x.value === role);
    return r ? (
      <Badge className="text-xs text-white" style={{ background: r.color }}>{r.label}</Badge>
    ) : <Badge variant="secondary">{role}</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="user-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Users</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Manage users and their roles</p>
        </div>
        <Button size="sm" className="gap-1.5 text-white" style={{ background: '#FF6B00' }}
          onClick={() => setDialog({ mode: "create", data: {} })} data-testid="create-user-button">
          <UserPlus className="w-3.5 h-3.5" /> Add User
        </Button>
      </div>

      <Card className="border border-[#E2E8F0] bg-white">
        <CardHeader>
          <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u._id} data-testid={`user-row-${u._id}`}>
                  <TableCell className="font-medium" style={{ color: '#0A101D' }}>{u.name}</TableCell>
                  <TableCell style={{ color: '#64748B' }}>{u.email}</TableCell>
                  <TableCell>{getRoleBadge(u.role)}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_active !== false ? "default" : "destructive"} className="text-xs">
                      {u.is_active !== false ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDialog({ mode: "edit", data: u })}>
                        <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteUser(u._id)}>
                        <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {dialog && <UserDialog dialog={dialog} onClose={() => setDialog(null)} onSave={saveUser} />}
    </div>
  );
}

function UserDialog({ dialog, onClose, onSave }) {
  const [form, setForm] = useState({
    name: dialog.data?.name || "",
    email: dialog.data?.email || "",
    password: "",
    role: dialog.data?.role || "end_user",
    is_active: dialog.data?.is_active !== false,
  });
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="user-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>{dialog.mode === "create" ? "Create" : "Edit"} User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} data-testid="user-name-input" /></div>
          {dialog.mode === "create" && (
            <>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} data-testid="user-email-input" /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} data-testid="user-password-input" /></div>
            </>
          )}
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => update("role", v)}>
              <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} className="text-white" style={{ background: '#FF6B00' }} data-testid="save-user-button">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
