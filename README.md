# VETRA — ONSSA / DPA

VETRA gère les rapports mensuels des services vétérinaires provinciaux et frontaliers. Cette version reprend le dépôt `redouaneettaib/VETRA`, branche `main` au commit `e4528f3b2c4059ee5f23b7db35170d07e90872c7`, et le canevas `CASA` de son classeur original. Les logos ONSSA et VETRA fournis sont affichés à la connexion, dans le portail et dans le PDF.

## Utiliser une installation existante

Conserver la configuration de l'installation, notamment `DATABASE_URL`, `SESSION_SECRET`, les réglages OTP et SMTP. Le schéma Prisma est identique à celui du dépôt source. Cette version ne requiert aucune migration ou initialisation de la base existante. Elle reprend les comptes, rattachements, habilitations, rapports et journaux via le même schéma.

Sur un environnement de recette, installer les dépendances avec `npm ci`, compiler avec `npm run build` et démarrer avec `npm start`. Utiliser une instance PostgreSQL de recette et les réglages de recette. Le seed sert à initialiser une base neuve. Le code de connexion utilise SMTP si `REQUIRE_LOGIN_OTP` est activé ou absent.

Pour l'envoi d'e-mails, renseigner côté serveur `SMTP_HOST`, `SMTP_FROM` et au besoin `SMTP_PORT` (587 par défaut, TLS implicite sur 465), `SMTP_USER` et `SMTP_PASS`. Ces réglages sont partagés avec les codes de connexion. Le test des routes d’envoi en recette peut être activé avec `VETRA_TEST_SMTP_CAPTURE=true` et un serveur SMTP local de capture, configuré pour ne rien transmettre.

### Connexion et authentification

La page de garde utilise une photo en filigrane plein écran. L’identification se fait avec le mot de passe, puis le code OTP transmis par e-mail. Le code est valable 10 minutes et accepte jusqu’à cinq tentatives de vérification. Le lien « Mot de passe oublié ? » permet de choisir et confirmer un nouveau mot de passe avec un code de réinitialisation dédié.

Docker Compose active l’OTP par défaut. Si l’environnement de production contient déjà `REQUIRE_LOGIN_OTP=false`, remplacez cette valeur par `REQUIRE_LOGIN_OTP=true` une fois le SMTP opérationnel. Les variables d’envoi sont communes aux codes et aux rapports. Sur Vercel, ouvrir **Settings → Environment Variables**, appliquer les variables à **Production**, puis redéployer pour appliquer les changements. Vérifier que le SMTP est opérationnel avant d’activer l’OTP sur le site en service.

## Utiliser le portail

