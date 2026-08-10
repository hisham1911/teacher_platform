# نشر وتشغيل Teacher Platform

هذا الدليل يطابق نموذج Production الحالي: React SPA على Vercel، وASP.NET Core API على Linux VPS خلف Nginx، وPostgreSQL، وS3-compatible object storage، وSMTP. لا يشغّل التطبيق migrations تلقائيًا.

## 1. المتطلبات والمسارات

على خادم API ثبّت ASP.NET Core Runtime 10، وNginx، وPostgreSQL client tools، و`age`, و`curl`. يلزم `rclone` فقط عند استخدام `BACKUP_RCLONE_REMOTE` للنسخة الخارجية.

المسارات التي تفترضها ملفات التشغيل:

```text
/opt/teacher-platform/releases/<git-sha>/
/opt/teacher-platform/current -> releases/<git-sha>
/etc/teacher-platform/teacher-platform.env
/etc/teacher-platform/backup.env
/etc/teacher-platform/monitor.env
/etc/teacher-platform/pgpass
/var/lib/teacher-platform/data-protection/
/var/backups/teacher-platform/
```

أنشئ مستخدم خدمة بلا login وامنحه المجلدات القابلة للكتابة فقط:

```bash
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin teacher-platform
sudo install -d -o teacher-platform -g teacher-platform -m 0750 /opt/teacher-platform/releases
sudo install -d -o teacher-platform -g teacher-platform -m 0700 /var/lib/teacher-platform/data-protection
sudo install -d -o teacher-platform -g teacher-platform -m 0700 /var/backups/teacher-platform
sudo install -d -o root -g teacher-platform -m 0750 /etc/teacher-platform
```

انسخ قوالب `ops/systemd/` إلى `/etc/systemd/system/`، واضبط Nginx من `ops/nginx/teacher-platform.conf` بعد استبدال اسم النطاق ومسارات الشهادة. Kestrel يستمع على `127.0.0.1:5000` فقط؛ لا تفتح هذا المنفذ للعامة. كتلة `/hubs/quiz` في القالب تضبط WebSocket upgrade المطلوب لـSignalR.

## 2. Configuration والأسرار

ابدأ من `ops/teacher-platform.env.example` و`ops/backup.env.example` و`ops/monitor.env.example`، لكن اكتب القيم الحقيقية مباشرة في `/etc/teacher-platform/` من Secret store أو آلية provisioning، لا في Git:

```bash
sudo install -o root -g teacher-platform -m 0640 ops/teacher-platform.env.example /etc/teacher-platform/teacher-platform.env
sudo install -o root -g teacher-platform -m 0640 ops/backup.env.example /etc/teacher-platform/backup.env
sudo install -o root -g teacher-platform -m 0640 ops/monitor.env.example /etc/teacher-platform/monitor.env
sudo systemctl daemon-reload
sudo systemctl enable teacher-platform.service
```

استبدل كل قيمة `REPLACE_*`. Production يفشل عند غياب SMTP/TLS، أو QuestPDF license selection، أو إعداد S3 الكامل، أو عند استخدام S3 endpoint غير HTTPS. `DataProtection__KeysDirectory` يجب أن يبقى خارج مجلد الإصدار وعلى تخزين دائم.

ملف `/etc/teacher-platform/pgpass` لا يدخل المستودع، ملكيته `teacher-platform` وصلاحيته `0600`، وصيغته القياسية:

```text
127.0.0.1:5432:teacher_platform:teacher_platform_backup:REPLACE_FROM_SECRET_STORE
```

اضبط bucket خاصًا، وفعّل versioning/replication أو سياسة backup لدى مزود S3. نسخة PostgreSQL وحدها لا تستعيد ملفات الوسائط أو الشهادات. احتفظ أيضًا بنسخة مشفرة من مفاتيح Data Protection؛ ضياعها يمنع فك الرموز المحمية الموجودة في قاعدة البيانات.

## 3. أول Platform Admin

لا يوجد حساب إدارة افتراضي. سجّل مستخدمًا عاديًا وأكد بريده، ثم نفّذ من قناة إدارة قاعدة بيانات آمنة:

```bash
psql "$DATABASE_URL" \
  -v admin_email='owner@example.com' \
  -f scripts/grant-platform-admin.sql
```

يسجل المستخدم الدخول مجددًا بعد المنح حتى يصدر JWT جديدًا يحمل `role=PlatformAdmin`. التسجيل العام وطلبات profile لا تمنح هذا الدور.

## 4. النسخ الاحتياطي المجدول

`scripts/backup-postgres.sh` ينشئ `pg_dump` بصيغة custom، يتحقق منه بـ`pg_restore --list`، يشفره إلى `.dump.age`، ويكتب checksum للملف المشفر. لا يبقى dump غير مشفر بعد انتهاء العملية. اضبط `BACKUP_AGE_RECIPIENT` إلى public recipient؛ لا يحتاج خادم النسخ إلى private identity.

اختبر الخدمة ثم فعّل المؤقت:

```bash
sudo systemctl start teacher-platform-backup.service
sudo systemctl status teacher-platform-backup.service --no-pager
sudo systemctl enable --now teacher-platform-backup.timer
systemctl list-timers teacher-platform-backup.timer
```

