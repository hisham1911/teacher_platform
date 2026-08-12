# نشر وتشغيل Teacher Platform

هذا الدليل يطابق نموذج Production الحالي: React SPA على Vercel، وASP.NET Core API على Linux VPS خلف Nginx، وPostgreSQL، وS3-compatible object storage، وSMTP. لا يشغّل التطبيق migrations تلقائيًا.

## 1. المتطلبات والمسارات

على خادم API ثبّت ASP.NET Core Runtime 10، وNginx، وPostgreSQL client tools، و`age`, و`curl`، و`openssl`، و`fontconfig` مع خط `DejaVu Sans`. يلزم `rclone` فقط عند استخدام `BACKUP_RCLONE_REMOTE` للنسخة الخارجية. محطة المشغل تحتاج Git وGitHub CLI لتشغيل workflow بالأوامر أدناه، وVercel CLI فقط إذا لم يُستخدم ربط Git من لوحة Vercel.

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

ثبّت قوالب الخدمات، ثم اضبط Nginx بعد استبدال `api.example.com` ومسارات الشهادة بقيم Production الحقيقية:

```bash
sudo install -o root -g root -m 0644 ops/systemd/teacher-platform.service /etc/systemd/system/
sudo install -o root -g root -m 0644 ops/systemd/teacher-platform-backup.service /etc/systemd/system/
sudo install -o root -g root -m 0644 ops/systemd/teacher-platform-backup.timer /etc/systemd/system/
sudo install -o root -g root -m 0644 ops/systemd/teacher-platform-monitor.service /etc/systemd/system/
sudo install -o root -g root -m 0644 ops/systemd/teacher-platform-monitor.timer /etc/systemd/system/
sudo install -o root -g root -m 0644 ops/nginx/teacher-platform.conf /etc/nginx/sites-available/teacher-platform
sudo ln -s /etc/nginx/sites-available/teacher-platform /etc/nginx/sites-enabled/teacher-platform
sudo systemctl daemon-reload
sudo nginx -t
```

Kestrel يستمع على `127.0.0.1:5000` فقط؛ لا تفتح هذا المنفذ للعامة. كتلة `/hubs/quiz` في قالب Nginx تضبط WebSocket upgrade المطلوب لـSignalR.

### تصنيف preflight

- **Hard blockers:** نطاقا الواجهة والـAPI مع DNS وTLS صالحين، PostgreSQL وقاعدة Production، إعدادات JWT وCookies وCORS/TrustedOrigins، تخزين S3، SMTP/TLS، اختيار ترخيص QuestPDF، مسار Data Protection دائم، ونسخة PostgreSQL مشفرة ناجحة قبل أول migration.
- **يمكن تجهيزها على الخادم:** مستخدم ومجلدات الخدمة، PostgreSQL محلي إن كان self-hosted، مفتاح JWT عشوائي، زوج مفاتيح `age`، systemd، Nginx، health checks، timers، الخط العربي، وإعدادات rate limit/logging غير السرية.
- **تحتاج حسابًا أو Credential من المالك:** DNS/domain، شهادة TLS إذا لم تُصدر آليًا بعد تفويض DNS، VPS/SSH، PostgreSQL المُدار إن استُخدم، S3، SMTP، Vercel، GitHub Environment، وجهة off-host backup/monitoring. اختيار QuestPDF واعتماد نصوص الخصوصية والشروط يحتاجان قرار المالك/الجهة، لا قيمة سرية في Git.

## 2. Configuration والأسرار

ابدأ من `ops/teacher-platform.env.example` و`ops/backup.env.example` و`ops/monitor.env.example`، لكن اكتب القيم الحقيقية مباشرة في `/etc/teacher-platform/` من Secret store أو آلية provisioning، لا في Git:

```bash
sudo install -o root -g teacher-platform -m 0640 ops/teacher-platform.env.example /etc/teacher-platform/teacher-platform.env
sudo install -o root -g teacher-platform -m 0640 ops/backup.env.example /etc/teacher-platform/backup.env
sudo install -o root -g teacher-platform -m 0640 ops/monitor.env.example /etc/teacher-platform/monitor.env
sudo systemctl daemon-reload
sudo systemctl enable teacher-platform.service
```

