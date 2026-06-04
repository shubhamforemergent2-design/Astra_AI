import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Cpu, Save, Eye, EyeOff, AlertTriangle, Lightbulb } from "lucide-react";

const PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-5.2", "gpt-5.4", "gpt-4o", "gpt-4.1"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"] },
  { value: "gemini", label: "Google Gemini", models: ["gemini-3-flash-preview", "gemini-3.1-pro-preview", "gemini-2.5-pro"] },
];

export default function AIConfig() {
  const [config, setConfig] = useState({
    provider: "openai", model: "gpt-5.2", api_key: "", system_prompt: "",
    fallback_message: "", fallback_button_text: "", fallback_button_link: "", show_raise_ticket: true,
    enable_suggestions: true, max_suggestions: 3, confidence_threshold: 1.5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    api.get("/admin/ai-config")
      .then(({ data }) => setConfig({
        provider: data.provider || "openai",
        model: data.model || "gpt-5.2",
        api_key: data.api_key || "",
        system_prompt: data.system_prompt || "",
        fallback_message: data.fallback_message || "I couldn't find relevant information in our knowledge base for your question.",
        fallback_button_text: data.fallback_button_text || "Raise Support Ticket",
        fallback_button_link: data.fallback_button_link || "",
        show_raise_ticket: data.show_raise_ticket !== false,
        enable_suggestions: data.enable_suggestions !== false,
        max_suggestions: data.max_suggestions || 3,
        confidence_threshold: data.confidence_threshold || 1.5,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/admin/ai-config", config);
      toast.success("AI configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = PROVIDERS.find((p) => p.value === config.provider);
  if (loading) return <div className="text-[#64748B]">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="ai-config">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Outfit', color: '#0A101D' }}>AI Configuration</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Configure the AI provider, model, and fallback behavior for Astra</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider & Model */}
        <Card className="border border-[#E2E8F0] bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
              <Cpu className="w-4 h-4 text-[#FF6B00]" /> Provider & Model
            </CardTitle>
            <CardDescription>Select the AI provider and model to use</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="mb-2 block">Provider</Label>
              <Select value={config.provider} onValueChange={(v) => setConfig((p) => ({ ...p, provider: v, model: PROVIDERS.find((x) => x.value === v)?.models[0] || "" }))}>
                <SelectTrigger data-testid="ai-provider-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Model</Label>
              <Select value={config.model} onValueChange={(v) => setConfig((p) => ({ ...p, model: v }))}>
                <SelectTrigger data-testid="ai-model-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(currentProvider?.models || []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">API Key</Label>
              <div className="relative">
                <Input type={showKey ? "text" : "password"} value={config.api_key}
                  onChange={(e) => setConfig((p) => ({ ...p, api_key: e.target.value }))}
                  placeholder="Leave empty to use default (Emergent key)"
                  className="pr-10" data-testid="ai-api-key-input" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#64748B' }}>Leave empty to use the default Emergent LLM key</p>
            </div>
          </CardContent>
        </Card>

        {/* System Prompt */}
        <Card className="border border-[#E2E8F0] bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>System Prompt</CardTitle>
            <CardDescription>Custom instructions prepended to Astra's default prompt</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={config.system_prompt}
              onChange={(e) => setConfig((p) => ({ ...p, system_prompt: e.target.value }))}
              placeholder="Add custom instructions for Astra here..."
              className="min-h-[200px]" data-testid="ai-system-prompt" />
          </CardContent>
        </Card>
      </div>

      {/* Fallback Configuration */}
      <Card className="border border-[#E2E8F0] bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" /> Fallback Configuration
          </CardTitle>
          <CardDescription>Configure what users see when Astra can't find an answer in the knowledge base</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <Label className="mb-2 block">Fallback Message</Label>
              <Textarea value={config.fallback_message}
                onChange={(e) => setConfig((p) => ({ ...p, fallback_message: e.target.value }))}
                placeholder="I couldn't find relevant information..."
                className="min-h-[80px]" data-testid="fallback-message-input" />
            </div>
            <div>
              <Label className="mb-2 block">Button Text</Label>
              <Input value={config.fallback_button_text}
                onChange={(e) => setConfig((p) => ({ ...p, fallback_button_text: e.target.value }))}
                placeholder="Raise Support Ticket" data-testid="fallback-button-text-input" />
            </div>
            <div>
              <Label className="mb-2 block">Button Link (optional)</Label>
              <Input value={config.fallback_button_link}
                onChange={(e) => setConfig((p) => ({ ...p, fallback_button_link: e.target.value }))}
                placeholder="https://support.biziverse.com" data-testid="fallback-button-link-input" />
              <p className="text-xs mt-1" style={{ color: '#64748B' }}>If empty, button will open the ticket dialog</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={config.show_raise_ticket}
                onCheckedChange={(v) => setConfig((p) => ({ ...p, show_raise_ticket: v }))}
                data-testid="fallback-show-ticket-switch" />
              <Label>Show Raise Ticket button in fallback</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestion Configuration */}
      <Card className="border border-[#E2E8F0] bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
            <Lightbulb className="w-4 h-4 text-[#3B82F6]" /> Smart Suggestions
          </CardTitle>
          <CardDescription>When Astra isn't confident, suggest relevant KB questions instead of answering</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex items-center gap-3">
              <Switch checked={config.enable_suggestions}
                onCheckedChange={(v) => setConfig((p) => ({ ...p, enable_suggestions: v }))}
                data-testid="enable-suggestions-switch" />
              <Label>Enable question suggestions</Label>
            </div>
            <div>
              <Label className="mb-2 block">Max Suggestions (1-5)</Label>
              <Input type="number" min={1} max={5} value={config.max_suggestions}
                onChange={(e) => setConfig((p) => ({ ...p, max_suggestions: parseInt(e.target.value) || 3 }))}
                data-testid="max-suggestions-input" />
            </div>
            <div>
              <Label className="mb-2 block">Confidence Threshold</Label>
              <Input type="number" step="0.1" min={0.5} max={5} value={config.confidence_threshold}
                onChange={(e) => setConfig((p) => ({ ...p, confidence_threshold: parseFloat(e.target.value) || 1.5 }))}
                data-testid="confidence-threshold-input" />
              <p className="text-xs mt-1" style={{ color: '#64748B' }}>Higher = stricter matching. AI only answers above this score.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2 text-white" style={{ background: '#FF6B00' }} data-testid="save-ai-config-button">
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Configuration"}
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{config.provider}</Badge>
          <Badge variant="outline" className="text-xs">{config.model}</Badge>
        </div>
      </div>
    </div>
  );
}
