# IBDP Tutoring Platform — Backend

Node.js + Express + MongoDB API with modular **controller → service → repo → model** architecture.

## Stack

- Express.js REST API
- MongoDB + Mongoose
- Phone OTP auth (demo OTP: `123456`)
- Manual **Pay** flow (no payment gateway)
- Admin-fed CMS + live analytics

## Setup

1. Install [MongoDB](https://www.mongodb.com/) and start it locally.
2. From `backend/`:

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

API: `http://localhost:5000`  
Health: `GET /health`

## Demo accounts (after seed)

| Role | Phone | OTP |
|------|-------|-----|
| Admin | 9999999999 | 123456 |
| Tutor (approved) | 8888888888 | 123456 |
| Student | 7777777777 | 123456 |
| Parent | 6666666666 | 123456 |

## Auth (curl)

```bash
curl -X POST http://localhost:5000/api/auth/send-otp -H "Content-Type: application/json" -d "{\"phone\":\"7777777777\"}"

curl -X POST http://localhost:5000/api/auth/verify-otp -H "Content-Type: application/json" -d "{\"phone\":\"7777777777\",\"otp\":\"123456\",\"role\":\"student\",\"name\":\"Demo Student\"}"
```

Use the returned `token` as `Authorization: Bearer <token>`.

## Manual Pay flow

1. Student creates a booking → pending payment created  
2. `GET /api/payments/payable` — shows Pay-ready invoices  
3. `POST /api/payments/:id/pay` — status → `awaiting_confirmation`  
4. Admin `PATCH /api/admin/payments/:id/status` with `{ "status": "paid" }`

## Key route prefixes

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | OTP login |
| `/api/users` | Profile + admin user list |
| `/api/students` | Student dashboard |
| `/api/subjects` | Catalog + student select |
| `/api/tutors` | Search, availability, verification |
| `/api/bookings` | Book / cancel / reschedule |
| `/api/resources` | Learning library |
| `/api/homework` | Assignments + submit/grade |
| `/api/progress` | Progress + badges |
| `/api/parents` | Link child + dashboard |
| `/api/messages` | REST chat |
| `/api/notifications` | In-app notifications |
| `/api/payments` | Payable, Pay, plans, earnings |
| `/api/cms` | Announcements, campaigns, tickets, configs |
| `/api/analytics` | Admin overview + per-tutor performance |
| `/api/admin` | Admin orchestration |

### Tutor notes & lesson plans

```bash
POST /api/tutors/me/notes
GET  /api/tutors/me/notes?studentUserId=...
DELETE /api/tutors/me/notes/:noteId

POST /api/tutors/me/lesson-plans
GET  /api/tutors/me/lesson-plans
PATCH /api/tutors/me/lesson-plans/:planId
DELETE /api/tutors/me/lesson-plans/:planId
```

### Tutor search availability

`GET /api/tutors?available=true`  
`GET /api/tutors?availableFrom=ISO&availableTo=ISO`

## Folder layout

```text
src/modules/<feature>/
  *.routes.js
  *.controller.js
  *.service.js
  *.repo.js
  *.model.js
  *.validator.js
```

Full product/tech spec: [`../docs/SPEC.md`](../docs/SPEC.md)
