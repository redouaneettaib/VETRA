# VETRA — ONSSA / DPA

VETRA gère les rapports mensuels des services vétérinaires provinciaux et frontaliers. Cette version reprend le dépôt `redouaneettaib/VETRA`, branche `main` au commit `e4528f3b2c4059ee5f23b7db35170d07e90872c7`, et le canevas `CASA` de son classeur original. Les logos ONSSA et VETRA fournis sont affichés à la connexion, dans le portail et dans le PDF.

## Utiliser une installation existante

Conserver la configuration de l'installation, notamment `DATABASE_URL`, `SESSION_SECRET`, les réglages OTP et SMTP. Le schéma Prisma est identique à celui du dépôt source. Cette version ne requiert aucune migration ou initialisation de la base existante. Elle reprend les comptes, rattachements, habilitations, rapports et journaux via le même schéma.

Sur un environnement de recette, installer les dépendances avec `npm ci`, compiler avec `npm run build` et démarrer avec `npm start`. Utiliser une instance PostgreSQL de recette et les réglages de recette. Le seed sert à initialiser une base neuve. Le code de connexion utilise SMTP si `REQUIRE_LOGIN_OTP` est activé ou absent.

Pour l'envoi d'e-mails, renseigner côté serveur `SMTP_HOST`, `SMTP_FROM` et au besoin `SMTP_PORT` (587 par défaut, TLS implicite sur 465), `SMTP_USER` et `SMTP_PASS`. Ces réglages sont partagés avec les codes de connexion. Le test des routes d’envoi en recette peut être activé avec `VETRA_TEST_SMTP_CAPTURE=true` et un serveur SMTP local de capture, configuré pour ne rien transmettre.

## Utiliser le portail

- Le chef de service renseigne les rubriques habilitées dans l’ordre du canevas. « Enregistrer et continuer » valide l’étape et ouvre la suivante. Les rubriques déjà enregistrées restent modifiables tant que le rapport est ouvert.
- Le chef de division consulte les rapports de sa division. Il peut valider un rapport soumis ou le renvoyer au chef de service en motivant la révocation. La correction peut être enregistrée plusieurs fois avant sa nouvelle soumission.
- Le directeur régional consulte son périmètre. La direction centrale consulte la consolidation nationale. L'administrateur national gère les services, les comptes et les habilitations par rubrique.
- Le tableau de bord distingue les services attendus, les rapports saisis et leurs statuts. Il est filtrable par région et par type de service. La consolidation prend uniquement les rapports validés du périmètre et de la période sélectionnée.
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
