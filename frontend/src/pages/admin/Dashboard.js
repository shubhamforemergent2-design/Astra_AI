import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare, Users, TrendingUp, TrendingDown,
  ThumbsUp, ThumbsDown, Ticket, BookOpen
} from "lucide-react";

const STAT_CONFIG = [
  { key: "total_questions", label: "Total Questions", icon: MessageSquare, color: "#3B82F6" },
  { key: "active_users", label: "Active Users", icon: Users, color: "#10B981" },
  { key: "resolution_rate", label: "Resolution Rate", icon: TrendingUp, color: "#10B981", suffix: "%" },
  { key: "escalation_rate", label: "Escalation Rate", icon: TrendingDown, color: "#F59E0B", suffix: "%" },
  { key: "helpful_pct", label: "Helpful %", icon: ThumbsUp, color: "#10B981", suffix: "%" },
  { key: "not_helpful_pct", label: "Not Helpful %", icon: ThumbsDown, color: "#EF4444", suffix: "%" },
  { key: "open_tickets", label: "Open Tickets", icon: Ticket, color: "#FF6B00" },
  { key: "total_knowledge_items", label: "Knowledge Items", icon: BookOpen, color: "#8B5CF6" },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/analytics")
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="border border-[#E2E8F0]">
              <CardContent className="p-5">
                <div className="h-16 animate-pulse bg-[#F1F5F9] rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Overview of Astra's performance and usage</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {STAT_CONFIG.map(({ key, label, icon: Icon, color, suffix }) => (
          <Card key={key} className="animate-fade-in-up border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-lg hover:-translate-y-1 transition-all duration-200 bg-white"
            data-testid={`stat-${key}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2" style={{ color: '#64748B' }}>{label}</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>
                    {stats?.[key] ?? 0}{suffix || ""}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[#E2E8F0] bg-white">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Feedback Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#64748B' }}>Total Feedback</span>
                <span className="text-sm font-semibold" style={{ color: '#0A101D' }}>{stats?.total_feedback ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#64748B' }}>Helpful</span>
                <span className="text-sm font-semibold text-[#10B981]">{stats?.helpful_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#64748B' }}>Not Helpful</span>
                <span className="text-sm font-semibold text-[#EF4444]">{stats?.not_helpful_count ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E2E8F0] bg-white">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Tickets</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#64748B' }}>Total Tickets</span>
                <span className="text-sm font-semibold" style={{ color: '#0A101D' }}>{stats?.total_tickets ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#64748B' }}>Open</span>
                <span className="text-sm font-semibold text-[#FF6B00]">{stats?.open_tickets ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E2E8F0] bg-white">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Knowledge Base</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#64748B' }}>Modules</span>
                <span className="text-sm font-semibold" style={{ color: '#0A101D' }}>{stats?.total_modules ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#64748B' }}>Knowledge Items</span>
                <span className="text-sm font-semibold" style={{ color: '#0A101D' }}>{stats?.total_knowledge_items ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#64748B' }}>Conversations</span>
                <span className="text-sm font-semibold" style={{ color: '#0A101D' }}>{stats?.total_conversations ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
