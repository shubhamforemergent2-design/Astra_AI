import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowLeft, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white" data-testid="reset-password-page">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#FF6B00' }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Astra</span>
        </div>

        {success ? (
          <div className="text-center" data-testid="reset-success">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#ECFDF5' }}>
              <CheckCircle className="w-7 h-7 text-[#10B981]" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Password Reset</h2>
            <p className="text-sm" style={{ color: '#64748B' }}>Redirecting to sign in...</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold tracking-tight mb-1" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Set New Password</h2>
            <p className="text-sm mb-6" style={{ color: '#64748B' }}>Enter your new password below</p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  placeholder="Min 6 characters" className="h-11 border-[#E2E8F0] focus:border-[#FF6B00] focus:ring-[#FF6B00]"
                  data-testid="reset-password-input" />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                  placeholder="Repeat password" className="h-11 border-[#E2E8F0] focus:border-[#FF6B00] focus:ring-[#FF6B00]"
                  data-testid="reset-confirm-input" />
              </div>
              {error && <p className="text-sm text-[#EF4444]" data-testid="reset-error">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full h-11 text-white font-semibold" style={{ background: '#FF6B00' }}
                data-testid="reset-submit-button">
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          </>
        )}

        <Link to="/login" className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-[#64748B] hover:text-[#FF6B00] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}
