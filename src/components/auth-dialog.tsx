"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogInIcon } from "lucide-react";
import { toast } from "sonner";

interface AuthDialogProps {
  onAuthenticated: (user: {
    id: string;
    username: string;
    pseudo: string;
    isAnonymous: boolean;
  }) => void;
}

export function AuthDialog({ onAuthenticated }: AuthDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login form
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [regUsername, setRegUsername] = useState("");
  const [regPseudo, setRegPseudo] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          username: loginUsername,
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur de connexion");
        return;
      }

      toast.success("Connexion réussie");
      onAuthenticated(data);
      setOpen(false);
      resetForms();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          username: regUsername,
          pseudo: regPseudo,
          password: regPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        return;
      }

      toast.success("Compte créé avec succès");
      onAuthenticated(data);
      setOpen(false);
      resetForms();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const resetForms = () => {
    setLoginUsername("");
    setLoginPassword("");
    setRegUsername("");
    setRegPseudo("");
    setRegPassword("");
    setError("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForms();
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        <LogInIcon data-icon="inline-start" />
        Connexion
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connexion / Inscription</DialogTitle>
          <DialogDescription>
            Créez un compte pour retrouver vos fichiers sur tous vos appareils.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="register">Inscription</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="login-username">Identifiant</Label>
                <Input
                  id="login-username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Mot de passe</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-username">Identifiant</Label>
                <Input
                  id="reg-username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="lettres, chiffres, _"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={30}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-pseudo">Pseudo</Label>
                <Input
                  id="reg-pseudo"
                  value={regPseudo}
                  onChange={(e) => setRegPseudo(e.target.value)}
                  placeholder="Votre nom d'affichage"
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password">Mot de passe</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Inscription..." : "Créer un compte"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
