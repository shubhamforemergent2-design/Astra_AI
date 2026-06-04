import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, BookOpen, FolderOpen, Users, Cpu,
  Megaphone, Ticket, Sparkles, ArrowLeft, LogOut, HelpCircle, GraduationCap
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen },
  { to: "/admin/resources", label: "Resources", icon: FolderOpen },
  { to: "/admin/trained-answers", label: "Trained Answers", icon: GraduationCap },
  { to: "/admin/gap-analysis", label: "Knowledge Gaps", icon: HelpCircle },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/ai-config", label: "AI Config", icon: Cpu },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/tickets", label: "Tickets", icon: Ticket },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="h-screen flex bg-white" data-testid="admin-layout">
      {/* Admin Sidebar */}
      <div className="w-60 border-r border-[#E2E8F0] flex flex-col" style={{ background: '#0A101D' }}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FF6B00' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-white" style={{ fontFamily: 'Outfit' }}>Astra Admin</span>
          </div>
          <p className="text-xs text-slate-500 pl-10">Knowledge Management</p>
        </div>

        <ScrollArea className="flex-1 py-3">
          <nav className="px-3 space-y-0.5">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-white/10 text-white font-medium"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`
                }
                data-testid={`admin-nav-${label.toLowerCase().replace(/\s/g, '-')}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-3 border-t border-white/10 space-y-1">
          <button onClick={() => navigate("/")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 w-full transition-colors"
            data-testid="back-to-chat">
            <ArrowLeft className="w-4 h-4" /> Back to Chat
          </button>
          <button onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-white hover:bg-white/5 w-full transition-colors"
            data-testid="admin-logout">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
          <div className="px-3 pt-2">
            <p className="text-xs text-slate-600 truncate">{user?.name}</p>
            <p className="text-xs text-slate-700 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        <ScrollArea className="flex-1">
          <div className="p-8">
            <Outlet />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
