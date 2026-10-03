# Déploiement

## Variables d'environnement
- `DATABASE_URL` : chaîne de connexion PostgreSQL (Neon). Voir `.env.example`. Ne jamais la committer.

## Base de données (une fois, puis à chaque changement de schéma)
```
npm run db:migrate      # applique drizzle/*.sql sur DATABASE_URL
```
Après une modification de `src/db/schema.ts` : `npm run db:generate`, relire le SQL généré dans `drizzle/`, committer, puis `npm run db:migrate`.

## Vérifications avant mise en ligne
```
npm ci
npm test
npm run lint
npm run build
```

## Notes
- `/api/seed` remplace toutes les données par des données de démonstration : ne pas l'exposer ni l'utiliser en production.
- Les polices sont auto-hébergées (`src/app/fonts`), le build n'a pas besoin d'accès à Google Fonts.
