# Coverage Compass

Model how life events affect a household's healthcare coverage and monthly out-of-pocket cost across **Medicaid**, **CHIP**, and the **ACA marketplace**.

Live: https://coverage-compass-policy-engine.vercel.app/

## What it covers

- ACA marketplace plans (silver/bronze tier comparison, premium tax credit, full unsubsidized cost)
- Medicaid eligibility per person (state-specific thresholds for adults vs. kids)
- CHIP eligibility plus enrollment fees in the 17 states that charge them
- Life events: income changes, moving (state or area), losing job-based coverage, becoming pregnant, ending pregnancy

Households with employer-sponsored insurance are screened out at the start because we don't model employer premium contributions.

## Architecture

- **Frontend** (`frontend/`): Next.js + Tailwind, deployed on Vercel
- **Backend** (`healthcare_crossroads/`): Flask + PolicyEngine US, deployed on Modal as serverless functions

## Local development

```bash
# Backend (Flask)
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e .
python -m healthcare_crossroads.api  # serves on :8080

# Frontend (Next.js)
cd frontend
npm install
echo "BACKEND_URL=http://localhost:8080" > .env.local
npm run dev  # serves on :3000
```

## Deploying

Frontend (Vercel): `cd frontend && vercel --prod` after each frontend change.
Backend (Modal): `modal deploy modal_app.py` after any change under `healthcare_crossroads/`.

`git push` does not auto-deploy either side until the Vercel project's Root Directory is set to `frontend`.

## License

MIT