- Les huit indicateurs du **Tableau de bord** sont répartis sur deux rangées de quatre sur grand écran. La carte du Maroc colore les régions selon la proportion de services disposant d’un rapport saisi pour le mois sélectionné. L’écart en points utilise le même périmètre de services pour le mois précédent. Une région hors périmètre ne fournit aucun taux.
- La cloche présente une ventilation des rapports non validés par statut. Le lien en bas du panneau ouvre la liste filtrée pour la période sélectionnée.
- Les données de la carte proviennent de [morocco-map 1.3.0](https://github.com/yousfiSaad/morocco-map) de Saad Yousfi, sous [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Le TopoJSON d’origine est fourni dans `public/cartographie/regions-maroc.topo.json`. Les contours projetés et simplifiés sont dans `src/lib/regions-maroc.json` sous la même licence.


- La cloche ouvre la liste des rapports non validés pour le mois et l’année sélectionnés, dans le périmètre du compte. Le compteur inclut les brouillons, soumis, révoqués et corrigés existants.
- **Administration** ouvre quatre vues distinctes : Organisation, Services, Comptes utilisateurs et Habilitations.
- Le menu du compte propose **Modifier mon mot de passe**. Le mot de passe actuel et la confirmation du nouveau sont requis. La session en cours reste ouverte.
- La **Direction centrale** peut révoquer un rapport soumis ou validé. Le motif est obligatoire et figure dans l’historique. Un rapport révoqué suit le parcours habituel de correction et de nouvelle validation.


- Le chef de service renseigne les rubriques habilitées dans l’ordre du canevas. « Enregistrer et continuer » valide l’étape et ouvre la suivante. Les rubriques déjà enregistrées restent modifiables tant que le rapport est ouvert.
- Le chef de division consulte les rapports de sa division. Il peut valider un rapport soumis ou le renvoyer au chef de service en motivant la révocation. La correction peut être enregistrée plusieurs fois avant sa nouvelle soumission.
- Le directeur régional consulte son périmètre. La direction centrale consulte la consolidation nationale. L'administrateur national gère les services, les comptes et les habilitations par rubrique.
- Le tableau de bord distingue les services attendus, les rapports saisis et leurs statuts. Il est filtrable par région et par type de service. La consolidation prend uniquement les rapports validés du périmètre et de la période sélectionnée.
- Le suivi du reporting présente les états de transmission, la répartition en anneau, les taux par région, les volumes mensuels et les rapports à suivre. Les indicateurs métiers détaillés restent calculés sur les rapports validés du périmètre choisi.
- Dans **Reporting officiel**, choisissez un rapport mensuel ou annuel, puis le périmètre global ou plusieurs régions ou services. Sélectionnez les rubriques et dépliez leurs tableaux. Un clic sur un indicateur du tableau met à jour la courbe.
- Les courbes montrent les mois de l'année ou un historique de 3, 5 ou 10 ans. Les barres comparent les entités sélectionnées sur la période du rapport. L'absence de saisie est signalée par un tiret, tandis qu'un zéro saisi est affiché. Les taux de non-conformité ne sont pas additionnés et restent visibles lorsqu'une seule observation est disponible.
- Les boutons **Excel** et **PDF** du reporting exportent la sélection active. Excel contient la couverture, les séries chronologiques et les feuilles par rubrique. Le PDF comprend les courbes de l'indicateur actif et les tableaux par périmètre. Le PDF mensuel depuis la saisie et la liste des rapports reprend les tableaux du canevas.
- Le bouton **E-mail** ouvre un formulaire avec le destinataire comme seul champ. Le serveur génère le PDF affiché et le joint automatiquement au message. Le rapport du reporting reprend les filtres actifs.
- Le bouton **WhatsApp** prépare le PDF pour le menu de partage du téléphone si le navigateur accepte les pièces jointes. Sur les autres appareils, utilisez les liens pour télécharger le PDF et ouvrir WhatsApp, puis joignez le fichier.

## Reproduire les vérifications

Prérequis locaux utilisés pour la recette de code — Node.js 24 et PostgreSQL 18. `npm test` vérifie les formulaires, les formules et le contenu des exports. Ces tests ne nécessitent pas de base.

Le parcours fonctionnel s'exécute contre un PostgreSQL local avec une base jetable vide nommée `vetra_test`. Les variables ci-dessous concernent exclusivement cette recette locale. Adapter le port, le nom d'utilisateur et le mot de passe à l'instance de test.

```sh
export DATABASE_URL=postgresql://vetra_test:local@127.0.0.1:55432/vetra_test
export SESSION_SECRET=vetra-session-locale-pour-tests-seulement
export REQUIRE_LOGIN_OTP=false
npm ci
npx prisma db push
npm run build
npm test
npm start -- -p 3100
```

Dans un autre terminal, avec la même `DATABASE_URL`, exécuter `node tests/functional.mjs`. Le scénario crée et nettoie ses propres données de test. Il couvre les rôles, les habilitations, la modification concurrente, le journal, le workflow et les exports.

### OTP sur Railway sans SMTP

Railway Free interdit le SMTP sortant. Pour utiliser Resend en HTTPS, renseigner `RESEND_API_KEY` et `RESEND_FROM` dans les variables du service web VETRA. Avec une clé Resend, VETRA utilise HTTPS pour les OTP, la réinitialisation et les PDF par e-mail. Sans clé Resend, le SMTP existant reste disponible.

Tester d'abord la réception sur l'adresse du compte Resend avec `RESEND_FROM=VETRA <onboarding@resend.dev>`, en gardant `REQUIRE_LOGIN_OTP=false`. Pour les autres destinataires, vérifier un domaine d'expédition dans Resend, puis utiliser une adresse de ce domaine comme expéditeur. Après avoir vérifié l'envoi, définir `REQUIRE_LOGIN_OTP=true` et déployer les changements Railway.
