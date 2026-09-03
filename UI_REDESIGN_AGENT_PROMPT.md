# English Spark — UI Visual Polish Agent Prompt

## ‼️ COPY THIS ENTIRE BLOCK AS YOUR PROMPT TO THE NEW AGENT ‼️

---

أنت مطلوب تنفذ إعادة تصميم بصرية شاملة لتطبيق English Spark. كل التفاصيل موجودة في ملف واحد:

**📄 اقرأ هذا الملف أولاً وبالكامل قبل أي تعديل:**
```
@f:\teacher\UI_REDESIGN_EXECUTION_PLAN.md
```

## التعليمات

1. **اقرأ الملف كاملاً** — فيه كل الـ context والـ current code والـ exact changes المطلوبة
2. **أنشئ feature branch:** `git checkout -b feature/ui-visual-polish`
3. **نفذ المراحل بالترتيب** (0 → 1 → 2 → 3 → 4) مع تشغيل الاختبارات بعد كل مرحلة:
   ```
   cd apps/web && npm run typecheck && npm run lint && npm run test
   ```
4. **المرحلة 0** هي إغلاق PR #12 على GitHub — افتح الرابط وأغلقه بالتعليق الموجود في الملف
5. **بعد الانتهاء:** شغّل `npm run build` للتأكد من عدم وجود أخطاء، ثم خذ screenshots لكل الصفحات العامة

## القواعد الإلزامية
- **لا تعدل أي ملف في `backend/`** — التعديلات CSS/TSX فقط في `apps/web/src/`
- **لا تعدل routing أو business logic**
- **8 ملفات فقط** مطلوب تعديلها — كلها مذكورة في الملف بالتفصيل
- الخط **Cairo** محمّل فعلاً في `index.html` — فقط يحتاج تفعيل في CSS
- **احتفظ** بلون الأخضر لأزرار الطالب والبنفسجي لأزرار المعلم

## ما تتوقعه بعد التنفيذ
- كل النصوص العربية بخط Cairo
- خلفيات نظيفة بدون زخارف كرتونية (Bb, ?, نجوم)
- لا gradient text
- لا floating decorations (⭐ ⚡)
- لا uppercase tracked eyebrows فوق كل section
- لا numbered markers (01/02/03)
- صفحة Signup بنفس مستوى Login (two-column)
- كل الاختبارات تمر + build ناجح

---
