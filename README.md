# AIMLab Website

![AIMLab website](assets/img/lab/og-cover.png)

The website of the **AI in Medicine Lab (AIMLab)**, Institute of Intelligent Bioelectrical Engineering,
National Yang Ming Chiao Tung University. Bilingual (English / 繁體中文), designed and built by
**Meng-Ching Chen** ([Chen-MouChin](https://github.com/Chen-MouChin)).

| | |
|---|---|
| **Live** | https://chen-mouchin.github.io/aimlab-site-preview/ |
| **Deployed for AIMLab** | https://ai-in-medicine-lab.com/ |

This repository holds the built static site. The source, the admin panel and the content server are
kept in a private repository.

---

## Pages

| Page | What it shows |
|---|---|
| Home | Lab introduction, recent achievements, research programs, latest news |
| Programs | Frontier AI and clinical AI programs, each with a live or still cover |
| Program pages | rPPG, MLLM and CAG: overview, demo, system flow, method, team, related work |
| Publications | Every paper with year jump and journal / conference filter, ranked by venue |
| People | PI profile, members sorted by degree, program lead and seniority, alumni |
| News · Join Us | News by year; how to apply |
| [Contactless Pulse Monitor](demo/rppg-monitor.html) | Interactive rPPG demo: pulse waveform, signal states, session report (simulated signal, no camera) |

## Highlights

- **Bilingual everywhere.** Every page, every data field and every admin form has English and
  Traditional Chinese; the choice is remembered per visitor.
- **Content as data.** News, people, programs, publications and achievements live in JSON files, so the
  lab updates the site without touching HTML. The program pages are one template filled from data.
- **Explainer visuals.** The rPPG cover animates a 3-D face mesh (MediaPipe canonical model) with the
  pulse signal; the MLLM cover draws the multimodal pipeline on canvas.
- **Publications pipeline.** The list is generated from the lab spreadsheet, ORCID and Crossref, and
  ordered by CORE / SCImago venue rank.
- **Built for phones too.** Checked at six screen sizes in both languages. The header shrinks and hides
  while scrolling on phones; animations pause off screen and honour reduced-motion settings.
- **Ready to be found and shared.** Page descriptions, Open Graph cover, sitemap, robots.txt and a 404 page.
- **No framework, no build step** for the public site: plain HTML, CSS and JavaScript. Chart.js loads
  only on pages with charts.

## Behind the site

Not part of this repository, listed to show how the site is run:

- **Admin panel and content server** (Vue 3 + Vite, Node.js + Express), co-developed with
  **[Hsu-Cheng Wu](https://github.com/wuxuchengee14)** (AIMLab CAG Program). Lab members edit content in forms instead of raw JSON.
- **Safe by default.** The server runs on the local machine only and serves an allowlist of public
  files; passwords are bcrypt-hashed, logins are throttled and expire, and every save is checked on the
  server with the same rules as the editor.
- **Tested.** Automated tests cover the validation rules, the save API and the admin editors.
- **Publishing.** A script builds the static site from an allowlist of tracked files, so internal
  material can never be published. Builds for each address rewrite the site URL.

## Credits

- Site design, frontend, program pages, rPPG demo and visuals: **[Meng-Ching Chen](https://github.com/Chen-MouChin)**
- Admin panel and content server: **[Hsu-Cheng Wu](https://github.com/wuxuchengee14)** and **[Meng-Ching Chen](https://github.com/Chen-MouChin)**
- Lab content: AIMLab members
- Third-party: MediaPipe face model (Apache 2.0), Chart.js (MIT), Plus Jakarta Sans (OFL)

## License

Copyright © 2026 Chen-MouChin. All rights reserved. AIMLab holds a limited licence to host its official
website. No copying, redistribution or reuse as a template without written permission. See [LICENSE](LICENSE).
