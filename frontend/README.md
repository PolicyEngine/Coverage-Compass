# Healthcare Crossroads Frontend

This Next.js app presents a healthcare-focused scenario explorer for conference demos and policy conversations.

## Getting Started

Run the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Set `BACKEND_URL` in `frontend/.env.local` to point at the simulation API.

## What It Shows

- Before-and-after healthcare coverage for each household member
- Medicaid, CHIP, and ACA marketplace transitions
- Coverage-related financial changes like the premium tax credit

## Deploying

Deploy on Vercel or any Next.js-compatible platform once `BACKEND_URL` is configured for the target environment.

For framework details, see the [Next.js documentation](https://nextjs.org/docs).
