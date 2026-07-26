import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { DoorOpen, Eye, EyeOff, Loader2, Lock, User, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

/** صفحة تسجيل دخول وإنشاء حساب المستخدمين */
export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPass, setShowPass] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [regForm, setRegForm] = useState({ name: "", username: "", password: "" });

  const loginMutation = trpc.account.login.useMutation({
    onSuccess: data => {
      try {
        if (data.sessionToken) localStorage.setItem("platform_session_token", data.sessionToken);
      } catch {}
      // تعيين الحساب مباشرة في الكاش لمنع سباق الحالة الذي يعيد المستخدم لصفحة الدخول
      utils.account.me.setData(undefined, data);
      toast.success("تم تسجيل الدخول بنجاح، أهلاً بك");
      navigate("/platform");
    },
    onError: e => toast.error(e.message),
  });

  const registerMutation = trpc.account.register.useMutation({
    onSuccess: data => {
      try {
        if (data.sessionToken) localStorage.setItem("platform_session_token", data.sessionToken);
      } catch {}
      utils.account.me.setData(undefined, data);
      toast.success("تم إنشاء حسابك بنجاح، أهلاً بك");
      navigate("/platform");
    },
    onError: e => toast.error(e.message),
  });

  const busy = loginMutation.isPending || registerMutation.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "login") {
      if (!loginForm.username.trim() || !loginForm.password) {
        toast.error("املأ جميع الحقول من فضلك");
        return;
      }
      loginMutation.mutate(loginForm);
    } else {
      if (!regForm.name.trim() || !regForm.username.trim() || !regForm.password) {
        toast.error("املأ جميع الحقول من فضلك");
        return;
      }
      registerMutation.mutate(regForm);
    }
  }

  return (
    <div className="min-h-screen pattern-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex flex-col items-center gap-3 mb-8 group">
          <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <DoorOpen className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-foreground">أبواب التطوير المهني</h1>
            <p className="text-sm text-muted-foreground mt-1">منصة المعلم للنمو والتميز</p>
          </div>
        </Link>

        <Card className="card-elegant border-0">
          <CardContent className="pt-6">
            <div className="flex rounded-xl bg-muted p-1 mb-6">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "login" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}>
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "register" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}>
                حساب جديد
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <div className="relative">
                    <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      className="pr-10"
                      placeholder="مثال: أحمد محمد"
                      value={regForm.name}
                      onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    className="pr-10"
                    dir="ltr"
                    placeholder="username"
                    autoComplete="username"
                    value={mode === "login" ? loginForm.username : regForm.username}
                    onChange={e =>
                      mode === "login"
                        ? setLoginForm({ ...loginForm, username: e.target.value })
                        : setRegForm({ ...regForm, username: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    className="pr-10 pl-10"
                    dir="ltr"
                    type={showPass ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    value={mode === "login" ? loginForm.password : regForm.password}
                    onChange={e =>
                      mode === "login"
                        ? setLoginForm({ ...loginForm, password: e.target.value })
                        : setRegForm({ ...regForm, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === "register" && (
                  <p className="text-xs text-muted-foreground">4 أحرف على الأقل، بدون شروط معقدة</p>
                )}
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={busy}>
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === "login" ? (
                  "دخول المنصة"
                ) : (
                  "إنشاء الحساب والدخول"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          هل أنت مشرف المنصة؟{" "}
          <Link href="/admin/login" className="text-primary font-medium hover:underline">
            دخول المشرف
          </Link>
        </p>
      </div>
    </div>
  );
}
