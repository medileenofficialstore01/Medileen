# MEDILEEN — AI Skin Analysis Web App

Next.js 16 web app ที่ให้ผู้ใช้อัปโหลดรูปหน้า → ระบบ AI วิเคราะห์สภาพผิว → แสดงผลพร้อมแนะนำสินค้า MEDILEEN → ส่งผลเข้า LINE chat

> สถานะปัจจุบัน: **Prototype พร้อม mock APIs** — สามารถกดใช้งานได้ครบทุกขั้นตอน
> ขั้นต่อไป: เปลี่ยน mock เป็น API จริงของ YouCam และ LINE

## Quick start

```bash
cd medileen-web
npm install
npm run dev
```

เปิด http://localhost:3000

## โครงสร้างโปรเจกต์

```
medileen-web/
├── src/
│   ├── app/
│   │   ├── page.tsx                        Landing page
│   │   ├── analyze/page.tsx                หน้าอัปโหลดรูป
│   │   ├── result/[id]/page.tsx            หน้าผลตรวจ
│   │   ├── dashboard/page.tsx              ประวัติการตรวจ
│   │   └── api/
│   │       ├── youcam/analyze/route.ts     [Mock] เรียก YouCam Skin Analysis
│   │       └── line/send/route.ts          [Mock] Push message เข้า LINE
│   ├── components/                         Header / ProductCard / SkinScoreBar
│   └── lib/
│       ├── products.ts                     Catalog สินค้า MEDILEEN (8 รายการ)
│       ├── recommender.ts                  Logic จับคู่ผลตรวจ → สินค้า
│       ├── youcam-mock.ts                  Mock generator คะแนนผิว 8 ด้าน
│       ├── store.ts                        In-memory store (ใช้ DB จริงในโปรดักชั่น)
│       └── types.ts                        TypeScript types
└── package.json
```

## การเปลี่ยน Mock เป็น API จริง

### 1. YouCam (Perfect Corp) AI Skin Analysis

1. สมัคร business account ที่ https://yce.perfectcorp.com/
2. ขอเปิด **AI Skin Analysis API** (paid)
3. เก็บ `API_KEY` / `API_SECRET` ใน `.env.local`:
   ```
   PERFECT_CORP_API_KEY=...
   PERFECT_CORP_API_SECRET=...
   ```
4. แก้ `src/app/api/youcam/analyze/route.ts`:
   - ขอ access token จาก `POST /s2s/v1.0/client/auth`
   - ส่งรูปไป `POST /s2s/v1.0/task/skin-analysis`
   - Map response → `SkinScore[]` ของเรา (กำหนด threshold severity เอง)

### 2. LINE Messaging API

1. สร้าง Provider + Channel (Messaging API) ที่ https://developers.line.biz/console/
2. เก็บ token ใน `.env.local`:
   ```
   LINE_CHANNEL_ACCESS_TOKEN=...
   LINE_CHANNEL_SECRET=...
   LINE_LOGIN_CHANNEL_ID=...
   ```
3. เพิ่ม **LINE Login** เพื่อให้ผู้ใช้ login → ได้ `userId`
4. ติดตั้ง `npm install @line/bot-sdk`
5. แก้ `src/app/api/line/send/route.ts` ให้ใช้ `Client.pushMessage(userId, message)`
6. (แนะนำ) ทำ Flex Message แทน text เพื่อให้ผลตรวจสวยใน LINE

### 3. Database (เปลี่ยน in-memory store)

ตอนนี้ `src/lib/store.ts` ใช้ `Map` ใน memory ซึ่งจะหายเมื่อ restart server
แนะนำเปลี่ยนเป็น **Supabase** หรือ **Postgres + Prisma**:

- เก็บ `users` (LINE user id, profile)
- เก็บ `analyses` (image url, scores JSON, created_at)
- เก็บรูปใน Supabase Storage หรือ S3

## คำสั่งที่ใช้บ่อย

```bash
npm run dev       # Dev server (port 3000)
npm run build     # Production build
npm run start     # Run production build
npm run lint      # ESLint
```

## หมายเหตุ

- ใช้ **Next.js 16** (App Router, Turbopack default, async `params`/`searchParams`)
- ใช้ **Tailwind CSS v4** (CSS-based theme ใน `globals.css`)
- รองรับภาษาไทยด้วยฟอนต์ **Prompt** จาก Google Fonts
