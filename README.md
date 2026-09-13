# NEXTGEN MINER — 12 Miner Catalog UI Patch

GitHub-ready source replacements:

- `app/miners/page.tsx`
- `components/miner/MinerCard.tsx`

Backend economic rules are already applied in Supabase production.

Catalog:
1. Starter Keyboard
2. Basic CPU
3. Entry GPU
4. Mini Rig
5. Gaming PC
6. Performance Rig
7. Hydro Rig
8. Quantum Rig
9. Titan Rig
10. Nebula Station
11. Orion Core
12. Nuclear Reactor

Rules:
- 10 levels each
- Efficiency 100% → 118%
- 2 identical miners at the same level → next level
- Merge fee: 25, 50, 100, 200, 400, 800, 1600, 3200, 6400 Diamond
- Multiple copies are allowed for paid miners
- Starter Keyboard remains a one-time free onboarding item
- First 1,000 eligible registrations receive Entry GPU via the existing launch campaign
- Mining remains revenue-funded; no guaranteed return

Do not modify:
- `components/landing/LandingPage.tsx`
- `components/landing/NetworkCore.tsx`
