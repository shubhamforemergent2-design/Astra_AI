import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ticket, Clock, CheckCircle, AlertCircle, Trash2 } from "lucide-react";

const STATUS_CONFIG = {
  open: { label: "Open", color: "#FF6B00", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "#3B82F6", icon: Clock },
  closed: { label: "Closed", color: "#10B981", icon: CheckCircle },
};

export default function TicketManagement() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try { const { data } = await api.get("/admin/tickets"); setTickets(data); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/tickets/${id}`, { status });
      load();
      toast.success(`Ticket marked as ${status}`);
    } catch { toast.error("Failed to update ticket"); }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm("Delete this ticket?")) return;
    try {
      await api.delete(`/admin/tickets/${id}`);
      load();
      toast.success("Ticket deleted");
    } catch { toast.error("Failed to delete ticket"); }
  };

  const filtered = filter && filter !== "all" ? tickets.filter((t) => t.status === filter) : tickets;

  return (
    <div className="space-y-6" data-testid="ticket-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Support Tickets</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Manage escalated support requests</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40 h-8 text-sm" data-testid="filter-ticket-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, { label, color, icon: Icon }]) => {
          const count = tickets.filter((t) => t.status === key).length;
          return (
            <Card key={key} className="border border-[#E2E8F0] bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>{count}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border border-[#E2E8F0] bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
            <Ticket className="w-4 h-4 text-[#FF6B00]" /> Tickets ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const status = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
                return (
                  <TableRow key={t._id} data-testid={`ticket-row-${t._id}`}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#0A101D' }}>{t.user_name || "User"}</p>
                        <p className="text-xs" style={{ color: '#64748B' }}>{t.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-sm truncate" style={{ color: '#334155' }}>{t.question}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className="text-xs text-white" style={{ background: status.color }}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm" style={{ color: '#64748B' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select value={t.status} onValueChange={(v) => updateStatus(t._id, v)}>
                          <SelectTrigger className="h-8 text-xs w-[120px]" data-testid={`ticket-status-${t._id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteTicket(t._id)}
                          data-testid={`delete-ticket-${t._id}`}>
                          <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-[#64748B]">No tickets found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