المؤقت يعمل يوميًا 02:15 مع تأخير عشوائي حتى 15 دقيقة، ويعوض التشغيل الفائت عبر `Persistent=true`. الاحتفاظ المحلي 14 يومًا افتراضيًا. لا يُعد backup مكتملًا تشغيليًا إلا بعد نجاح النسخ إلى موقع off-host واختبار restore دوري.

## 5. Restore drill أو استعادة حادث

الاستعادة لا تكتب فوق قاعدة موجودة. `scripts/restore-postgres.sh` يفرض اسم قاعدة جديدة يحتوي `_restore`، يتحقق من checksum، يفك التشفير باستخدام identity file صريح، يفحص archive، ثم ينفذ `pg_restore --exit-on-error` ويتحقق من جدول migrations.

```bash
set -a
source /etc/teacher-platform/backup.env
set +a
export BACKUP_AGE_IDENTITY_FILE=/secure/offline-copy/teacher-platform.agekey
bash scripts/restore-postgres.sh \
  /var/backups/teacher-platform/teacher-platform-teacher_platform-YYYYMMDDTHHMMSSZ.dump.age \
  teacher_platform_restore_YYYYMMDD
```

بعد النجاح افحص `/health/ready` على نسخة API موجهة مؤقتًا إلى قاعدة الاستعادة، وراجع counts حرجة وسجل migrations. لا تبدّل Production إلى القاعدة المستعادة قبل مراجعة البيانات ومزامنة Object Storage ومفاتيح Data Protection.

تم تنفيذ restore drill محلي أثناء إغلاق Phase 7: custom dump حقيقي إلى قاعدة جديدة، `pg_restore --exit-on-error`، ثم تحقق 44 جدولًا عامًا ووجود `__EFMigrationsHistory`. تشفير `age` لم يُنفذ محليًا لأن الأداة غير مثبتة على محطة التطوير؛ سكربت Production يرفض العمل من دونها ولا يسقط إلى تشفير أضعف.

## 6. Pipeline النشر

Workflow `.github/workflows/deploy-backend.yml` يدوي (`workflow_dispatch`) ومحمي ببيئة GitHub المسماة `production`. أضف approval gate والأسرار التالية:

- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.
- `API_BASE_URL` كرابط HTTPS عام للـAPI.

الـworkflow يعيد فحوص الواجهة والباك إند، يبني publish وEF migration bundle للـLinux، ويرفع artifact باسم SHA الفعلي للـcommit المختار. على الخادم يقوم `scripts/deploy-release.sh` بالترتيب التالي:

1. يفك الإصدار إلى مجلد SHA جديد لا يعاد استخدامه.
2. يشغّل backup مشفرًا من سكربت الإصدار الجديد؛ الفشل يوقف النشر.
3. يشغّل EF bundle مع `ConnectionStrings__DefaultConnection` من ملف Production.
4. يبدّل symlink `current` ذريًا ويعيد تشغيل systemd.
5. ينتظر `/health/ready` محليًا، ثم يفحص الـworkflow `/health/live` و`/health/ready` عبر HTTPS العام.

نشر الواجهة يتم من `apps/web` على Vercel بإعداد `VITE_API_BASE_URL` العام؛ لا يتضمن artifact الباك إند أسرار الواجهة.

## 7. Rollback

إذا أخفق readiness بعد التبديل، يعيد `deploy-release.sh` symlink إلى الإصدار السابق ويعيد تشغيل الخدمة. للتحويل اليدوي بعد تشخيص السبب:

```bash
sudo ln -s /opt/teacher-platform/releases/<previous-git-sha> /opt/teacher-platform/current.next
sudo mv -Tf /opt/teacher-platform/current.next /opt/teacher-platform/current
sudo systemctl restart teacher-platform.service
bash scripts/verify-deployment.sh https://api.example.com
```

لا يشغّل الـpipeline `Down` migrations تلقائيًا. يجب أن تكون تغييرات قاعدة البيانات backward-compatible مع الإصدار السابق أثناء نافذة النشر. إذا كان rollback يتطلب بيانات قديمة، استعد backup إلى قاعدة جديدة واتبع فحص الاستعادة أعلاه؛ لا تستبدل قاعدة Production عميانيًا.

## 8. فحوص التشغيل

```bash
systemctl status teacher-platform.service --no-pager
journalctl -u teacher-platform.service --since '15 minutes ago' --no-pager
curl --fail https://api.example.com/health/live
curl --fail https://api.example.com/health/ready
nginx -t
sudo systemctl enable --now teacher-platform-monitor.timer
systemctl list-timers teacher-platform-monitor.timer
```

`/health/live` يثبت أن العملية تستجيب، و`/health/ready` يفحص PostgreSQL. المؤقت يعمل كل خمس دقائق ويفشل إذا تعطلت الصحة، لم توجد نسخة `.dump.age` حديثة ضمن الحد، أو بقيت رسالة Outbox متأخرة أكثر من ساعة. systemd يسجل الفشل؛ اربطه بتنبيه خارجي على حالة الوحدة في منصة المراقبة المختارة. استخدم `X-Request-Id` لربط رد API بسجل الخدمة. Runbooks الأعطال في `docs/runbooks/incident-response.md` و`docs/runbooks/monitoring.md`.
