import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Cpu, Save, Eye, EyeOff } from "lucide-react";

const PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-5.2", "gpt-5.4", "gpt-4o", "gpt-4.1"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"] },
  { value: "gemini", label: "Google Gemini", models: ["gemini-3-flash-preview", "gemini-3.1-pro-preview", "gemini-2.5-pro"] },
];

export default function AIConfig() {
  const [config, setConfig] = useState({ provider: "openai", model: "gpt-5.2", api_key: "", system_prompt: "" });
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
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Configure the AI provider and model for Astra</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <Card className="border border-[#E2E8F0] bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ fontFamily: 'Outfit' }}>System Prompt</CardTitle>
            <CardDescription>Custom instructions for Astra (prepended to default prompt)</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={config.system_prompt}
              onChange={(e) => setConfig((p) => ({ ...p, system_prompt: e.target.value }))}
              placeholder="Add custom instructions for Astra here. These will be prepended to the default system prompt..."
              className="min-h-[200px]" data-testid="ai-system-prompt" />
          </CardContent>
        </Card>
      </div>

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
