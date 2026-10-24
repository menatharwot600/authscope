# نشر AuthScope على Render مجاناً (بدون كارت بنكي)

الفكرة: خدمة **Render Web Service** مجانية واحدة بتشغّل الـ API وبتقدّم الـ frontend كمان.
قاعدة البيانات من **Neon** (مجانية ودائمة)، وتسجيل الدخول من **Clerk** (مجاني). كلهم بدون كارت.

> متستخدمش Postgres بتاع Render المجاني: بيتمسح بعد 30 يوم.

## 1) ارفع المشروع على GitHub
```bash
cd AuthScope-Security-Lab
git init -b main && git add . && git commit -m "AuthScope for Render"
# اعمل repo فاضي على github.com ثم:
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```
ملف `.env` متجاهَل في `.gitignore`، فمفاتيحك مش هتترفع بالغلط.

## 2) قاعدة البيانات (Neon)
1. سجّل في https://neon.tech → **Create project** → Region: **AWS Frankfurt**.
2. من **Connect** اقفل خيار **Connection pooling** وانسخ الـ connection string
   (بيبدأ بـ `postgresql://` وبينتهي بـ `?sslmode=require`). ده هو `DATABASE_URL`.

## 3) تسجيل الدخول (Clerk)
1. سجّل في https://dashboard.clerk.com → **Create application** → فعّل **Email**.
2. من صفحة **API Keys** انسخ:
   - **Publishable key** (`pk_test_...`)
   - **Secret key** (`sk_test_...`)
   لازم الاتنين من نفس الـ application.

## 4) Render
1. سجّل في https://render.com (بحساب GitHub).
2. **New → Blueprint** → اختار الـ repo. هيقرا `render.yaml` ويطلب منك 4 قيم:

| المتغير | القيمة |
|---|---|
| `DATABASE_URL` | connection string من Neon |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| `VITE_CLERK_PUBLISHABLE_KEY` | **نفس** `pk_test_...` |
| `CLERK_SECRET_KEY` | `sk_test_...` |

3. اضغط **Apply** وانتظر البناء (حوالي 3–6 دقايق). بعدها افتح رابط `https://<name>.onrender.com`.

**لو ماعجبكش Blueprint:** New → Web Service → اختار الـ repo ثم
Runtime `Node` · Instance type `Free` · Region `Frankfurt` ·
Build: `bash scripts/render-build.sh` ·
Start: `node --enable-source-maps artifacts/api-server/dist/index.mjs` ·
Health check path: `/api/healthz` ·
وضيف المتغيرات الأربعة فوق + `NODE_ENV=production` + `NODE_VERSION=22`.

## ملاحظات
- الخدمة المجانية بتنام بعد 15 دقيقة بدون زيارات، وأول فتح بعدها ممكن ياخد حوالي دقيقة.
- `VITE_CLERK_PUBLISHABLE_KEY` بيتحط داخل الـ frontend وقت البناء، فلو غيّرته اعمل **Manual Deploy**.
- الجداول بتتعمل/تتحدّث أوتوماتيك في كل deploy (`drizzle-kit push`)؛ لو غيّرت الـ schema بشكل يمسح بيانات هيقف ويطلب تأكيد، ساعتها شغّله من جهازك.
- Clerk في وضع Development بيعرض شارة "Development mode"، وده طبيعي لمشروع تعليمي.

## لو حصلت مشكلة
- `Set DATABASE_URL...` / `Set VITE_CLERK_PUBLISHABLE_KEY...` وقت البناء: المتغير ناقص في Render → Environment.
- الصفحة بتفتح بس بعد تسجيل الدخول الـ API بيرجّع 401: `CLERK_SECRET_KEY` من application مختلفة عن الـ publishable key.
