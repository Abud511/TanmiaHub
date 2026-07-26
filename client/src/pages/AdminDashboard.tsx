import { DoorIcon } from "@/components/DoorIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "@/hooks/useAccount";
import { trpc } from "@/lib/trpc";
import { doorsData, LEVEL_NAMES } from "@shared/doors";
import {
  Award,
  BarChart3,
  DoorOpen,
  FileText,
  ImageIcon,
  KeyRound,
  Loader2,
  LogOut,
  NotebookPen,
  Paperclip,
  Printer,
  ShieldCheck,
  Star,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useLocation } from "wouter";

function doorTitle(doorId: string) {
  return doorsData.find(d => d.id === doorId)?.title ?? doorId;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

/** لوحة تحكم المشرف: داشبورد إحصائي + متابعة المستخدمين والخطط */
export default function AdminDashboard() {
  const { account, isLoading, isAdmin, logout } = useAccount();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [reportTarget, setReportTarget] = useState<{ id: number; name: string } | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: usersList, isLoading: usersLoading } = trpc.admin.users.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: plansList, isLoading: plansLoading } = trpc.admin.plans.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: evidencesList, isLoading: evidencesLoading } = trpc.admin.evidences.useQuery(
    undefined,
    { enabled: isAdmin },
  );
  const { data: report, isLoading: reportLoading } = trpc.admin.teacherReport.useQuery(
    { accountId: reportTarget?.id ?? 0 },
    { enabled: isAdmin && !!reportTarget },
  );

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      utils.admin.users.invalidate();
      utils.admin.stats.invalidate();
      utils.admin.plans.invalidate();
      setDeleteTarget(null);
      toast.success("تم حذف الحساب وجميع بياناته");
    },
    onError: e => toast.error(e.message),
  });

  const resetPassword = trpc.admin.resetUserPassword.useMutation({
    onSuccess: () => {
      setResetTarget(null);
      setNewPassword("");
      toast.success("تم تغيير كلمة المرور بنجاح، زوّد المستخدم بها");
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/admin/login");
  }, [isLoading, isAdmin, navigate]);

  const chartData = useMemo(() => {
    if (!stats) return [];
    return stats.doorCompletions.slice(0, 8).map(d => ({
      name: doorTitle(d.doorId),
      count: d.count,
    }));
  }, [stats]);

  if (isLoading || !account || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const topDoor = stats?.doorCompletions[0];

  return (
    <div className="min-h-screen bg-secondary/40 pb-16">
      {/* الترويسة */}
      <header className="bg-[oklch(0.2_0.03_175)] text-white sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold text-[oklch(0.25_0.05_85)] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold">لوحة تحكم المشرف</span>
              <p className="text-xs text-white/60 hidden sm:block">منصة أبواب التطوير المهني</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70 hidden sm:block">{account.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              title="تسجيل الخروج"
              onClick={() => {
                logout();
                navigate("/");
              }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container pt-8">
        {/* بطاقات الإحصائيات */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[
            {
              label: "إجمالي المستخدمين",
              value: stats?.totalUsers ?? "—",
              icon: Users,
              tint: "bg-primary/10 text-primary",
            },
            {
              label: "متوسط النقاط",
              value: stats?.avgPoints ?? "—",
              icon: Star,
              tint: "bg-gold/20 text-[oklch(0.55_0.12_85)]",
            },
            {
              label: "أكثر الأبواب إنجازاً",
              value: topDoor ? doorTitle(topDoor.doorId) : "لا يوجد بعد",
              icon: TrendingUp,
              tint: "bg-primary/10 text-primary",
              small: true,
            },
            {
              label: "الخطط المكتوبة",
              value: stats?.totalPlans ?? "—",
              icon: NotebookPen,
              tint: "bg-gold/20 text-[oklch(0.55_0.12_85)]",
            },
          ].map(s => (
            <Card key={s.label} className="card-elegant border-0">
              <CardContent className="pt-6">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${s.tint}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className={s.small ? "text-lg font-bold leading-snug" : "text-3xl font-bold"}>
                  {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : s.value}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" dir="rtl">
          <TabsList className="mb-6 bg-card card-elegant h-11">
            <TabsTrigger value="overview" className="gap-2 px-5">
              <BarChart3 className="w-4 h-4" />
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 px-5">
              <Users className="w-4 h-4" />
              المستخدمون
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2 px-5">
              <NotebookPen className="w-4 h-4" />
              الخطط التطبيقية
            </TabsTrigger>
            <TabsTrigger value="evidences" className="gap-2 px-5">
              <Paperclip className="w-4 h-4" />
              الشواهد
            </TabsTrigger>
          </TabsList>

          {/* نظرة عامة */}
          <TabsContent value="overview">
            <Card className="card-elegant border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  إنجاز الأبواب التدريبية
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    لا توجد إنجازات مسجلة بعد
                  </div>
                ) : (
                  <div className="h-80" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 120)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fontFamily: "IBM Plex Sans Arabic" }}
                          angle={-20}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            fontFamily: "IBM Plex Sans Arabic",
                            borderRadius: 12,
                            direction: "rtl",
                          }}
                          formatter={(v: number) => [`${v} إنجاز`, "العدد"]}
                        />
                        <Bar dataKey="count" fill="oklch(0.42 0.09 175)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* المستخدمون */}
          <TabsContent value="users">
            <Card className="card-elegant border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  المستخدمون المسجلون ({usersList?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !usersList || usersList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    لم يسجل أي مستخدم بعد
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الاسم</TableHead>
                          <TableHead className="text-right">اسم المستخدم</TableHead>
                          <TableHead className="text-right">النقاط</TableHead>
                          <TableHead className="text-right">المستوى</TableHead>
                          <TableHead className="text-right">الشارات</TableHead>
                          <TableHead className="text-right">الأبواب المنجزة</TableHead>
                          <TableHead className="text-right">تاريخ التسجيل</TableHead>
                          <TableHead className="text-right">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usersList.map(u => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell dir="ltr" className="text-right text-muted-foreground">
                              {u.username}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-gold" />
                                {u.points}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{LEVEL_NAMES[u.level - 1]}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-gold" />
                                <span className="font-medium">{u.badges.length}</span>
                                <span className="text-muted-foreground text-xs">شارة</span>
                              </span>
                            </TableCell>
                            <TableCell>
                              {u.badges.length === 0 ? (
                                <span className="text-muted-foreground text-sm">لا يوجد بعد</span>
                              ) : (
                                <div className="space-y-1 max-w-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium shrink-0">
                                      {u.badges.length} من {doorsData.length}
                                    </span>
                                    <Progress
                                      value={(u.badges.length / doorsData.length) * 100}
                                      className="h-2 w-20"
                                    />
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {Math.round((u.badges.length / doorsData.length) * 100)}%
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {u.badges.map(b => {
                                      const door = doorsData.find(d => d.id === b);
                                      return (
                                        <span
                                          key={b}
                                          title={door?.title}
                                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-0.5 text-xs">
                                          <DoorIcon name={door?.icon ?? ""} className="w-3 h-3" />
                                          {door?.title ?? b}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(u.createdAt).toLocaleDateString("ar-SA")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-primary hover:text-primary"
                                  title="تقرير شامل"
                                  onClick={() => setReportTarget({ id: u.id, name: u.name })}>
                                  <FileText className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  title="إعادة تعيين كلمة المرور"
                                  onClick={() => {
                                    setResetTarget({ id: u.id, name: u.name });
                                    setNewPassword("");
                                  }}>
                                  <KeyRound className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="حذف الحساب"
                                  onClick={() => setDeleteTarget({ id: u.id, name: u.name })}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* الخطط */}
          <TabsContent value="plans">
            <Card className="card-elegant border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <NotebookPen className="w-5 h-5 text-primary" />
                  الخطط التطبيقية ({plansList?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !plansList || plansList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    لم تُكتب أي خطط تطبيقية بعد
                  </div>
                ) : (
                  <div className="space-y-4">
                    {plansList.map(p => (
                      <div key={p.id} className="border border-border rounded-xl p-5 bg-secondary/50">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{p.accountName}</span>
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              @{p.accountUsername}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                              <DoorOpen className="w-3 h-3" />
                              {doorTitle(p.doorId)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(p.createdAt).toLocaleDateString("ar-SA")}
                            </span>
                          </div>
                        </div>
                        <p className="leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          {p.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* الشواهد */}
          <TabsContent value="evidences">
            <Card className="card-elegant border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-primary" />
                  الشواهد المرفوعة ({evidencesList?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evidencesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !evidencesList || evidencesList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    لم يرفع أي مستخدم شواهد بعد
                  </div>
                ) : (
                  <div className="space-y-4">
                    {evidencesList.map(ev => (
                      <div
                        key={ev.id}
                        className="border border-border rounded-xl p-5 bg-secondary/50">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{ev.accountName}</span>
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              @{ev.accountUsername}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                              <DoorOpen className="w-3 h-3" />
                              {doorTitle(ev.doorId)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(ev.createdAt).toLocaleDateString("ar-SA")}
                            </span>
                          </div>
                        </div>
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                          {ev.mimeType.startsWith("image/") ? (
                            <ImageIcon className="w-4 h-4 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate">{ev.fileName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ({formatFileSize(ev.fileSize)})
                          </span>
                        </a>
                        {ev.mimeType.startsWith("image/") && (
                          <a href={ev.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={ev.url}
                              alt={ev.fileName}
                              className="mt-3 rounded-lg max-h-48 object-contain border border-border/50"
                            />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* حوار التقرير الشامل للمعلم */}
      <Dialog open={!!reportTarget} onOpenChange={o => !o && setReportTarget(null)}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto print-report-dialog">
          <DialogHeader className="text-right print-hide">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              التقرير الشامل — {reportTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-right">
              تقرير مفصل عن تقدم المعلم: النقاط، الأبواب المنجزة، الخطط التطبيقية، والشواهد
            </DialogDescription>
          </DialogHeader>

          {reportLoading || !report ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="print-report space-y-6">
              {/* ترويسة التقرير للطباعة */}
              <div className="hidden print:block text-center border-b border-border pb-4">
                <h1 className="text-2xl font-bold">منصة أبواب التطوير المهني</h1>
                <p className="text-muted-foreground mt-1">تقرير شامل عن المعلم</p>
              </div>

              {/* البيانات الأساسية */}
              <div className="border border-border rounded-xl p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  البيانات الأساسية
                </h3>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">الاسم</span>
                    <span className="font-medium">{report.account.name}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">اسم المستخدم</span>
                    <span className="font-medium" dir="ltr">
                      @{report.account.username}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">النقاط</span>
                    <span className="font-medium">{report.account.points} نقطة</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">المستوى</span>
                    <span className="font-medium">
                      {LEVEL_NAMES[report.account.level - 1]}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">تاريخ التسجيل</span>
                    <span className="font-medium">
                      {new Date(report.account.createdAt).toLocaleDateString("ar-SA")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">آخر دخول</span>
                    <span className="font-medium">
                      {report.account.lastSignedIn
                        ? new Date(report.account.lastSignedIn).toLocaleDateString("ar-SA")
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* الأبواب المنجزة */}
              <div className="border border-border rounded-xl p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  الأبواب المنجزة ({report.completions.length} من {doorsData.length})
                </h3>
                <div className="mb-3">
                  <Progress
                    value={(report.completions.length / doorsData.length) * 100}
                    className="h-2.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    نسبة الإنجاز:{" "}
                    {Math.round((report.completions.length / doorsData.length) * 100)}%
                  </p>
                </div>
                {report.completions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لم ينجز أي باب بعد</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {report.completions.map(c => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-2.5 py-1 text-xs">
                        <DoorIcon
                          name={doorsData.find(d => d.id === c.doorId)?.icon ?? ""}
                          className="w-3 h-3"
                        />
                        {doorTitle(c.doorId)}
                        <span className="text-muted-foreground">
                          — {new Date(c.createdAt).toLocaleDateString("ar-SA")}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* الخطط التطبيقية */}
              <div className="border border-border rounded-xl p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <NotebookPen className="w-4 h-4 text-primary" />
                  الخطط التطبيقية ({report.plans.length})
                </h3>
                {report.plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لم يكتب أي خطة بعد</p>
                ) : (
                  <div className="space-y-3">
                    {report.plans.map(p => (
                      <div key={p.id} className="bg-secondary/60 rounded-lg p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <Badge variant="outline" className="gap-1">
                            <DoorOpen className="w-3 h-3" />
                            {doorTitle(p.doorId)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString("ar-SA")}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* الشواهد */}
              <div className="border border-border rounded-xl p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-primary" />
                  الشواهد المرفوعة ({report.evidences.length})
                </h3>
                {report.evidences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لم يرفع أي شاهد بعد</p>
                ) : (
                  <div className="space-y-3">
                    {report.evidences.map(ev => (
                      <div key={ev.id} className="bg-secondary/60 rounded-lg p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <Badge variant="outline" className="gap-1">
                            <DoorOpen className="w-3 h-3" />
                            {doorTitle(ev.doorId)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(ev.createdAt).toLocaleDateString("ar-SA")}
                          </span>
                        </div>
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                          {ev.mimeType.startsWith("image/") ? (
                            <ImageIcon className="w-4 h-4 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate">{ev.fileName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ({formatFileSize(ev.fileSize)})
                          </span>
                        </a>
                        {ev.mimeType.startsWith("image/") && (
                          <img
                            src={ev.url}
                            alt={ev.fileName}
                            className="mt-2 rounded-lg max-h-40 object-contain border border-border/50"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 print-hide">
            <Button variant="ghost" onClick={() => setReportTarget(null)}>
              إغلاق
            </Button>
            <Button
              disabled={reportLoading || !report}
              onClick={() => window.print()}
              className="gap-2">
              <Printer className="w-4 h-4" />
              طباعة / حفظ PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تأكيد حذف الحساب */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader className="text-right">
            <DialogTitle>حذف حساب المستخدم</DialogTitle>
            <DialogDescription className="text-right leading-relaxed">
              هل أنت متأكد من حذف حساب <span className="font-bold text-foreground">{deleteTarget?.name}</span>؟
              سيتم حذف جميع بياناته (النقاط، الشارات، الخطط) نهائياً ولا يمكن التراجع.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => deleteTarget && deleteUser.mutate({ accountId: deleteTarget.id })}>
              {deleteUser.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "نعم، احذف الحساب"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار إعادة تعيين كلمة المرور */}
      <Dialog open={!!resetTarget} onOpenChange={o => !o && setResetTarget(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader className="text-right">
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription className="text-right leading-relaxed">
              تعيين كلمة مرور جديدة للمستخدم{" "}
              <span className="font-bold text-foreground">{resetTarget?.name}</span>. زوّده بها
              بعد الحفظ ليتمكن من الدخول.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newPass">كلمة المرور الجديدة</Label>
            <Input
              id="newPass"
              dir="ltr"
              type="text"
              placeholder="4 أحرف على الأقل"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setResetTarget(null)}>
              إلغاء
            </Button>
            <Button
              disabled={resetPassword.isPending || newPassword.length < 4}
              onClick={() =>
                resetTarget &&
                resetPassword.mutate({ accountId: resetTarget.id, newPassword })
              }>
              {resetPassword.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "حفظ كلمة المرور"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
