import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/useAccount";
import { doorsData } from "@shared/doors";
import { Award, BookOpenCheck, DoorOpen, LineChart, Sparkles, Target } from "lucide-react";
import { Link } from "wouter";

/** الصفحة الترحيبية للمنصة */
export default function Home() {
  const { isAuthenticated, isAdmin } = useAccount();

  return (
    <div className="min-h-screen pattern-bg">
      {/* الترويسة */}
      <header className="border-b border-border/60 bg-card/70 backdrop-blur-md sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <DoorOpen className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg hidden sm:block">أبواب التطوير المهني</span>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link href={isAdmin ? "/admin" : "/platform"}>
                <Button>{isAdmin ? "لوحة التحكم" : "دخول المنصة"}</Button>
              </Link>
            ) : (
              <>
                <Link href="/admin/login">
                  <Button variant="ghost" className="text-muted-foreground">
                    دخول المشرف
                  </Button>
                </Link>
                <Link href="/login">
                  <Button>تسجيل الدخول</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* القسم البطل */}
      <section className="container py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-4 py-1.5 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              رحلة نمو مهني متكاملة
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold leading-[1.25] mb-6">
              ستة عشر باباً
              <span className="text-primary"> تفتح لك آفاق </span>
              التميز التربوي
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
              منصة تدريبية أنيقة تجمع أحدث أساليب التطوير المهني للمعلمين، من التدريب الحضوري إلى
              الذكاء الاصطناعي، مع نظام نقاط وشارات يوثق رحلة تقدمك خطوة بخطوة.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={isAuthenticated ? "/platform" : "/login"}>
                <Button size="lg" className="h-12 px-8 text-base">
                  ابدأ رحلتك الآن
                </Button>
              </Link>
            </div>
          </div>

          {/* شبكة مصغرة للأبواب */}
          <div className="grid grid-cols-4 gap-3" aria-hidden>
            {doorsData.slice(0, 16).map((door, i) => (
              <div
                key={door.id}
                className="aspect-square rounded-2xl bg-card card-elegant border border-border/50 flex items-center justify-center"
                style={{ animationDelay: `${i * 40}ms` }}>
                <span className="text-2xl font-display font-bold text-primary/70">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* المزايا */}
      <section className="container pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: BookOpenCheck,
              title: "محتوى تدريبي مركز",
              desc: "كل باب يقدم مفهوماً وأهمية وتطبيقاً عملياً مع اختبار قصير يثبت الفهم.",
            },
            {
              icon: Award,
              title: "نقاط وشارات ومستويات",
              desc: "اكسب 10 نقاط لكل باب تنجزه وتدرج من معلم مبتدئ حتى خبير تربوي.",
            },
            {
              icon: Target,
              title: "خطط تطبيقية موثقة",
              desc: "دوّن خطتك لتطبيق ما تعلمته في الميدان وتابعها المنصة معك.",
            },
          ].map(f => (
            <div key={f.title} className="bg-card rounded-2xl p-8 card-elegant border border-border/50">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>منصة أبواب التطوير المهني للمعلمين</span>
          <span className="flex items-center gap-1.5">
            <LineChart className="w-4 h-4" />
            نمو مستمر، أثر ملموس
          </span>
        </div>
      </footer>
    </div>
  );
}
