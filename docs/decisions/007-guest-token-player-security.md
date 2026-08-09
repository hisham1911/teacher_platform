# ADR 007 — أمان رموز الضيوف (Guest Tokens) في واجهة اللاعب

**الحالة:** Accepted  
**التاريخ:** 2026-08-05

## السياق

Phase 4 تتيح للطلاب الانضمام إلى جلسات الاختبار عبر `JoinCode` بدون حساب مستخدم. نحتاج آلية تربط طلبات اللاعب اللاحقة بالمشارك الصحيح دون تسجيل دخول، مع حماية من التخمين والسرقة وإعادة الاستخدام.

## القرار

- **توليد الرمز:** 256-bit عشوائي تشفيري عبر `RandomNumberGenerator.GetBytes(32)`، بترميز Base64Url.
- **التخزين:** الهاش فقط — `SHA-256(token)` في `SessionParticipants.GuestTokenHash`. الرمز الخام لا يُخزن في قاعدة البيانات ولا يُسجّل.
- **المقارنة:** يُحسب هاش الرمز الوارد ويُقارن بالهاش المخزن باستخدام `CryptographicOperations.FixedTimeEquals`.
- **النقل:** يُرسل الرمز الخام مرة واحدة في استجابة `join` ثم يُحفظ في Cookie `HttpOnly`؛ JavaScript لا يقرأه ولا يعتمد Player على `localStorage` لاستعادة الاسم أو الجلسة.

### عقد Cookie الحالي

- اسم Cookie يحدده `Auth:UseSecureCookie` عبر `GuestTokenService.ResolveCookieName`: عند `true` يكون `__Host-tp-guest`، وعند `false` يكون `tp-guest`.
- `__Host-tp-guest` يتطلب في Production `Secure=true` و`Path=/` وعدم وجود `Domain`؛ التنفيذ يضبط هذه السمات، و`Program` يرفض تشغيل Production مع `UseSecureCookie=false`.
- Cookie اللاعب دائمًا `HttpOnly` و`Path=/`، و`SameSite` قابل للضبط عبر `Auth:CookieSameSite` إلى `Lax` أو `Strict` أو `None`؛ `None` تتطلب `Secure`. لذلك لا يُفترض أن Production تستخدم `SameSite=Strict` دائمًا.
- الإعدادات الحالية المستخدمة في المثال وDevelopment/Testing/E2E تضبط `UseSecureCookie=false` و`CookieSameSite=Lax`؛ لذلك تستخدم هذه البيئات `tp-guest`، ولا تستخدم بادئة `__Host-` عندما تكون `Secure=false`.
- عند `401` على أي مسار يبدأ بـ`/api/v1/player/sessions`، يحذف `GlobalExceptionHandler` Cookie الضيف العالق بالاسم المحلول نفسه وبسمات `HttpOnly` و`Secure` و`SameSite` و`Path=/` نفسها. هذا هو عقد حذف stale guest cookie الحالي.

### الصلاحية والعزل

- الرمز مرتبط بمشارك واحد في جلسة واحدة؛ إنهاء الجلسة أو إلغاؤها يمنع المحاولات الجديدة (`SessionNotActive`).
- نقاط اللاعب محدودة المعدل لكل IP + `JoinCode` لإبطاء تخمين رموز الانضمام.

## البدائل

- **JWT موقّع للضيف:** يتطلب إدارة مفاتيح وإبطالًا؛ Cookie + hash أبسط وقابل للإبطال بحذف سجل المشارك.
- **تخزين الرمز الخام أو تشفيره:** الهاش أحادي الاتجاه يكفي لأن الرمز لا يحتاج إلى استرجاع.
- **مقارنة نصية عادية (`==`):** مرفوضة لصالح `FixedTimeEquals`.
- **Cookie بدون `HttpOnly` أو تخزين في `localStorage`:** يعرّض الرمز لسرقة XSS — مرفوض.

## القيود

- Cookie مرتبط بالمتصفح؛ تغيير الجهاز يتطلب الانضمام من جديد. الاستعادة المستهدفة بعد F5 تتم داخل المتصفح نفسه عبر Guest Cookie و`GET /api/v1/player/sessions/{joinCode}/me`.
- لا يوجد إبطال فردي للرمز دون حذف المشارك؛ يُؤجل حتى ظهور حاجة فعلية.
