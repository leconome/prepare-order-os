"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_URL = process.env.NEXT_PUBLIC_STORE_API_URL || "";

export function ExportTab() {
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/orders/export?format=${format}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Echec de l'export");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commandes-${date}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Echec de l'export");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exporter les commandes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Format</label>
          <Select
            value={format}
            onValueChange={(v) => setFormat(v as "csv" | "xlsx")}
          >
            <SelectTrigger className="w-[200px] mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (.csv)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleExport} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generation en cours...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Telecharger
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
