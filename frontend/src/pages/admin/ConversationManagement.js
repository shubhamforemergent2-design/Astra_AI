import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, MessageSquare, Clock, CheckCircle, AlertTriangle, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";

const STATUS_BADGE = {
  pending: { label: "Pending", color: "#F59E0B", icon: Clock },
  reviewed: { label: "Reviewed", color: "#10B981", icon: CheckCircle },
  flagged: { label: "Flagged", color: "#EF4444", icon: AlertTriangle },
};

export default function ConversationManagement() {
  const [conversations, setConversations] = useState([]);
  const [tab, setTab] = useState("all");
  const [viewDialog, setViewDialog] = useState(null);
  const [viewMessages, setViewMessages] = useState([]);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/admin/conversations"); setConversations(data); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id, status) => {
    try {
      await api.put(`/admin/conversations/${id}/review`, { review_status: status });
      load();
      toast.success(`Conversation ${status}`);
    } catch { toast.error("Failed to update"); }
  };

  const viewConversation = async (conv) => {
    try {
      const { data } = await api.get(`/admin/conversations/${conv._id}/messages`);
      setViewMessages(data.messages);
      setViewDialog(conv);
    } catch { toast.error("Failed to load messages"); }
  };

  const filtered = tab === "all" ? conversations : conversations.filter((c) => (c.review_status || "pending") === tab);

  const counts = {
    all: conversations.length,
    pending: conversations.filter((c) => (c.review_status || "pending") === "pending").length,
    reviewed: conversations.filter((c) => c.review_status === "reviewed").length,
    flagged: conversations.filter((c) => c.review_status === "flagged").length,
  };

  return (
    <div className="space-y-6" data-testid="conversation-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Conversations</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Review latest 100 conversations — mark as reviewed or flag for follow-up</p>
        </div>
        <div className="flex gap-2">
          {Object.entries(STATUS_BADGE).map(([key, { label, color }]) => (
            <Badge key={key} variant="outline" className="gap-1.5 px-3 py-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} /> {counts[key]} {label}
            </Badge>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#F1F5F9]">
          <TabsTrigger value="all" className="data-[state=active]:bg-white">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-white">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="reviewed" className="data-[state=active]:bg-white">Reviewed ({counts.reviewed})</TabsTrigger>
          <TabsTrigger value="flagged" className="data-[state=active]:bg-white">Flagged ({counts.flagged})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card className="border border-[#E2E8F0] bg-white">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <MessageSquare className="w-4 h-4 text-[#FF6B00]" /> {filtered.length} Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((conv) => {
                    const status = STATUS_BADGE[conv.review_status || "pending"] || STATUS_BADGE.pending;
                    return (
                      <TableRow key={conv._id} data-testid={`conv-row-${conv._id}`}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#0A101D' }}>{conv.user_name}</p>
                            <p className="text-xs" style={{ color: '#64748B' }}>{conv.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium" style={{ color: '#334155' }}>{conv.title || "New Conversation"}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{conv.message_count}</Badge></TableCell>
                        <TableCell>
                          <Badge className="text-xs text-white gap-1" style={{ background: status.color }}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm" style={{ color: '#64748B' }}>
                          {conv.created_at ? new Date(conv.created_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => viewConversation(conv)}
                              title="View Messages" data-testid={`view-conv-${conv._id}`}>
                              <Eye className="w-4 h-4 text-[#3B82F6]" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleReview(conv._id, "reviewed")}
                              title="Mark Reviewed" data-testid={`review-conv-${conv._id}`}>
                              <Check className="w-4 h-4 text-[#10B981]" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleReview(conv._id, "flagged")}
                              title="Flag" data-testid={`flag-conv-${conv._id}`}>
                              <X className="w-4 h-4 text-[#EF4444]" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-[#64748B]">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
                      No conversations in this category
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Messages Dialog */}
      <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="conv-messages-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>
              {viewDialog?.title || "Conversation"} — {viewDialog?.user_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] pr-2">
            <div className="space-y-3">
              {viewMessages.map((msg, idx) => (
                <div key={msg._id || idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-[#0A101D] text-white rounded-tr-sm"
                      : "bg-[#F8FAFC] border border-[#E2E8F0] rounded-tl-sm"
                  }`} style={msg.role === "assistant" ? { color: '#334155' } : {}}>
                    {msg.role === "assistant" ? (
                      <div className="chat-message-content"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
