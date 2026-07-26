export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// نظام المصادقة داخلي بالكامل (اسم مستخدم / كلمة مرور + JWT).
// عند الحاجة لتسجيل الدخول يتم التوجيه إلى صفحة الدخول الداخلية.
export const startLogin = () => {
  window.location.href = "/login";
};
