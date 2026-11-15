# ExamCraft AI — ابدأ من هنا

الحزمة دي بتجهز Antigravity عشان يبني المشروع بمواصفات واضحة واختبارات تكشف الأخطاء. **دي مش نسخة الموقع النهائية، وAntigravity لسه ما اتشغّلش من المحادثة دي.** الموجود فعليًا: خطة تنفيذ، تصميم تقني وبصري، برومبتات تشغيل ومراجعة، بيانات تجربة، ومدقق مستقل لنتائج الجداول.

## تعمل إيه دلوقتي؟

1. فك ضغط الحزمة.
2. لو لسه مفيش كود: افتح الفولدر الناتج نفسه في Antigravity كـ Workspace. هيبني التطبيق جواه.
3. لو عندك مشروع بدأ بالفعل: خلي الحزمة في فولدر مرجعي داخل المشروع، وقل له مسارها. ما تستبدلش ملف AGENTS.md موجود عندك تلقائيًا؛ خليه يقرأ قواعد المشروع والمواصفات ويحافظ على الشغل الموجود.
4. افتح `01_MASTER_PROMPT.md` وانسخ البرومبت الموجود بعد الخط الفاصل في محادثة Antigravity. أو استخدم البرومبت القصير تحت.
5. لو النسخة عندك طلبت مراجعة Implementation Plan، راجع نطاق الملفات والمواصفات قبل المتابعة. ما تغيّرش إعدادات الصلاحيات لمجرد تشغيل الحزمة.
6. ابعت هنا أول `docs/IMPLEMENTATION_STATUS.md` يطلعه، ومعاه رد Antigravity أو رسالة الخطأ لو فيه توقف. ده اللي هنستخدمه لمراجعة التنفيذ وتحديد الأمر التالي.

## البرومبت المختصر

```text
Read and execute 01_MASTER_PROMPT.md in this workspace. The folder is an ExamCraft AI specification and independent verification kit, not an already built application. Read AGENTS.md and the linked contracts first. Inspect and preserve any existing project. Create the short implementation plan, then build and verify Gates A–D in docs/DELIVERY_PLAN.md within existing permissions. Implement real BFS, DFS, Greedy Best-First and A*, genuine live events and controls, a complete timetable dashboard, real PDF/XLSX/JSON exports, and honest algorithm comparison. Do not stop at a plan or mockup. Update docs/IMPLEMENTATION_STATUS.md with actual commands, results, blockers, and the tested running URL at each gate. Begin with Gate A now and continue when its checks pass.
```

لو الملفات في فولدر مرجعي داخل مشروع قديم، ابدأ البرومبت باسم الفولدر الفعلي عشان يقرأ المسار الصحيح.

## أهم الملفات

| الملف | استخدامه |
| --- | --- |
| `01_MASTER_PROMPT.md` | أمر التنفيذ الكامل |
| `AGENTS.md` | قواعد المشروع التي تحافظ على صحة التنفيذ |
| `docs/PRODUCT_AND_ACCEPTANCE.md` | كل الشاشات والخصائص ومعايير القبول |
| `docs/DATA_CONTRACT.md` | شكل البيانات والتواريخ والقيود والنسخ المحفوظة |
| `docs/SEARCH_CONTRACT.md` | تعريف الحالة والأفعال والتكلفة والـ heuristic والإحصائيات |
| `docs/ARCHITECTURE.md` | تقسيم الكود والـ API والتحكم في التنفيذ والحفظ |
| `docs/UX_DIRECTION.md` | شكل الـ Search Lab والـ Timetable والتفاصيل البصرية |
| `docs/DELIVERY_PLAN.md` | ترتيب البناء وبوابات التحقق |
| `docs/IMPLEMENTATION_STATUS.md` | الحالة الحقيقية للمشروع ومكان التوقف |
| `fixtures/` | بيانات صغيرة بإجابات متوقعة وحالات خاطئة متعمدة |
| `verification/` | مدقق مستقل للجدول وحساب الجودة، واختبارات خاصة به |
| `prompts/` | أوامر استكمال ومراجعة وإصلاح وتدقيق نهائي |

## القرارات اللي ثبتناها

- المحرك Python، والواجهة React + TypeScript، والـ API FastAPI، والحفظ المحلي SQLite، إلا لو فيه مشروع موجود يستدعي الحفاظ على بنيته.
- كل مادة لها امتحان واحد في قاعة واحدة. تقسيم امتحان على عدة قاعات خارج النسخة الأولى.
- عدد الطلبة بيتحسب من التسجيلات. تداخل الوقت بيتحسب من بداية ونهاية الامتحان الفعلية، مش من اسم الـ Slot.
- القيود الإجبارية منفصلة عن تفضيلات الجودة. جدول صالح مش بالضرورة أفضل جدول.
- A* بيحاول يقلل تكلفة محددة. مش هنعتبره صح لمجرد إنه أسرع أو زراره مكتوب عليه A*.
- كل تشغيل مرتبط بنسخة بيانات ثابتة. التعديل بعد الحل ما يغيرش حقيقة النتيجة القديمة.
- Pause بيوقف تقدم المحرك نفسه، وStep بتحرك حدثًا واحدًا محددًا. زمن الأنيميشن مش داخل مقارنة سرعة البحث.
- نهاية المهلة أو حد العقد معناها البحث ما خلصش، مش إن الجدول مستحيل.

## إيه اللي اتختبر فعلًا؟

المدقق المستقل وبياناته الصغيرة اتشغّلوا. التفاصيل الفعلية في `verification/VERIFIED_RESULTS.md`. اختبارات الموقع نفسه والخوارزميات الأربع وشاشاته والتصدير لسه مسؤولية التنفيذ التالي داخل Antigravity؛ الحزمة ما بتدّعيش إنهم نجحوا بالفعل.

المثال الصغير فيه جدول صالح بتكلفة 130 وجدول صالح أفضل بتكلفة صفر لنفس الطلبة والمواد. اختبار A* النهائي لازم يطابق أفضل تكلفة معروفة. أوقات التنفيذ وأعداد العقد لازم تتحسب من التطبيق الحقيقي.

## بخصوص التحكم المباشر

تجهيز البرومبتات والمراجعة ممكن هنا، لكن التحكم المباشر يحتاج جلسة Antigravity متاحة ومتصلة. فحص التطبيقات في هذه الجلسة لم يجد Antigravity. وجود ميزة Remote Control في توثيق Antigravity لا يعني أن جهازك متصل تلقائيًا. ما فيش حساب أو جلسة جديدة اتعملت ضمن الحزمة.

للنسخة الحالية من تعليمات Antigravity ومراجع الخوارزميات، راجع `docs/SOURCES.md`.
