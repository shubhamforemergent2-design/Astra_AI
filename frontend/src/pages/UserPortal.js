import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api, { API_URL } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles, Send, Plus, MessageSquare, ThumbsUp, ThumbsDown,
  Ticket, LogOut, ChevronRight, Settings, Megaphone, Trash2,
  Search, X, FileText, Video, Presentation, Loader2
} from "lucide-react";

const SUGGESTED_QUESTIONS = [
  "How do I create a Sales Order?",
  "How do I configure GST?",
  "How do I create an Item?",
  "How do I generate an E-Invoice?",
  "How do I configure WhatsApp?",
  "How do I add a User?",
];

export default function UserPortal() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ticketDialog, setTicketDialog] = useState(false);
  const [ticketData, setTicketData] = useState({ question: "", ai_response: "" });
  const [feedbackDialog, setFeedbackDialog] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamContent, scrollToBottom]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/conversations");
      setConversations(data);
    } catch {}
  }, []);

  // Load announcements
  useEffect(() => {
    api.get("/admin/public/announcements").then(({ data }) => setAnnouncements(data)).catch(() => {});
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load conversation messages
  const loadConversation = useCallback(async (convId) => {
    try {
      const { data } = await api.get(`/chat/conversations/${convId}`);
      setMessages(data.messages);
      setActiveConv(data.conversation);
    } catch {
      toast.error("Failed to load conversation");
    }
  }, []);

  const createConversation = async () => {
    try {
      const { data } = await api.post("/chat/conversations", { title: "New Conversation" });
      setConversations((prev) => [data, ...prev]);
      setActiveConv(data);
      setMessages([]);
      setInput("");
    } catch {
      toast.error("Failed to create conversation");
    }
  };

  const deleteConversation = async (convId, e) => {
    e?.stopPropagation();
    try {
      await api.delete(`/chat/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (activeConv?._id === convId) {
        setActiveConv(null);
        setMessages([]);
      }
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || streaming) return;
    let convId = activeConv?._id;

    // Auto-create conversation if none active
    if (!convId) {
      try {
        const { data } = await api.post("/chat/conversations", { title: "New Conversation" });
        setConversations((prev) => [data, ...prev]);
        setActiveConv(data);
        convId = data._id;
      } catch {
        toast.error("Failed to create conversation");
        return;
      }
    }

    const userMsg = { _id: `temp-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamContent("");

    try {
      const response = await fetch(`${API_URL}/api/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: text }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let msgId = "";
      let resources = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "token") {
                fullContent += data.content;
                setStreamContent(fullContent);
              } else if (data.type === "done") {
                msgId = data.message_id;
                resources = data.resources || [];
              } else if (data.type === "error") {
                fullContent = data.content;
                setStreamContent(fullContent);
              }
            } catch {}
          }
        }
      }

      const assistantMsg = {
        _id: msgId || `ai-${Date.now()}`,
        role: "assistant",
        content: fullContent,
        resource_refs: resources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamContent("");
      loadConversations();
    } catch (err) {
      toast.error("Failed to get response");
      setStreamContent("");
    } finally {
      setStreaming(false);
    }
  };

  const submitFeedback = async (msgId, isHelpful) => {
    if (!isHelpful) {
      setFeedbackDialog(msgId);
      return;
    }
    try {
      await api.post("/chat/feedback", {
        message_id: msgId,
        conversation_id: activeConv?._id,
        is_helpful: true,
      });
      setMessages((prev) =>
        prev.map((m) => (m._id === msgId ? { ...m, feedback: { is_helpful: true } } : m))
      );
      toast.success("Thanks for the feedback!");
    } catch {}
  };

  const submitNegativeFeedback = async () => {
    if (!feedbackDialog) return;
    try {
      await api.post("/chat/feedback", {
        message_id: feedbackDialog,
        conversation_id: activeConv?._id,
        is_helpful: false,
        comment: feedbackComment,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m._id === feedbackDialog ? { ...m, feedback: { is_helpful: false, comment: feedbackComment } } : m
        )
      );
      toast.success("Feedback submitted");
    } catch {}
    setFeedbackDialog(null);
    setFeedbackComment("");
  };

  const openTicketDialog = (question, aiResponse) => {
    setTicketData({ question, ai_response: aiResponse, conversation_id: activeConv?._id });
    setTicketDialog(true);
  };

  const submitTicket = async () => {
    try {
      await api.post("/chat/tickets", ticketData);
      toast.success("Support ticket created");
      setTicketDialog(false);
    } catch {
      toast.error("Failed to create ticket");
    }
  };

  const filteredConvs = conversations.filter((c) =>
    !searchQuery || c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAdmin = ["super_admin", "knowledge_manager", "support_manager"].includes(user?.role);

  return (
    <TooltipProvider>
      <div className="h-screen flex bg-white" data-testid="user-portal">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-300 overflow-hidden border-r border-[#E2E8F0] flex flex-col bg-[#F8FAFC]`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FF6B00' }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Astra</span>
            </div>
            <Button onClick={createConversation} className="w-full justify-start gap-2 h-9 text-white font-medium"
              style={{ background: '#FF6B00' }} data-testid="new-chat-button">
              <Plus className="w-4 h-4" /> New Chat
            </Button>
          </div>

          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
              <Input placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm border-[#E2E8F0] bg-white" data-testid="search-conversations" />
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-0.5 py-1">
              {filteredConvs.map((conv) => (
                <div key={conv._id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                    activeConv?._id === conv._id
                      ? "bg-white border border-[#E2E8F0] shadow-sm"
                      : "hover:bg-white/60"
                  }`}
                  onClick={() => loadConversation(conv._id)}
                  data-testid={`conversation-item-${conv._id}`}>
                  <MessageSquare className="w-4 h-4 shrink-0" style={{ color: activeConv?._id === conv._id ? '#FF6B00' : '#64748B' }} />
                  <span className="flex-1 text-sm truncate" style={{ color: '#334155' }}>{conv.title || "New Conversation"}</span>
                  <button onClick={(e) => deleteConversation(conv._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#F1F5F9] transition-opacity"
                    data-testid={`delete-conv-${conv._id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-[#64748B]" />
                  </button>
                </div>
              ))}
              {filteredConvs.length === 0 && (
                <p className="text-center text-sm py-8" style={{ color: '#64748B' }}>No conversations yet</p>
              )}
            </div>
          </ScrollArea>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-[#E2E8F0] space-y-1">
            {isAdmin && (
              <a href="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white transition-colors" style={{ color: '#334155' }}
                data-testid="admin-panel-link">
                <Settings className="w-4 h-4" /> Admin Panel
              </a>
            )}
            <button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white transition-colors w-full text-left" style={{ color: '#64748B' }}
              data-testid="logout-button">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="glass-surface border-b border-[#E2E8F0]/50 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors" data-testid="toggle-sidebar">
                <ChevronRight className={`w-4 h-4 text-[#64748B] transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
              </button>
              <h2 className="text-base font-semibold truncate" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>
                {activeConv?.title || "Astra Assistant"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {announcements.length > 0 && (
                <Button variant="ghost" size="sm" className="gap-1.5 text-[#64748B] hover:text-[#FF6B00]"
                  onClick={() => setShowAnnouncements(!showAnnouncements)} data-testid="toggle-announcements">
                  <Megaphone className="w-4 h-4" />
                  <span className="text-xs font-medium">{announcements.length}</span>
                </Button>
              )}
              <div className="text-sm" style={{ color: '#64748B' }}>
                {user?.name}
              </div>
            </div>
          </div>

          {/* Announcements Banner */}
          {showAnnouncements && announcements.length > 0 && (
            <div className="px-6 py-3 border-b border-[#E2E8F0] bg-[#FFF0E5]" data-testid="announcements-banner">
              <div className="flex items-start gap-2">
                <Megaphone className="w-4 h-4 mt-0.5 text-[#FF6B00] shrink-0" />
                <div className="flex-1 space-y-1">
                  {announcements.slice(0, 3).map((a) => (
                    <p key={a._id} className="text-sm" style={{ color: '#334155' }}>
                      <span className="font-semibold">{a.title}</span> — {a.content}
                    </p>
                  ))}
                </div>
                <button onClick={() => setShowAnnouncements(false)} className="p-0.5">
                  <X className="w-3.5 h-3.5 text-[#64748B]" />
                </button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {messages.length === 0 && !streamContent && (
                <div className="animate-fade-in-up" data-testid="welcome-screen">
                  <div className="text-center mb-12">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: '#FFF0E5' }}>
                      <Sparkles className="w-8 h-8 text-[#FF6B00]" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>
                      Hi, I'm Astra
                    </h1>
                    <p className="text-base max-w-md mx-auto" style={{ color: '#64748B' }}>
                      I can help you understand Biziverse features, guide you through workflows, answer product questions, and provide relevant training materials.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button key={q} onClick={() => sendMessage(q)}
                        className="animate-fade-in-up text-left px-4 py-3.5 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#FF6B00] hover:shadow-md transition-all duration-200 group"
                        data-testid={`suggested-q-${q.slice(0, 20).replace(/\s/g, '-')}`}>
                        <span className="text-sm font-medium group-hover:text-[#FF6B00] transition-colors" style={{ color: '#334155' }}>{q}</span>
                        <ChevronRight className="w-3.5 h-3.5 inline-block ml-1 opacity-0 group-hover:opacity-100 text-[#FF6B00] transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="space-y-6">
                {messages.map((msg, idx) => (
                  <div key={msg._id || idx} className={`animate-fade-in-up flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "user" ? (
                      <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm text-white text-sm" style={{ background: '#0A101D' }}
                        data-testid={`user-message-${idx}`}>
                        {msg.content}
                      </div>
                    ) : (
                      <div className="max-w-[90%] space-y-2" data-testid={`ai-message-${idx}`}>
                        <div className="px-5 py-4 rounded-2xl rounded-tl-sm border border-[#E2E8F0] bg-[#F8FAFC]">
                          <div className="chat-message-content text-sm" style={{ color: '#334155' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                          {/* Resources */}
                          {msg.resource_refs && msg.resource_refs.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Reference Materials</p>
                              <div className="flex flex-wrap gap-2">
                                {msg.resource_refs.map((r, i) => (
                                  <a key={i} href={r.url || "#"} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-medium hover:border-[#FF6B00] hover:text-[#FF6B00] transition-colors"
                                    style={{ color: '#334155' }}>
                                    {r.type === "video" ? <Video className="w-3 h-3" /> : r.type === "ppt" ? <Presentation className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                    {r.title}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Feedback Buttons */}
                        <div className="flex items-center gap-1 px-1">
                          {msg.feedback ? (
                            <span className="text-xs" style={{ color: '#64748B' }}>
                              {msg.feedback.is_helpful ? "Marked as helpful" : "Marked as not helpful"}
                            </span>
                          ) : (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button onClick={() => submitFeedback(msg._id, true)}
                                    className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors" data-testid={`feedback-helpful-${idx}`}>
                                    <ThumbsUp className="w-3.5 h-3.5 text-[#64748B] hover:text-[#10B981]" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Helpful</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button onClick={() => submitFeedback(msg._id, false)}
                                    className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors" data-testid={`feedback-not-helpful-${idx}`}>
                                    <ThumbsDown className="w-3.5 h-3.5 text-[#64748B] hover:text-[#EF4444]" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Not Helpful</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button onClick={() => openTicketDialog(messages[idx - 1]?.content || "", msg.content)}
                                    className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors" data-testid={`create-ticket-${idx}`}>
                                    <Ticket className="w-3.5 h-3.5 text-[#64748B] hover:text-[#FF6B00]" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Create Support Ticket</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming Message */}
                {streaming && streamContent && (
                  <div className="flex justify-start animate-fade-in-up">
                    <div className="max-w-[90%]">
                      <div className="px-5 py-4 rounded-2xl rounded-tl-sm border border-[#E2E8F0] bg-[#F8FAFC]">
                        <div className="chat-message-content text-sm" style={{ color: '#334155' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamContent}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {streaming && !streamContent && (
                  <div className="flex justify-start animate-fade-in-up">
                    <div className="px-5 py-4 rounded-2xl rounded-tl-sm border border-[#E2E8F0] bg-[#F8FAFC]">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#FF6B00]" />
                        <span className="text-sm animate-pulse-soft" style={{ color: '#64748B' }}>Astra is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-[#E2E8F0] px-6 py-4 bg-white" data-testid="chat-input-area">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Astra anything about Biziverse..."
                    disabled={streaming}
                    className="h-12 pr-12 rounded-xl border-[#E2E8F0] bg-[#F8FAFC] focus:bg-white focus:border-[#FF6B00] focus:ring-[#FF6B00] text-sm"
                    data-testid="chat-input" />
                  <Button type="submit" disabled={!input.trim() || streaming} size="sm"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 p-0 rounded-lg text-white"
                    style={{ background: input.trim() ? '#FF6B00' : '#CBD5E1' }}
                    data-testid="chat-submit">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Feedback Dialog */}
        <Dialog open={!!feedbackDialog} onOpenChange={() => { setFeedbackDialog(null); setFeedbackComment(""); }}>
          <DialogContent data-testid="feedback-dialog">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Outfit', color: '#0A101D' }}>What went wrong?</DialogTitle>
            </DialogHeader>
            <Textarea placeholder="Information is outdated, missing steps, wrong answer..." value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)} className="min-h-[100px]" data-testid="feedback-comment" />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setFeedbackDialog(null); setFeedbackComment(""); }}>Cancel</Button>
              <Button onClick={submitNegativeFeedback} className="text-white" style={{ background: '#FF6B00' }} data-testid="submit-feedback-button">
                Submit Feedback
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ticket Dialog */}
        <Dialog open={ticketDialog} onOpenChange={setTicketDialog}>
          <DialogContent data-testid="ticket-dialog">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: '#334155' }}>Question</label>
                <Textarea value={ticketData.question} onChange={(e) => setTicketData({ ...ticketData, question: e.target.value })}
                  className="min-h-[60px]" data-testid="ticket-question" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: '#334155' }}>AI Response</label>
                <Textarea value={ticketData.ai_response} readOnly className="min-h-[60px] bg-[#F8FAFC]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTicketDialog(false)}>Cancel</Button>
              <Button onClick={submitTicket} className="text-white" style={{ background: '#FF6B00' }} data-testid="submit-ticket-button">
                Create Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
