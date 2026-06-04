import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquare, Users, TrendingUp, TrendingDown,
  ThumbsUp, ThumbsDown, Ticket, BookOpen, HelpCircle
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const STAT_CONFIG = [
  { key: "total_questions", label: "Total Questions", icon: MessageSquare, color: "#3B82F6" },
  { key: "active_users", label: "Active Users", icon: Users, color: "#10B981" },
  { key: "resolution_rate", label: "Resolution Rate", icon: TrendingUp, color: "#10B981", suffix: "%" },
  { key: "escalation_rate", label: "Escalation Rate", icon: TrendingDown, color: "#F59E0B", suffix: "%" },
  { key: "helpful_pct", label: "Helpful %", icon: ThumbsUp, color: "#10B981", suffix: "%" },
  { key: "not_helpful_pct", label: "Not Helpful %", icon: ThumbsDown, color: "#EF4444", suffix: "%" },
  { key: "open_tickets", label: "Open Tickets", icon: Ticket, color: "#FF6B00" },
  { key: "unanswered_questions", label: "Unanswered Qs", icon: HelpCircle, color: "#8B5CF6" },
];

const PIE_COLORS = ["#10B981", "#EF4444"];
const TICKET_COLORS = { open: "#FF6B00", in_progress: "#3B82F6", closed: "#10B981" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg shadow-lg border border-[#E2E8F0]" style={{ background: '#0A101D' }}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/admin/analytics"),
      api.get("/admin/analytics/charts"),
    ])
      .then(([s, c]) => { setStats(s.data); setCharts(c.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="border border-[#E2E8F0]"><CardContent className="p-5"><div className="h-16 animate-pulse bg-[#F1F5F9] rounded" /></CardContent></Card>
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

      {/* Stat Cards */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions Over Time */}
        <Card className="border border-[#E2E8F0] bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Questions Over Time (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.daily_questions?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={charts.daily_questions}>
                  <defs>
                    <linearGradient id="colorQ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="questions" stroke="#FF6B00" fill="url(#colorQ)" strokeWidth={2} name="Questions" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: '#64748B' }}>No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Feedback Over Time */}
        <Card className="border border-[#E2E8F0] bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Feedback Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.daily_feedback?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={charts.daily_feedback}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="helpful" fill="#10B981" radius={[4, 4, 0, 0]} name="Helpful" />
                  <Bar dataKey="not_helpful" fill="#EF4444" radius={[4, 4, 0, 0]} name="Not Helpful" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: '#64748B' }}>No feedback data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Feedback Distribution Pie */}
        <Card className="border border-[#E2E8F0] bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Feedback Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {(charts?.feedback_pie?.[0]?.value > 0 || charts?.feedback_pie?.[1]?.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={charts.feedback_pie} cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                    dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {charts.feedback_pie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: '#64748B' }}>No feedback data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Status */}
        <Card className="border border-[#E2E8F0] bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>Ticket Status</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.ticket_status?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={charts.ticket_status} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: '#64748B' }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Tickets">
                    {charts.ticket_status.map((entry, i) => (
                      <Cell key={i} fill={TICKET_COLORS[entry.status] || "#64748B"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: '#64748B' }}>No tickets yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[#E2E8F0] bg-white">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Knowledge Base</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#64748B' }}>Modules</span><span className="text-sm font-semibold">{stats?.total_modules ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#64748B' }}>Knowledge Items</span><span className="text-sm font-semibold">{stats?.total_knowledge_items ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#64748B' }}>Conversations</span><span className="text-sm font-semibold">{stats?.total_conversations ?? 0}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[#E2E8F0] bg-white">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Feedback</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#64748B' }}>Total</span><span className="text-sm font-semibold">{stats?.total_feedback ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#64748B' }}>Helpful</span><span className="text-sm font-semibold text-[#10B981]">{stats?.helpful_count ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#64748B' }}>Not Helpful</span><span className="text-sm font-semibold text-[#EF4444]">{stats?.not_helpful_count ?? 0}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[#E2E8F0] bg-white">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Tickets</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#64748B' }}>Total</span><span className="text-sm font-semibold">{stats?.total_tickets ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: '#64748B' }}>Open</span><span className="text-sm font-semibold text-[#FF6B00]">{stats?.open_tickets ?? 0}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
