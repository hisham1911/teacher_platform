# ADR 001 — جلسات SPA عبر JWT في الذاكرة + Refresh Token HttpOnly Cookie

**الحالة:** معتمد (Phase 1)

## السياق

الواجهة React SPA وتحتاج تسجيل دخول وتجديدًا تلقائيًا للجلسة في بيئات متصفح غير موثوقة. يجب أن لا تكون Access Tokens قابلة للقراءة عبر JavaScript لأنها تُرسَل مع كل طلب إلى `api.*` وقد تُستخرج من XSS أو من أي سكربت طرف ثالث. ولا يجوز في نفس الوقت أن ينقطع المستخدم عند كل Reload أو أن تُخزن الـRefresh Token في Web Storage (أكثر عرضة للسرقة من httponly cookie).

## القرار

- **Access Token**: يُخزن في متغير Module-level داخل الذاكرة فقط (ممنوع في `localStorage` و`sessionStorage` و`cookies`). عند Reload تُعاد استعادته عبر Single-flight Refresh.
- **Refresh Token**: يُخزن في Cookie `__Host-tp-refresh` مع `HttpOnly + Secure (Production) + SameSite=Lax + Path=/api/v1/auth`، ولا تُقرأ من JavaScript.
- **Single-flight Refresh**: استدعاء واحد لـ`POST /api/v1/auth/refresh` يُشترك فيه كل الطلبات المتزامنة التي حصلت 401 في نفس اللحظة — لا استنساخ على كل Request.
- **Retry الوحيدة**: بعد Refresh ناجح، يعاد الطلب الأصلي مرة واحدة فقط عبر علامة `retriedAfterRefresh` في دالة النداء — لا Infinite Loop.
- **فشل Refresh**: يمسح Session من الذاكرة فورًا (`clearSession()`) ويوجه إلى `/auth/login`.
- **Server-side rotation + reuse detection**: كل Refresh ينشئ Token جديدًا داخل المعاملة نفسها، يربطه بـ`ReplacedByTokenId`، ويلغي القديم. إعادة استخدام قديم تلغي Family بالكامل.
- **الCookies في Production**: `Secure` إلزامي و`SameSite` من الإعدادات، مع CORS origins صريحة و`Origin` middleware أمان للـcookie-authenticated endpoints.

## البدائل المرفوضة

- **Cookies للـAccess Token نفسه**: أقل عرضة للـXSS لكن أكثر تشتيت مع SPA cross-origin + preflight معقد + مشاكل If-Modified خاصة بالـCSR.
- **`localStorage` للـRefresh Token**: انتقال أسهل للـSPA لكن أي XSS يسرق الحساب طويلًا.
- **JWT session في Database فقط بدون Refresh Rotation**: كسر security boundary عند تسريب الـToken.

## التبعات

- كل طلبات البيانات تمر عبر `authApi`/`tenantsApi` في `data/api-client/endpoints.ts` فقط — لا `fetch` مباشر من Components.
- اختبار عدم تخزين Access Token في Web Storage منهجي موجود (`endpoints.test.ts`).
- `VITE_API_BASE_URL` هو المتغير الوحيد المكشوف لشبكة الـAPI.
