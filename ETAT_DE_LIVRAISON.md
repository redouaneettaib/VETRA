# VETRA — Vérifications de livraison

## Périmètre

La version est issue du commit `e4528f3b2c4059ee5f23b7db35170d07e90872c7` de `redouaneettaib/VETRA`. Le classeur d'origine et le schéma PostgreSQL/Prisma sont conservés. Les assets ONSSA et VETRA proviennent des logos fournis.

## Correspondance avec le canevas CASA

- Les 20 rubriques s'appuient sur des plages explicites. Une cellule de saisie vide dans le classeur reste saisissable dans l'interface. Les libellés, en-têtes, lignes de regroupement et formules ont des traitements distincts.
- I.B.1 comporte trois tableaux indépendants. Les foyers TIAC et les retraits/rappels disposent de lignes répétables avec les 4 et 14 colonnes du canevas.
- Les totaux horizontaux et verticaux sont calculés avec les formules CASA. Le total des inspections reprend bien tous les postes de la formule d'origine, jusqu'aux cuisines centrales.
- Les taux de non-conformité restent exprimés de 0 à 100. Les sommes de taux du classeur ont été écartées dans l'export et la consolidation. Un taux consolidé exige les nombres de résultats non conformes et les dénominateurs correspondants. L'application laisse ces taux consultables dans les rapports individuels.
- L'export XLSX conserve les fusions et styles de CASA, remplace les valeurs d'exemple, remplit les cellules de la période et préserve les formules applicables. Les lignes qui dépassent les emplacements TIAC et retrait/rappel prévus figurent dans des feuilles complémentaires. Le PDF présente les libellés de reporting, les chiffres, les lignes supplémentaires et les deux logos.

## Vérifications

- Compilation de production Next.js et contrôle TypeScript réussis.
- 16 tests automatisés réussis, dont la comparaison par période, le calcul des séries, les valeurs absentes, les taux et les exports PDF/XLSX.
- Parcours fonctionnel réussi sur PostgreSQL 18 avec cinq profils, un service provincial et un service frontalier. Le scénario vérifie l'isolation des accès, les habilitations, les conflits d'écriture, la révocation, les corrections successives, la validation, le journal et la consolidation.
- Parcours de saisie vérifié dans une simulation DOM de l'interface React connectée au serveur de recette. La vérification inclut les logos servis, la navigation progressive, les totaux, la saisie d'un foyer TIAC et la consultation en lecture seule après soumission. Chromium local est bloqué par les restrictions de l'environnement. Le rendu visuel en navigateur reste à vérifier.

Le workflow de recette utilise des comptes fictifs et une base PostgreSQL locale jetable. Les comptes et rapports de production n'ont fait l'objet d'aucune opération. Les tests de connexion ont utilisé le mode local sans OTP. La réception d'un OTP via le SMTP de l'installation et la compatibilité avec ses données réelles ne font donc pas partie de cette vérification.

Les contrôles du nouveau reporting ont vérifié les refus d’accès à la consultation et à l’export hors périmètre. Une simulation DOM de l'interface React a vérifié le passage au rapport annuel, la sélection de deux régions, les courbes, la sélection des rubriques, les liens d’export et le repli WhatsApp. L’envoi réel vers WhatsApp dépend du navigateur et de l’application installée.

Aucun déploiement ni envoi de code sur GitHub n'a été effectué.

La mise à jour de l’interface a été vérifiée avec un parcours PostgreSQL et SMTP local, OTP actif. Le test vérifie la connexion par code à usage unique, la réinitialisation, le rejet de l’ancien mot de passe et les pièces jointes PDF. La simulation DOM vérifie le parcours de connexion et les filtres de reporting. Le déploiement et le SMTP de production restent à vérifier.

Mise à jour tableau de bord et administration : compilation, 16 tests automatisés et parcours PostgreSQL/SMTP avec OTP réussis. Le test vérifie la modification authentifiée du mot de passe, la révocation nationale et la mise à jour des indicateurs. Une simulation de l’interface React a vérifié le compteur, la liste filtrée, les onglets ADMIN et les actions par icône. Le rendu visuel n’a pas été contrôlé sur un navigateur graphique.
