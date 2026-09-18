# MediClarity agent notes

This repository is a working Next.js 15 health-information product. Do not re-run the historical Agent 0–5 execution plan; those items are implemented or explicitly deferred.

Read `README.md` first. Product claims, routes, env templates, and gitignore rules live there.

## Current stack

Next.js 15, Clerk, MongoDB/Mongoose, Cloudinary, Mistral OCR, Groq (or Ollama), Stripe, Cloudflare Workers voice agent. Gemini, Pinecone, LangGraph, and blockchain are not part of the runtime.

## Safety while editing

- Derive identity with Clerk `auth()` on protected APIs. Never trust a client-supplied `userId`.
- Do not diagnose, prescribe, or invent lab reference ranges. Source-lab intervals stay authoritative.
- Every patient-facing AI surface must keep the information-only disclaimer.
- Never commit `.env`, `.dev.vars`, real patient documents, OCR dumps, or `sample-reports/*.pdf`.
- Copy `.env.example` and `cloudflare/voice-agent/.dev.vars.example`. Generate Worker types with `npm run cf-typegen` inside `cloudflare/voice-agent`.

## Out of scope unless the user asks

Wearables, predictive analytics, e-prescribing, custom telehealth video, emergency SOS, and blockchain.
