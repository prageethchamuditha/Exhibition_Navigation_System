# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

---

## 🚀 Deployed to Cloudflare Pages

To deploy the frontend application to Cloudflare Pages directly from your terminal:

### 1. Build the Production Bundle
Compile the React + Vite static assets inside the `dist` folder:
```bash
npm run build
```

### 2. Deploy via Wrangler CLI
Upload the bundle directly using the Cloudflare Pages Wrangler CLI:
```bash
npx wrangler pages deploy dist --project-name exhibition-navigation-system --branch main
```

### 3. Setup Environment Variables
Configure the environment variables in your Cloudflare dashboard under **Workers & Pages > exhibition-navigation-system > Settings > Environment Variables**:
*   `VITE_SUPABASE_URL`
*   `VITE_SUPABASE_ANON_KEY`
