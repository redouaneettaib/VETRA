# VETRA — État vérifiable de la livraison

**Nom :** VETRA — ONSSA / DPA (jamais PAOLEX, jamais DCPA).

## Sources intégrées
- `canevas_CASA_original.xlsx` : classeur CASA transmis (une seule feuille).
- `src/lib/casa.json` : 286 lignes renseignées de CASA.
- `src/lib/canevas.ts` : 20 rubriques, avec limites de lignes.

## Modules développés
- Next.js 15 / TypeScript / Tailwind / PostgreSQL / Prisma.
- Rôles et périmètres vérifiés dans les routes API.
- 12 régions, 12 divisions (une par région) initialisées par le seed.
- Administration : création des services, comptes, droits par rubrique ; API de modification de services et activation/désactivation des comptes.
- Rapport unique par service/mois/année (contrainte Prisma).
- Brouillon → Soumis → Validé ; Révoqué → Corrigé → Soumis → Validé, journal d'événements.
- Sous-tableaux distincts I.B.1 ; lignes complémentaires I.D et II.C.
- XLSX basé sur le fichier CASA original, préservant le classeur et ajoutant une feuille de lignes supplémentaires.
- PDF avec police Unicode intégrée.
- Reporting uniquement sur les rapports validés.

## Limites connues, à corriger avant production
- Aucun test de démarrage Next.js + PostgreSQL n'a pu être exécuté ici : installation npm et serveur PostgreSQL non disponibles dans cette session.
- L'écran d'administration n'expose pas encore toutes les actions d'édition existant dans l'API.
- Le partage WhatsApp et e-mail prépare des messages mais ne transmet pas automatiquement les fichiers ni un lien temporaire signé.
- Les 10 cartes KPI sont présentes, mais « en retard » utilise le statut non introduit et non une vraie règle de date limite.
- Les formulaires CASA doivent encore être vérifiés métier ligne par ligne (calculs, colonnes et unités).
- L'envoi SMTP OTP dépend d'une configuration SMTP valide. Aucune preuve de livraison réelle d'e-mail n'est disponible.
- Audit de sécurité et tests end-to-end non réalisés.

**Ne pas qualifier ce projet de finalisé ou prêt pour production.**