استبدل كل قيمة `REPLACE_*`. Production يفشل عند غياب SMTP/TLS أو QuestPDF license selection. وعند اختيار `Storage__Provider=S3` كما في القالب، يفشل البدء إن كان الإعداد ناقصًا أو كان endpoint غير HTTPS. `DataProtection__KeysDirectory` يجب أن يبقى خارج مجلد الإصدار وعلى تخزين دائم.

هذه الملفات تتبع صيغة systemd `EnvironmentFile`. ضع القيم التي تحتوي مسافات أو رموزًا خاصة بين علامات اقتباس مناسبة لهذه الصيغة، ولا تنفّذ الملفات عبر `source`؛ سكربت النشر والخدمات يمررانها عبر systemd كي لا تُفسر الأسرار كتعليمات shell.

ولّد القيم التي لا تحتاج حسابًا خارجيًا على قناة provisioning آمنة، ثم انقل الناتج إلى Secret store؛ لا تلصقه في issue أو log أو Git:

```bash
openssl rand -base64 48
umask 077
age-keygen -o teacher-platform.agekey
age-keygen -y teacher-platform.agekey
```

الناتج الأول يصلح لـ`Jwt__SigningKey`. ضع public recipient من الأمر الأخير في `BACKUP_AGE_RECIPIENT`، واحفظ `teacher-platform.agekey` خارج خادم Production في مخزن استعادة محمي.

استخدم origin صريحًا بلا wildcard وبلا `/` نهائية في كل من `Cors__AllowedOrigins__0` و`Auth__TrustedOrigins__0`. الإعداد الموصى به هو نطاقان شقيقان مثل `https://app.example.com` و`https://api.example.com` مع `Auth__CookieSameSite=Lax`. إذا كانت الواجهة والـAPI cross-site فعلًا، استخدم `None` فقط مع `Auth__UseSecureCookie=true` وبعد اختبار الكوكي في المتصفح الحقيقي. القالب يثبت أيضًا الحدود الحالية `20` طلبًا لكل `60` ثانية للسياسات المحدودة، ومستوى logging الحالي؛ غيّرها بقرار تشغيلي صريح فقط.

ملف `/etc/teacher-platform/pgpass` لا يدخل المستودع، ملكيته `teacher-platform` وصلاحيته `0600`، وصيغته القياسية:

```text
127.0.0.1:5432:teacher_platform:teacher_platform_backup:REPLACE_FROM_SECRET_STORE
```

اضبط bucket خاصًا، وفعّل versioning/replication أو سياسة backup لدى مزود S3. نسخة PostgreSQL وحدها لا تستعيد ملفات الوسائط أو الشهادات. احتفظ أيضًا بنسخة مشفرة من مفاتيح Data Protection؛ ضياعها يمنع فك الرموز المحمية الموجودة في قاعدة البيانات.

## 3. قاعدة Production وMigrations

في PostgreSQL self-hosted، أنشئ مستخدم التطبيق وقاعدته ومستخدم backup بمدخلات كلمات مرور تفاعلية؛ لا تضع كلمات المرور في history:

```bash
sudo -u postgres createuser --login --pwprompt teacher_platform
sudo -u postgres createdb --owner=teacher_platform --encoding=UTF8 --template=template0 teacher_platform
sudo -u postgres createuser --login --pwprompt teacher_platform_backup
sudo -u postgres psql --set=ON_ERROR_STOP=1 --dbname=teacher_platform \
  --command='GRANT CONNECT ON DATABASE teacher_platform TO teacher_platform_backup;' \
  --command='GRANT pg_read_all_data TO teacher_platform_backup;'
```

في PostgreSQL المُدار، نفّذ ما يكافئ ذلك من لوحة المزود، وضع connection string لمستخدم التطبيق في `ConnectionStrings__DefaultConnection` وبيانات مستخدم القراءة في `backup.env` و`pgpass`.

المسار المفضل لتطبيق migrations هو `efbundle` الذي يبنيه workflow؛ `deploy-release.sh` يأخذ backup مشفرًا أولًا ثم يشغّل bundle قبل تبديل `current`. يستخدم السكربت transient units بحساب `teacher-platform` كي يقرأ systemd ملفات `EnvironmentFile` من دون تفسير الأسرار كأوامر shell. لتطبيق bundle يدويًا من artifact مفكوك قبل تشغيل الخدمة:

