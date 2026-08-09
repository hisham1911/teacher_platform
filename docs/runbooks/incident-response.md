# Runbook الأعطال والاستعادة

استخدم هذا الدليل مع `docs/deployment.md`. لا توجد قيم RTO/RPO معتمدة بعد؛ سجّل وقت بداية الحادث، الأثر، وقرارات الاستعادة بدل اختراع هدف غير متفق عليه.

## فرز أولي

1. افحص `https://api.example.com/health/live` ثم `/health/ready`.
2. خذ `X-Request-Id` من الرد المتأثر وابحث عنه في `journalctl -u teacher-platform.service`.
3. حدد هل العطل في العملية، PostgreSQL، Object Storage، SMTP، أم شبكة WebSocket.
4. لا تشغّل migration أو restore أو حذف بيانات قبل أخذ backup وفهم نطاق المشكلة.

## API لا يستجيب

```bash
systemctl status teacher-platform.service --no-pager
journalctl -u teacher-platform.service --since '30 minutes ago' --no-pager
curl --fail http://127.0.0.1:5000/health/live
nginx -t
```

- إذا فشل الفحص المحلي، راجع خطأ Configuration fail-fast ووجود `/opt/teacher-platform/current` وملف البيئة ثم أعد تشغيل الخدمة بعد التصحيح.
- إذا نجح محليًا وفشل خارجيًا، افحص Nginx والشهادة وDNS/firewall. لا تفتح منفذ Kestrel للعامة كحل مؤقت.

## Readiness يفشل

- `/health/live=200` مع `/health/ready!=200` يعني أن العملية تعمل لكن فحص PostgreSQL يفشل.
- افحص الاتصال وصلاحيات المستخدم ومساحة القرص وحالة مزود PostgreSQL. لا تحول readiness إلى liveness ولا تعطل الفحص.
- إذا بدأ العطل بعد نشر، استخدم rollback التطبيق في `docs/deployment.md`. إذا كان schema الجديد غير متوافق، استعد backup إلى قاعدة جديدة وراجعها قبل أي تحويل.

## Deployment فاشل

- `deploy-release.sh` يعيد symlink للإصدار السابق تلقائيًا إذا لم ينجح readiness خلال المهلة.
- افحص مجلد الإصدار الجديد ونتيجة migration bundle وسجل الخدمة. لا تعاود استخدام مجلد SHA موجود؛ أصلح السبب وابنِ artifact جديدًا.
- إذا فشل backup السابق للترحيل، يتوقف النشر. أصلح `teacher-platform-backup.service` أولًا ولا تتجاوز الخطوة.

## Backup أو Restore فاشل

```bash
systemctl status teacher-platform-backup.service --no-pager
journalctl -u teacher-platform-backup.service --since '24 hours ago' --no-pager
systemctl list-timers teacher-platform-backup.timer
```

- تحقق من `PGPASSFILE`, مساحة `BACKUP_ROOT`, وجود `age`, وصحة recipient. لا تحتفظ بـdump غير مشفر كحل دائم.
- Restore يترك قاعدة الهدف الجديدة عند فشل `pg_restore` لفحصها؛ لا توجه Production إليها. احذفها يدويًا فقط بعد التحقق من اسمها ونطاقها.
- checksum فاشل يعني أن الملف غير صالح للاستعادة؛ استخدم نسخة off-host أخرى ولا تتجاوز الفحص.

## Object Storage أو الشهادات

- فشل S3 يظهر كخطأ request أو كفشل job شهادة. راجع endpoint/bucket/region وبيانات الاعتماد من Secret store دون طباعتها.
- Outbox يعيد محاولة توليد الشهادة، وبعد الفشل النهائي يستطيع المعلم استخدام Retry من `/dashboard/certificates` بعد عودة التخزين.
- لا تحذف سجل `MediaAsset` أو `Certificate` يدويًا لتجاوز خطأ التخزين؛ أصلح المزود أو استعد النسخة الخارجية.

## SMTP

- فشل بدء Production بسبب Mail Configuration مقصود. تحقق من `Mail__Provider=Smtp`, `Host`, `FromAddress`, و`Security=StartTls`.
- إذا بدأ التطبيق وفشل الإرسال، افحص رفض المزود والشبكة وبيانات الاعتماد. لا تحول Production إلى File provider؛ التحقق عند البدء يرفض ذلك.

## SignalR أو Live

- افحص أن Nginx يمرر Upgrade على `/hubs/quiz`. الواجهة تملك polling fallback، لذلك قد يستمر التدفق مع تأخر التحديثات عندما يفشل WebSocket.
- حالة Live الحاكمة في PostgreSQL؛ لا تعدلها من الذاكرة أو تضف عملية Hub ثانية. استخدم REST state و`X-Request-Id` لتشخيص الانتقال.

## بعد الحادث

- تحقق من health العام، رحلة تسجيل الدخول، وقراءة مستأجر واحد دون استخدام بيانات عميل آخر.
- سجّل timeline والسبب والإصلاح وأي data loss مؤكد. لا تصف الاستعادة بالنجاح قبل فحص قاعدة البيانات وObject Storage ومفاتيح Data Protection.
- نفّذ Restore drill جديدًا إذا مس الحادث backup أو migration أو التخزين.
