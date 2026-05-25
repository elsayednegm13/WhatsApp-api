# WhatsApp API Admin

تطبيق إدارة رسائل WhatsApp API مبني على مرحلتين:

1. واجهة أمامية كاملة تعمل ببيانات Mock داخل `frontend/js/mockApi.js`.
2. باك إند كامل في `server/` مع ربط الواجهة عبر REST API وقاعدة بيانات ملفية محليًا أو Vercel KV/Upstash في الإنتاج.

## التشغيل

```powershell
node server/index.js
```

افتح:

```text
http://localhost:4317
```

يمكن تغيير المنفذ:

```powershell
$env:PORT="5000"; node server/index.js
```

## أهم المسارات

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/dashboard`
- `GET /api/messages`
- `POST /api/messages/send`
- `GET /api/auto-replies`
- `POST /api/auto-replies`
- `PATCH /api/auto-replies/:id`
- `DELETE /api/auto-replies/:id`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`
- `GET /api/settings/whatsapp`
- `PUT /api/settings/whatsapp`
- `GET /api/webhooks/whatsapp`
- `POST /api/webhooks/whatsapp`
- `POST /api/webhooks/whatsapp/simulate`

## الأمان

- كلمات المرور محفوظة باستخدام PBKDF2 مع Salt.
- التوكنات تستخدم HMAC وتدعم تسجيل الخروج عبر إبطال `jti`.
- إعدادات WhatsApp الحساسة تحفظ مشفرة باستخدام AES-256-GCM.
- `accessToken` و `appSecret` لا يرجعان إلى الواجهة بعد حفظهما.
- صلاحيات الصفحات والـ API تعتمد على الدور: `admin`, `supervisor`, `agent`, `viewer`.

## Webhook

تحقق WhatsApp:

```text
GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=demo_verify_token&hub.challenge=123
```

عند وصول رسالة، يحفظ الباك إند الرسالة الواردة، يفحص قواعد الردود التلقائية المفعلة حسب الأولوية، ثم يحفظ الرد الصادر ويرسله عبر وضع `mock` أو WhatsApp Cloud API عند تفعيل `sendMode=cloud` وإضافة بيانات الربط.

## النشر على Vercel

المشروع مجهز للنشر على Vercel بدون Framework:

- الواجهة موجودة في `frontend/`.
- كل طلبات `/api/*` تعمل عبر Serverless Function في `api/[...path].js`.
- إعدادات التوجيه موجودة في `vercel.json`.

افحص جاهزية ملفات النشر:

```powershell
npm run build
```

ثم ارفع المشروع على Vercel من GitHub أو عبر Vercel CLI.

متغير البيئة المطلوب في Vercel:

```text
APP_SECRET=replace-with-a-long-random-secret-at-least-32-chars
ADMIN_NAME=مدير النظام
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password
```

متغيرات اختيارية لكنها مهمة للإنتاج:

```text
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_DB_KEY=whatsapp-api-admin:db
WHATSAPP_GRAPH_VERSION=v20.0
```

بدون `KV_REST_API_URL` و `KV_REST_API_TOKEN` سيستخدم Vercel تخزينًا مؤقتًا داخل `/tmp`، وهذا مناسب للتجربة فقط لأن البيانات قد تُعاد تهيئتها عند cold starts. للإنتاج، فعّل Vercel KV أو Upstash Redis REST وضع القيم في Environment Variables.

بعد النشر، استخدم رابط الـ Webhook بهذا الشكل:

```text
https://your-domain.vercel.app/api/webhooks/whatsapp
```