```bash
RELEASE_SHA='<full-git-sha>'
sudo systemd-run --wait --collect --pipe \
  --unit="teacher-platform-manual-migrate-${RELEASE_SHA}" \
  --property=Type=exec \
  --property=User=teacher-platform \
  --property=Group=teacher-platform \
  --property="WorkingDirectory=/opt/teacher-platform/releases/${RELEASE_SHA}/backend" \
  --property=EnvironmentFile=/etc/teacher-platform/teacher-platform.env \
  "/opt/teacher-platform/releases/${RELEASE_SHA}/backend/efbundle"
```

تحقق بحساب backup من السلسلة المطبقة، ويجب أن يكون آخر migration في هذا الإصدار `20260809214618_CreateSaasAdministration`:

```bash
sudo systemd-run --wait --collect --pipe \
  --unit=teacher-platform-migration-check \
  --property=Type=exec \
  --property=User=teacher-platform \
  --property=Group=teacher-platform \
  --property=EnvironmentFile=/etc/teacher-platform/backup.env \
  /usr/bin/psql --no-password --set=ON_ERROR_STOP=1 \
  --command='SELECT "MigrationId", "ProductVersion" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";'
```

لا تضف `Database.Migrate()` إلى startup، ولا تشغّل `dotnet ef database update` من دون تمرير `ConnectionStrings__DefaultConnection` الحقيقي صراحة. عند التشغيل من source يكون الأمر:

```bash
cd backend
read -rsp 'Production connection string: ' ConnectionStrings__DefaultConnection
export ConnectionStrings__DefaultConnection
dotnet ef database update \
  --project src/TeacherPlatform.Infrastructure/TeacherPlatform.Infrastructure.csproj \
  --startup-project src/TeacherPlatform.Api/TeacherPlatform.Api.csproj
unset ConnectionStrings__DefaultConnection
```

## 4. أول Platform Admin

لا يوجد حساب إدارة افتراضي. سجّل مستخدمًا عاديًا وأكد بريده، ثم نفّذ من قناة إدارة قاعدة بيانات آمنة:

```bash
psql "$DATABASE_URL" \
  -v admin_email='owner@example.com' \
  -f scripts/grant-platform-admin.sql
```

مرّر `DATABASE_URL` من قناة إدارة آمنة كمتغير مؤقت، ولا تحفظه في ملف داخل المستودع. يسجل المستخدم الدخول مجددًا بعد المنح حتى يصدر JWT جديدًا يحمل `role=PlatformAdmin`. التسجيل العام وطلبات profile لا تمنح هذا الدور.

## 5. النسخ الاحتياطي المجدول

`scripts/backup-postgres.sh` ينشئ `pg_dump` بصيغة custom، يتحقق منه بـ`pg_restore --list`، يشفره إلى `.dump.age`، ويكتب checksum للملف المشفر. لا يبقى dump غير مشفر بعد انتهاء العملية. اضبط `BACKUP_AGE_RECIPIENT` إلى public recipient؛ لا يحتاج خادم النسخ إلى private identity.

اختبر الخدمة ثم فعّل المؤقت:

```bash
sudo systemctl start teacher-platform-backup.service
sudo systemctl status teacher-platform-backup.service --no-pager
sudo systemctl enable --now teacher-platform-backup.timer
systemctl list-timers teacher-platform-backup.timer
```

المؤقت يعمل يوميًا 02:15 مع تأخير عشوائي حتى 15 دقيقة، ويعوض التشغيل الفائت عبر `Persistent=true`. الاحتفاظ المحلي 14 يومًا افتراضيًا. لا يُعد backup مكتملًا تشغيليًا إلا بعد نجاح النسخ إلى موقع off-host واختبار restore دوري.

## 6. Restore drill أو استعادة حادث

الاستعادة لا تكتب فوق قاعدة موجودة. `scripts/restore-postgres.sh` يفرض اسم قاعدة جديدة يحتوي `_restore`، يتحقق من checksum، يفك التشفير باستخدام identity file صريح، يفحص archive، ثم ينفذ `pg_restore --exit-on-error` ويتحقق من جدول migrations.

