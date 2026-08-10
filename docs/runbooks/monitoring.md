# Runbook المراقبة التشغيلية

يعمل `teacher-platform-monitor.timer` كل خمس دقائق ويشغّل `scripts/check-operational-health.sh` كخدمة `oneshot`. الفحص fail-closed ولا يغيّر بيانات التطبيق.

## ما الذي يُفحص

- `GET /health/live` و`GET /health/ready` خلال مهلة عشر ثوانٍ.
- وجود أحدث ملف PostgreSQL مشفر باسم `teacher-platform-*.dump.age` داخل `BACKUP_ROOT`، وألا يتجاوز عمره `MONITOR_MAX_BACKUP_AGE_HOURS` (36 ساعة افتراضيًا).
- اتصال PostgreSQL باستخدام `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, و`PGPASSFILE` من `backup.env`.
- عدم وجود `OutboxMessages` غير معالجة وموعدها أقدم من ساعة.

## التثبيت والتحقق

```bash
sudo install -o root -g teacher-platform -m 0640 ops/monitor.env.example /etc/teacher-platform/monitor.env
sudo systemctl daemon-reload
sudo systemctl start teacher-platform-monitor.service
sudo systemctl status teacher-platform-monitor.service --no-pager
sudo systemctl enable --now teacher-platform-monitor.timer
systemctl list-timers teacher-platform-monitor.timer
```

استبدل `MONITOR_API_BASE_URL` برابط HTTPS العام. يسمح السكربت بـHTTP فقط عند استخدام loopback. لا تضع كلمة مرور PostgreSQL في `monitor.env`؛ استخدم `PGPASSFILE` المحمي بصلاحية `0600` كما في دليل النشر.

## عند الفشل

```bash
systemctl status teacher-platform-monitor.service --no-pager
journalctl -u teacher-platform-monitor.service --since '30 minutes ago' --no-pager
sudo -u teacher-platform /opt/teacher-platform/current/scripts/check-operational-health.sh
```

- فشل live/readiness: اتبع `docs/runbooks/incident-response.md` وافحص الخدمة وPostgreSQL وNginx.
- backup مفقود أو قديم: افحص `teacher-platform-backup.service` و`teacher-platform-backup.timer` والمساحة و`age` والنسخة off-host. لا تعتبر إنشاء ملف فارغ علاجًا.
- Outbox متأخر: افحص سجل `teacher-platform.service` ووصول S3، ثم استخدم Retry من شاشة الشهادات بعد إصلاح المزود. لا تعدّل السجلات يدويًا لتصفير العداد.
- متغير أو executable مفقود: أصلح provisioning؛ السكربت يتوقف عمدًا ولا يتجاوز الفحص.

## التنبيه الخارجي

المستودع يوفر إشارة الفشل عبر exit code وحالة systemd، لكنه لا يفترض مزود Pager أو بريدًا بعينه. اربط فشل `teacher-platform-monitor.service` بمنصة المراقبة المعتمدة لدى المشغل، واختبر التنبيه عمدًا في بيئة staging قبل بدء الـpilot.
