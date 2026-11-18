# VETRA — Correctif des formulaires et identité visuelle

- Le générateur affiche désormais des champs pour les lignes de données dont les cellules Excel sont vides (ex. Bovins, Ovins, Caprins en I.A.2).
- Les lignes de titre numérotées ne sont plus interprétées comme des lignes de saisie.
- Les lignes Total sont calculées par colonne à partir des lignes de données affichées.
- Les en-têtes sont dérivés des colonnes de la ligne d’en-tête de chaque rubrique.
- Le logo VETRA SVG existant est ajouté à la page de connexion et au menu latéral.

IMPORTANT : ce correctif n'a pas été compilé avec les dépendances npm dans cet environnement. La logique générique ne remplace pas un contrôle métier des 20 rubriques. Le logo officiel ONSSA n'est pas présent dans les sources disponibles et n'a pas été inventé. Le PDF et les règles de totalisation métier spécifiques restent à corriger et tester.
