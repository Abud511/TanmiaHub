import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

/** صفحة دخول المشرف - حصرية للبريد الإداري المعتمد */
export default function AdminLogin() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const adminLogin = trpc.account.adminLogin.useMutation({
    onSuccess: data => {
      try {
        if (data.sessionToken) localStorage.setItem("platform_session_token", data.sessionToken);
      } catch {}
      // تعيين الحساب مباشرة في الكاش لمنع سباق الحالة الذي يعيد المستخدم لصفحة الدخول
      utils.account.me.setData(undefined, data);
      toast.success("مرحباً بك في لوحة التحكم");
      navigate("/admin");
    },
    onError: e => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("املأ جميع الحقول من فضلك");
      return;
    }
    adminLogin.mutate({ email, password });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[oklch(0.2_0.03_175)]">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, oklch(0.42 0.09 175 / 40%) 0%, transparent 50%), radial-gradient(circle at 80% 70%, oklch(0.75 0.12 85 / 20%) 0%, transparent 50%)",
        }}
      />
      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gold text-[oklch(0.25_0.05_85)] flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-white">بوابة الإشراف</h1>
            <p className="text-sm text-white/60 mt-1">الدخول مخصص لإدارة المنصة فقط</p>
          </div>
        </div>

        <Card className="card-elegant border-0">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminEmail">البريد الإلكتروني الإداري</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="adminEmail"
                    className="pr-10"
                    dir="ltr"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPass">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="adminPass"
                    className="pr-10 pl-10"
                    dir="ltr"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 text-base" disabled={adminLogin.isPending}>
                {adminLogin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "دخول لوحة التحكم"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-sm text-white/60">
          <Link href="/login" className="text-gold font-medium hover:underline">
            العودة لدخول المتدربين
          </Link>
        </p>
      </div>
    </div>
  );
}
