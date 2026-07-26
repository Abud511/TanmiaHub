import { DoorIcon } from "@/components/DoorIcon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/hooks/useAccount";
import { trpc } from "@/lib/trpc";
import { computeLevel, type Door, doorsData, LEVEL_NAMES, levelProgress } from "@shared/doors";
import {
  Award,
  CheckCircle2,
  DoorOpen,
  FileText,
  Heart,
  ImageIcon,
  Loader2,
  LogOut,
  Medal,
  NotebookPen,
  Paperclip,
  Pencil,
  Search,
  Star,
  Trash2,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

/** أنواع ملفات الشواهد المسموح بها */
const EVIDENCE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx";
const EVIDENCE_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const EVIDENCE_MAX_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

/** المنصة الرئيسية للمتدرب: الأبواب الـ 16 مع النقاط والشارات والخطط */
export default function Platform() {
  const { account, isLoading, isAuthenticated, logout } = useAccount();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [openDoorId, setOpenDoorId] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [planText, setPlanText] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: progress } = trpc.progress.summary.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: myEvidences } = trpc.progress.myEvidences.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const completeDoor = trpc.progress.completeDoor.useMutation({
    onSuccess: res => {
      utils.progress.summary.invalidate();
      utils.account.me.invalidate();
      if (!res.alreadyCompleted) {
        toast.success("🎉 تهانينا! حصلت على 10 نقاط وشارة جديدة");
      }
    },
    onError: e => toast.error(e.message),
  });

  const toggleFav = trpc.progress.toggleFavorite.useMutation({
    onMutate: async ({ doorId }) => {
      await utils.progress.summary.cancel();
      const prev = utils.progress.summary.getData();
      if (prev) {
        const isFav = prev.favorites.includes(doorId);
        utils.progress.summary.setData(undefined, {
          ...prev,
          favorites: isFav ? prev.favorites.filter(f => f !== doorId) : [...prev.favorites, doorId],
        });
      }
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.progress.summary.setData(undefined, ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => utils.progress.summary.invalidate(),
  });

  const savePlan = trpc.progress.savePlan.useMutation({
    onSuccess: () => {
      utils.progress.summary.invalidate();
      setPlanText("");
      toast.success("تم حفظ خطتك بنجاح ✅");
    },
    onError: e => toast.error(e.message),
  });

  const updatePlan = trpc.progress.updatePlan.useMutation({
    onSuccess: () => {
      utils.progress.summary.invalidate();
      setEditingPlanId(null);
      setEditText("");
      toast.success("تم تعديل الخطة بنجاح ✅");
    },
    onError: e => toast.error(e.message),
  });

  const deletePlan = trpc.progress.deletePlan.useMutation({
    onSuccess: () => {
      utils.progress.summary.invalidate();
      setDeletingPlanId(null);
      toast.success("تم حذف الخطة");
    },
    onError: e => toast.error(e.message),
  });

  const uploadEvidence = trpc.progress.uploadEvidence.useMutation({
    onSuccess: () => {
      utils.progress.myEvidences.invalidate();
      toast.success("تم رفع الشاهد بنجاح ✅");
    },
    onError: e => toast.error(e.message),
  });

  const deleteEvidence = trpc.progress.deleteEvidence.useMutation({
    onSuccess: () => {
      utils.progress.myEvidences.invalidate();
      setDeletingEvidenceId(null);
      toast.success("تم حذف الشاهد");
    },
    onError: e => toast.error(e.message),
  });

  function handleEvidenceFile(file: File) {
    if (!openDoor) return;
    if (!EVIDENCE_ALLOWED_MIMES.includes(file.type)) {
      toast.error("نوع الملف غير مسموح. المسموح: صور أو PDF أو Word");
      return;
    }
    if (file.size > EVIDENCE_MAX_SIZE) {
      toast.error("حجم الملف يتجاوز الحد الأقصى (10 ميجابايت)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      uploadEvidence.mutate({
        doorId: openDoor.id,
        fileName: file.name,
        mimeType: file.type,
        data: base64,
      });
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login");
  }, [isLoading, isAuthenticated, navigate]);

  const filteredDoors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doorsData;
    return doorsData.filter(d => d.title.includes(q) || d.desc.includes(q));
  }, [search]);

  const openDoor: Door | null = useMemo(
    () => doorsData.find(d => d.id === openDoorId) ?? null,
    [openDoorId],
  );

  if (isLoading || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const points = progress?.points ?? account.points;
  const level = computeLevel(points);
  const badges = progress?.badges ?? [];
  const favorites = progress?.favorites ?? [];
  const plans = progress?.plans ?? [];
  const { percent, toNext } = levelProgress(points);
  const isDone = openDoor ? badges.includes(openDoor.id) : false;

  function handleClaim() {
    if (!openDoor) return;
    if (openDoor.quiz && quizAnswer === null) {
      toast.error("أجب على السؤال أولاً للحصول على النقاط");
      return;
    }
    if (openDoor.quiz && quizAnswer !== openDoor.quiz.ans) {
      toast.error("الإجابة غير صحيحة، حاول مرة أخرى");
      return;
    }
    completeDoor.mutate({ doorId: openDoor.id });
  }

  return (
    <div className="min-h-screen pattern-bg pb-16">
      {/* الترويسة */}
      <header className="border-b border-border/60 bg-card/70 backdrop-blur-md sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <DoorOpen className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg hidden md:block">
              أبواب التطوير المهني
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-4 py-1.5 text-sm font-medium">
              <Star className="w-4 h-4" />
              <span>{points} نقطة</span>
            </div>
            <span className="text-sm font-medium text-muted-foreground hidden lg:block">
              {account.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
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
        {/* بطاقة التقدم */}
        <section className="bg-card rounded-2xl card-elegant border border-border/50 p-6 lg:p-8 mb-10">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <p className="text-muted-foreground text-sm mb-1">مرحباً بعودتك،</p>
              <h1 className="font-display text-2xl lg:text-3xl font-bold mb-4">{account.name}</h1>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-medium">
                  <Medal className="w-4 h-4" />
                  {LEVEL_NAMES[level - 1]}
                </span>
                <span className="text-sm text-muted-foreground">
                  {level === 4 ? "وصلت لأعلى مستوى 🎊" : `${toNext} نقطة للمستوى التالي`}
                </span>
              </div>
              <Progress value={percent} className="h-2.5" />
            </div>
            <div className="flex gap-4">
              {[
                { label: "النقاط", value: points, icon: Star },
                { label: "الشارات", value: badges.length, icon: Award },
                { label: "الخطط", value: plans.length, icon: NotebookPen },
              ].map(s => (
                <div
                  key={s.label}
                  className="w-24 rounded-2xl bg-secondary text-center py-4 border border-border/50">
                  <s.icon className="w-5 h-5 mx-auto text-primary mb-1.5" />
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* البحث */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="font-display text-xl lg:text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-gold" />
            الأبواب التدريبية
          </h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pr-10 bg-card"
              placeholder="ابحث عن باب..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* شبكة الأبواب */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredDoors.map(door => {
            const done = badges.includes(door.id);
            const fav = favorites.includes(door.id);
            return (
              <button
                key={door.id}
                onClick={() => {
                  setOpenDoorId(door.id);
                  setQuizAnswer(null);
                  setPlanText("");
                }}
                className="text-right bg-card rounded-2xl p-6 card-elegant border border-border/50 relative group">
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  {done && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={e => {
                      e.stopPropagation();
                      toggleFav.mutate({ doorId: door.id });
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        toggleFav.mutate({ doorId: door.id });
                      }
                    }}
                    title={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"}>
                    <Heart
                      className={`w-5 h-5 transition-colors ${fav ? "fill-red-500 text-red-500" : "text-border group-hover:text-muted-foreground"}`}
                    />
                  </span>
                </div>
                <div className="w-13 h-13 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 p-3">
                  <DoorIcon name={door.icon} className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg mb-1.5">{door.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{door.desc}</p>
              </button>
            );
          })}
        </div>

        {filteredDoors.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">لا توجد نتائج مطابقة لبحثك</div>
        )}
      </main>

      {/* نافذة الباب */}
      <Dialog open={!!openDoor} onOpenChange={o => !o && setOpenDoorId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          {openDoor && (
            <>
              <DialogHeader className="text-right">
                <DialogTitle className="font-display text-2xl flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <DoorIcon name={openDoor.icon} className="w-5 h-5" />
                  </span>
                  {openDoor.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {openDoor.sections.map(sec => (
                  <div key={sec.heading} className="bg-secondary rounded-xl p-5">
                    <h4 className="font-bold text-primary mb-2">{sec.heading}</h4>
                    <p className="leading-relaxed text-foreground/90">{sec.body}</p>
                  </div>
                ))}

                {/* الاختبار */}
                {!isDone && (
                  <div className="border border-border rounded-xl p-5">
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      اختبر فهمك
                    </h4>
                    <p className="font-medium mb-3">{openDoor.quiz.q}</p>
                    <div className="space-y-2">
                      {openDoor.quiz.opts.map((opt, i) => (
                        <label
                          key={i}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${quizAnswer === i ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}>
                          <input
                            type="radio"
                            name="quiz"
                            checked={quizAnswer === i}
                            onChange={() => setQuizAnswer(i)}
                            className="accent-[oklch(0.42_0.09_175)]"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* الخطة التطبيقية */}
                <div className="border border-border rounded-xl p-5">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <NotebookPen className="w-5 h-5 text-primary" />
                    خطتي التطبيقية
                  </h4>

                  {/* خططي المحفوظة لهذا الباب مع تعديل وحذف */}
                  {plans.filter(p => p.doorId === openDoor.id).length > 0 && (
                    <div className="space-y-2 mb-4">
                      {plans
                        .filter(p => p.doorId === openDoor.id)
                        .map(p => (
                          <div key={p.id} className="bg-secondary rounded-lg p-3">
                            {editingPlanId === p.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  rows={3}
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    disabled={updatePlan.isPending || editText.trim().length < 5}
                                    onClick={() =>
                                      updatePlan.mutate({ planId: p.id, content: editText })
                                    }>
                                    {updatePlan.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      "حفظ التعديل"
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingPlanId(null);
                                      setEditText("");
                                    }}>
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm leading-relaxed flex-1">{p.content}</p>
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    title="تعديل الخطة"
                                    onClick={() => {
                                      setEditingPlanId(p.id);
                                      setEditText(p.content);
                                    }}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="حذف الخطة"
                                    disabled={deletePlan.isPending}
                                    onClick={() => {
                                      setDeletingPlanId(p.id);
                                    }}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {deletingPlanId === p.id && (
                              <div className="mt-3 border border-destructive/30 bg-destructive/5 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-sm font-medium text-destructive">
                                  هل أنت متأكد من حذف هذه الخطة؟
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={deletePlan.isPending}
                                    onClick={() => deletePlan.mutate({ planId: p.id })}>
                                    {deletePlan.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      "نعم، احذف"
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setDeletingPlanId(null)}>
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  <Textarea
                    placeholder="اكتب كيف ستطبق ما تعلمته من هذا الباب في الميدان..."
                    rows={3}
                    value={planText}
                    onChange={e => setPlanText(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="mt-3"
                    disabled={savePlan.isPending || planText.trim().length < 5}
                    onClick={() => savePlan.mutate({ doorId: openDoor.id, content: planText })}>
                    {savePlan.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "حفظ الخطة"
                    )}
                  </Button>
                </div>

                {/* الشواهد */}
                <div className="border border-border rounded-xl p-5">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <Paperclip className="w-5 h-5 text-primary" />
                    شواهدي لهذا الباب
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    ارفع ملفاً أو صورة كشاهد على تطبيقك لما تعلمته (صور، PDF، Word — حتى 10
                    ميجابايت)
                  </p>

                  {(myEvidences ?? []).filter(ev => ev.doorId === openDoor.id).length > 0 && (
                    <div className="space-y-2 mb-4">
                      {(myEvidences ?? [])
                        .filter(ev => ev.doorId === openDoor.id)
                        .map(ev => (
                          <div key={ev.id} className="bg-secondary rounded-lg p-3">
                            <div className="flex items-center justify-between gap-3">
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline min-w-0">
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
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                                title="حذف الشاهد"
                                disabled={deleteEvidence.isPending}
                                onClick={() => setDeletingEvidenceId(ev.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {ev.mimeType.startsWith("image/") && (
                              <a href={ev.url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={ev.url}
                                  alt={ev.fileName}
                                  className="mt-2 rounded-lg max-h-40 object-contain border border-border/50"
                                />
                              </a>
                            )}
                            {deletingEvidenceId === ev.id && (
                              <div className="mt-3 border border-destructive/30 bg-destructive/5 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-sm font-medium text-destructive">
                                  هل أنت متأكد من حذف هذا الشاهد؟
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={deleteEvidence.isPending}
                                    onClick={() => deleteEvidence.mutate({ evidenceId: ev.id })}>
                                    {deleteEvidence.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      "نعم، احذف"
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setDeletingEvidenceId(null)}>
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={EVIDENCE_ACCEPT}
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleEvidenceFile(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={uploadEvidence.isPending}
                    onClick={() => fileInputRef.current?.click()}>
                    {uploadEvidence.isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جارٍ رفع الشاهد...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4" />
                        إضافة شاهد (ملف أو صورة)
                      </span>
                    )}
                  </Button>
                </div>

                {/* زر النقاط */}
                <Button
                  className="w-full h-12 text-base"
                  disabled={isDone || completeDoor.isPending}
                  onClick={handleClaim}>
                  {isDone ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      تم الحصول على النقاط والشارة
                    </span>
                  ) : completeDoor.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "أجب واكسب 10 نقاط وشارة"
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
