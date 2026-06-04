import { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(true);
      if (data.reset_token) setResetToken(data.reset_token);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#FF6B00' }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Astra</span>
        </div>

        {!sent ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight mb-1" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Reset Password</h2>
            <p className="text-sm mb-6" style={{ color: '#64748B' }}>Enter your email to receive a password reset link</p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="you@company.com" className="h-11 border-[#E2E8F0] focus:border-[#FF6B00] focus:ring-[#FF6B00]"
                  data-testid="forgot-email-input" />
              </div>
              {error && <p className="text-sm text-[#EF4444]" data-testid="forgot-error">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full h-11 text-white font-semibold" style={{ background: '#FF6B00' }}
                data-testid="forgot-submit-button">
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center" data-testid="forgot-success">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#FFF0E5' }}>
              <Mail className="w-7 h-7 text-[#FF6B00]" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>Check Your Email</h2>
            <p className="text-sm mb-6" style={{ color: '#64748B' }}>If an account exists, a reset link has been generated.</p>
            {resetToken && (
              <div className="mb-6 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="text-xs font-semibold mb-1" style={{ color: '#64748B' }}>Reset Token (dev mode):</p>
                <code className="text-xs break-all" style={{ color: '#0A101D' }}>{resetToken}</code>
                <Link to={`/reset-password?token=${resetToken}`}
                  className="block mt-3 text-sm font-medium text-[#FF6B00] hover:underline" data-testid="reset-link">
                  Click here to reset password
                </Link>
              </div>
            )}
          </div>
        )}

        <Link to="/login" className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-[#64748B] hover:text-[#FF6B00] transition-colors"
          data-testid="back-to-login">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}
