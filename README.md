# Kubernetete

App web para aprender Cloud (GCP, AWS, Azure), Kubernetes, Terraform y Ansible, desde principiante hasta nivel de entrevista técnica.

```bash
npm install
npm run dev
```

- Tests: `npm test` · e2e: `npm run test:e2e` (la primera vez: `npx playwright install chromium`)
- Build: `npm run build`
- Arquitectura: [ARCHITECTURE.md](ARCHITECTURE.md) · Decisiones: [DECISIONS.md](DECISIONS.md)

Se publica en GitHub Pages automáticamente al hacer push a `main` (hay que activar *Settings → Pages → Source: GitHub Actions* en el repo).