```bash
export PGHOST='<restore-database-host>'
export PGPORT=5432
export PGUSER='<restore-operator-with-createdb>'
export PGPASSFILE=/secure/restore-pgpass
export BACKUP_AGE_IDENTITY_FILE=/secure/offline-copy/teacher-platform.agekey
/opt/teacher-platform/current/scripts/restore-postgres.sh \
  /var/backups/teacher-platform/teacher-platform-teacher_platform-YYYYMMDDTHHMMSSZ.dump.age \
  teacher_platform_restore_YYYYMMDD
```

استخدم قناة استعادة مخصصة لها `CREATEDB`؛ حساب `teacher_platform_backup` للقراءة فقط ولا يجب رفع صلاحياته من أجل drill. بعد النجاح افحص `/health/ready` على نسخة API موجهة مؤقتًا إلى قاعدة الاستعادة، وراجع counts حرجة وسجل migrations. لا تبدّل Production إلى القاعدة المستعادة قبل مراجعة البيانات ومزامنة Object Storage ومفاتيح Data Protection.

تم تنفيذ restore drill محلي أثناء إغلاق Phase 7: custom dump حقيقي إلى قاعدة جديدة، `pg_restore --exit-on-error`، ثم تحقق 44 جدولًا عامًا ووجود `__EFMigrationsHistory`. تشفير `age` لم يُنفذ محليًا لأن الأداة غير مثبتة على محطة التطوير؛ سكربت Production يرفض العمل من دونها ولا يسقط إلى تشفير أضعف.

## 7. Pipeline النشر

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

شغّل نشر API على commit كامل محدد بعد إضافة أسرار GitHub Environment أعلاه:

```bash
RELEASE_SHA="$(git rev-parse main)"
gh workflow run deploy-backend.yml --ref main -f "git_ref=$RELEASE_SHA"
gh run watch
```

في Vercel اجعل Root Directory هو `apps/web`، وNode.js هو `24.x` مثل CI، وBuild Command هو `npm run build`، وOutput Directory هو `dist`، وأضف `VITE_API_BASE_URL=https://api.example.com` لبيئة Production ثم انشر commit نفسه. هذا المتغير عنوان عام وليس Secret، ولا يجوز وضع أي Credential في متغير يبدأ بـ`VITE_`.

## 8. Rollback

إذا أخفق readiness بعد التبديل، يعيد `deploy-release.sh` symlink إلى الإصدار السابق ويعيد تشغيل الخدمة. للتحويل اليدوي بعد تشخيص السبب:

```bash
sudo ln -s /opt/teacher-platform/releases/<previous-git-sha> /opt/teacher-platform/current.next
sudo mv -Tf /opt/teacher-platform/current.next /opt/teacher-platform/current
sudo systemctl restart teacher-platform.service
bash scripts/verify-deployment.sh https://api.example.com
```

لا يشغّل الـpipeline `Down` migrations تلقائيًا. يجب أن تكون تغييرات قاعدة البيانات backward-compatible مع الإصدار السابق أثناء نافذة النشر. إذا كان rollback يتطلب بيانات قديمة، استعد backup إلى قاعدة جديدة واتبع فحص الاستعادة أعلاه؛ لا تستبدل قاعدة Production عميانيًا.

## 9. فحوص التشغيل

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

## 10. ترتيب التنفيذ لأول نشر

1. جهّز DNS/TLS وVPS والحزم والمجلدات وقوالب systemd/Nginx.
2. أنشئ PostgreSQL ومستخدمي التطبيق والنسخ، واملأ ملفات `/etc/teacher-platform/` و`pgpass` من Secret store.
3. أنشئ S3 bucket وSMTP و`age` recipient ومكان off-host، واختبر الوصول من الخادم.
4. أضف أسرار GitHub Environment `production`، ثم شغّل workflow على Full SHA محدد؛ لا تشغّل migrations تلقائيًا خارج bundle.
5. تحقق من remote health ومن migration history، ثم فعّل backup وmonitor timers واختبر تنبيهًا وفحص restore.
6. انشر الواجهة على Vercel مع `VITE_API_BASE_URL`، ثم تحقق من CORS وWebSocket والكوكي في متصفح حقيقي.
7. أنشئ حساب المشغل الحقيقي وامنحه PlatformAdmin بالطريقة أعلاه، ثم نفّذ onboarding واختبار الـpilot في `docs/pilot-onboarding.md` على البيئة المنشورة نفسها.
