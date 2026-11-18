# VETRA — ONSSA / DPA

Projet source Next.js 15 + TypeScript + Tailwind CSS + PostgreSQL/Prisma, construit sur la **feuille CASA** du classeur transmis. Les 20 rubriques I.A.1 à VI.B sont présentes dans `src/lib/canevas.ts`, les lignes et libellés réels dans `src/lib/casa.json`.

## Préparation

1. Installer Node.js 20+ et PostgreSQL 15+.
2. Copier `.env.example` vers `.env`. Définir `DATABASE_URL`, `SESSION_SECRET` (32 caractères minimum) et `SEED_ADMIN_PASSWORD` (12 caractères minimum).
3. `npm install`
4. `npx prisma migrate dev --name init`
5. `npm run db:seed`
6. `npm run dev` puis ouvrir `http://localhost:3000`.

Le seed crée les 12 directions régionales, leurs 12 divisions et un compte administrateur. **Il ne crée aucun service ni aucune donnée métier fictive.** L'administrateur doit créer les services et les utilisateurs avec leurs véritables rattachements.

## Modules inclus

- Connexion par e-mail et mot de passe, sessions HTTP-only ; OTP par e-mail activé sauf `REQUIRE_LOGIN_OTP=false` (réservé aux tests).
- Réinitialisation du mot de passe via OTP et SMTP.
- Administration des services, utilisateurs et habilitations par rubrique.
- Saisie par cartes des 20 rubriques CASA, sauvegarde et workflow sur le rapport complet.
- Tableaux de bord par périmètre, reporting consolidé uniquement sur les rapports validés.
- Exports XLSX et PDF téléchargeables ; boutons de partage qui ouvrent e-mail / WhatsApp avec message prérempli (les pièces jointes doivent être ajoutées manuellement).

## Limites connues — ne pas considérer comme prêt pour production

- Le XLSX est **reconstitué à partir des valeurs et positions de CASA** : les styles originaux, cellules fusionnées et formules complexes ne sont pas encore préservés.
- Le PDF est fonctionnel mais utilise une police standard qui ne reproduit pas correctement les accents français ; intégrer une police Unicode avant production.
- Les tableaux TIAC et retrait/rappel reprennent les lignes du canevas, mais l'ajout dynamique de lignes non prévues dans Excel reste à développer.
- Les sous-tableaux I.B.1 sont séparés par des intitulés, mais pas encore par trois composants de saisie indépendants.
- Le partage sécurisé de documents par lien temporaire et l'envoi automatique de pièces jointes ne sont pas implémentés.
- L'écran d'administration ne permet pas encore de modifier ou désactiver toutes les entités existantes.
- Les tests d'intégration et le démarrage avec PostgreSQL **n'ont pas été exécutés dans cet environnement**, faute de serveur PostgreSQL et d'installation npm aboutie.

## Sécurité

Les autorisations de lecture/écriture sont contrôlées dans l'API. Le compte national ne peut pas valider les rapports. Le chef de division ne peut pas modifier les chiffres. Les mots de passe sont hachés avec bcrypt. Les sessions sont signées. Avant usage réel, prévoir HTTPS, politique de sauvegarde, limitation de tentatives de connexion, audit externe et revue de sécurité.

## GitHub

Le projet peut être déposé dans `redouaneettaib/VETRA`. GitHub est le dépôt du **code source** ; aucun déploiement n'est nécessaire pour importer les fichiers. Ne jamais commiter `.env`.
