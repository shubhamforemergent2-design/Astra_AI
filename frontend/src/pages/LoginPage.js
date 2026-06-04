import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left side - Brand */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #0A101D 0%, #0F172A 100%)' }}>
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, #FF6B00 0%, transparent 50%), radial-gradient(circle at 70% 80%, #FF6B00 0%, transparent 50%)' }} />
        <div className="relative z-10 px-16 max-w-lg">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#FF6B00' }}>
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>Astra</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Your AI Knowledge Assistant
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Get instant answers about Biziverse features, workflows, and troubleshooting. 
            Powered by your organization's approved knowledge base.
          </p>
          <div className="mt-12 flex gap-8">
            <div>
              <div className="text-2xl font-bold text-white">Instant</div>
              <div className="text-sm text-slate-500">Answers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">Structured</div>
              <div className="text-sm text-slate-500">Responses</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">24/7</div>
              <div className="text-sm text-slate-500">Available</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#FF6B00' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Astra</span>
          </div>

          <Tabs value={tab} onValueChange={(v) => { setTab(v); setError(""); }}>
            <TabsList className="w-full mb-8 bg-[#F1F5F9]">
              <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-[#0A101D] data-[state=active]:shadow-sm" data-testid="login-tab">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-[#0A101D] data-[state=active]:shadow-sm" data-testid="register-tab">
                Create Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Welcome back</h2>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>Sign in to continue to Astra</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium" style={{ color: '#334155' }}>Email</Label>
                  <Input id="login-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="h-11 border-[#E2E8F0] focus:border-[#FF6B00] focus:ring-[#FF6B00]" data-testid="login-email-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium" style={{ color: '#334155' }}>Password</Label>
                  <div className="relative">
                    <Input id="login-password" type={showPw ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required
                      className="h-11 pr-10 border-[#E2E8F0] focus:border-[#FF6B00] focus:ring-[#FF6B00]" data-testid="login-password-input" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#334155]" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-[#EF4444]" data-testid="auth-error">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full h-11 text-white font-semibold"
                  style={{ background: '#FF6B00' }}
                  data-testid="login-submit-button">
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Get Started</h2>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>Create your Astra account</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-sm font-medium" style={{ color: '#334155' }}>Full Name</Label>
                  <Input id="reg-name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required
                    className="h-11 border-[#E2E8F0] focus:border-[#FF6B00] focus:ring-[#FF6B00]" data-testid="register-name-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-sm font-medium" style={{ color: '#334155' }}>Email</Label>
                  <Input id="reg-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="h-11 border-[#E2E8F0] focus:border-[#FF6B00] focus:ring-[#FF6B00]" data-testid="register-email-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-sm font-medium" style={{ color: '#334155' }}>Password</Label>
                  <div className="relative">
                    <Input id="reg-password" type={showPw ? "text" : "password"} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required
                      className="h-11 pr-10 border-[#E2E8F0] focus:border-[#FF6B00] focus:ring-[#FF6B00]" data-testid="register-password-input" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#334155]" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-[#EF4444]" data-testid="auth-error">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full h-11 text-white font-semibold"
                  style={{ background: '#FF6B00' }}
                  data-testid="register-submit-button">
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
