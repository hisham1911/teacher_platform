# ADR 010 — حالة المسابقة المباشرة وإشعارات SignalR

**الحالة:** Accepted — Phase 6  
**التاريخ:** 2026-08-09

## السياق

تحتاج المسابقة المباشرة إلى انتقال واحد يراه المعلم والطلاب، timer خادمي، واستعادة آمنة بعد انقطاع المتصفح أو API. حفظ الحالة داخل Hub أو المتصفح يجعلها تضيع عند إعادة التشغيل، بينما إرسال الإجابات عبر WebSocket يكرر عقود التحقق والتصحيح الموجودة في REST.

## القرار

- PostgreSQL هو مصدر الحقيقة. لكل جلسة Live صف `LiveSessionState` بحالة المرحلة والسؤال الحالي والمواعيد و`Revision` و`xmin`.
- أوامر Host وإجابات اللاعب تستخدم REST. `/hubs/quiz` يبث snapshots فقط ولا يعرّف methods للتحكم أو الإجابة.
- الخادم وحده يبني groups بصيغة `tenant:{tenantId}:session:{sessionId}:teacher|players`. لا يختار العميل group أو tenant/session claims.
- الاتصال يستخدم JWT Live قصير العمر. إصدار teacher token يتطلب JWT التطبيق وسياسة Owner/Teacher؛ إصدار player token يتطلب Guest Cookie وملكية المشارك. يعيد Hub التحقق من قاعدة البيانات عند الاتصال.
- السؤال المفتوح لا يدخل في لوحة الترتيب، وDTOs لا تكشف الخيار الصحيح. `SubmitAnswerResponse` في Live يحجب الصحة والدرجة حتى الإغلاق، مع بقاء التصحيح والتخزين خادميين.
- Worker يغلق الأسئلة المنتهية بعد deadline + grace. الواجهتان تستخدمان إعادة اتصال SignalR وpolling fallback، لذا فقد الإشعار لا يغيّر الحالة.
- النشر الحالي instance واحدة بلا Redis backplane. أي scale-out لاحق يحتاج backplane أو خدمة managed ومراجعة sticky sessions، دون تغيير مصدر الحقيقة.

## النتائج

- إعادة تشغيل API أو F5 لا تفقد المرحلة أو النتيجة، والتعارض بين أوامر Host يعيد `409` بدل تطبيق انتقال قديم.
- REST يبقى المسار الأمني الوحيد للإجابات، وتظل سياسات `InvalidAnswerPayload`, idempotency, rate limiting, وGuest ownership سارية.
- قراءة snapshot تشتق counts والترتيب من الجداول الحالية؛ هذا مناسب للحجم المستهدف (اختُبر 30 مشاركًا) وليس تصميمًا لآلاف الاتصالات على عدة عقد.
