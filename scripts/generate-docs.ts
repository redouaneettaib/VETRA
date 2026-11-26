import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';

const ROOT = process.cwd();
const SHOTS_DIR = path.join(
  ROOT,
  '.aistudio/artifacts/computer_use/tutoriel_vetra',
);
const PUBLIC_TUTORIEL_DIR = path.join(ROOT, 'public/tutoriel');

fs.mkdirSync(SHOTS_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_TUTORIEL_DIR, { recursive: true });

function readDataUri(filePath: string, mime: string): string {
  const buf = fs.readFileSync(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function shotPath(filename: string): string {
  return path.join(SHOTS_DIR, filename);
}

function shotUri(filename: string): string {
  return readDataUri(shotPath(filename), 'image/png');
}

const onssaLogoPath = path.join(ROOT, 'public/ONSSA_officiel.jpg');
const vetraLogoPath = path.join(ROOT, 'public/VETRA_officiel.jpg');
const onssaLogoUri = readDataUri(onssaLogoPath, 'image/jpeg');
const vetraLogoUri = readDataUri(vetraLogoPath, 'image/jpeg');

const figure = (num: number, filename: string, caption: string) => `
<figure class="fig">
  <img src="${shotUri(filename)}" alt="${caption.replace(/"/g, '&quot;')}" />
  <figcaption><strong>Figure ${num}</strong> — ${caption}</figcaption>
</figure>`;

function buildTutorialHtml(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Manuel complet d'utilisation — VETRA | ONSSA – DPA (4 Volets)</title>
<style>
  :root {
    --navy: #0c2b47;
    --navy-mid: #163d61;
    --teal: #0f654c;
    --teal-bright: #15946f;
    --teal-soft: #e7f5f0;
    --amber: #b45309;
    --amber-soft: #fef3c7;
    --rose: #be123c;
    --rose-soft: #ffe4e6;
    --slate-900: #0f172a;
    --slate-700: #334155;
    --slate-600: #475569;
    --slate-500: #64748b;
    --slate-200: #e2e8f0;
    --slate-100: #f1f5f9;
    --slate-50: #f8fafc;
  }
  * { box-sizing: border-box; }
  @page {
    size: A4 portrait;
    margin: 14mm 13mm 16mm 13mm;
  }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: var(--slate-900);
    background: #eef3f7;
    line-height: 1.54;
    font-size: 13.5px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-shell {
    max-width: 980px;
    margin: 24px auto 48px;
    background: #ffffff;
    border-radius: 14px;
    box-shadow: 0 18px 50px rgba(12, 43, 71, 0.1);
    overflow: hidden;
  }
  .cover {
    background: linear-gradient(145deg, #0b253d 0%, #123b5e 56%, #0f654c 100%);
    color: #ffffff;
    padding: 48px 48px 42px;
    page-break-after: always;
  }
  .cover-logos {
    display: inline-flex;
    align-items: center;
    gap: 20px;
    background: #ffffff;
    padding: 12px 22px;
    border-radius: 14px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }
  .cover-logos img {
    height: 52px;
    width: auto;
    object-fit: contain;
  }
  .cover-eyebrow {
    margin: 34px 0 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #9de5cd;
  }
  .cover h1 {
    margin: 0;
    font-size: 34px;
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .cover-sub {
    margin: 14px 0 28px;
    font-size: 16px;
    color: #dbeafe;
    max-width: 720px;
  }
  .cover-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-top: 22px;
  }
  .cover-card {
    background: rgba(255, 255, 255, 0.11);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 12px;
    padding: 15px 18px;
  }
  .cover-card strong {
    display: block;
    font-size: 14px;
    color: #ffffff;
    margin-bottom: 4px;
  }
  .cover-card span {
    font-size: 12.5px;
    color: #e2f2ee;
  }
  .cover-meta {
    margin-top: 34px;
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #cbd5e1;
  }
  .content {
    padding: 32px 42px 44px;
  }
  .section-banner {
    background: linear-gradient(90deg, var(--navy) 0%, var(--navy-mid) 70%, var(--teal) 100%);
    color: #ffffff;
    padding: 14px 20px;
    border-radius: 10px;
    margin: 28px 0 16px;
    page-break-before: always;
    break-inside: avoid;
  }
  .section-banner.first {
    page-break-before: auto;
    margin-top: 0;
  }
  .section-banner .volet-tag {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #9de5cd;
  }
  .section-banner h2 {
    margin: 2px 0 0;
    font-size: 20px;
    font-weight: 800;
  }
  h3 {
    margin: 20px 0 8px;
    font-size: 15.5px;
    color: var(--navy);
    border-left: 4px solid var(--teal-bright);
    padding-left: 10px;
    break-after: avoid;
  }
  p { margin: 6px 0 10px; color: var(--slate-700); }
  ol, ul { margin: 6px 0 12px; padding-left: 20px; color: var(--slate-700); }
  li { margin-bottom: 4px; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px;
    font-size: 12px;
    break-inside: avoid;
  }
  th {
    background: var(--navy);
    color: #ffffff;
    text-align: left;
    padding: 8px 9px;
    font-weight: 700;
  }
  td {
    border: 1px solid var(--slate-200);
    padding: 7px 9px;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: var(--slate-50); }
  .callout {
    background: var(--teal-soft);
    border: 1px solid #b7dfd1;
    border-left: 4px solid var(--teal);
    border-radius: 8px;
    padding: 11px 14px;
    margin: 12px 0 14px;
    font-size: 13px;
    color: var(--navy);
    break-inside: avoid;
  }
  .callout.warn {
    background: var(--amber-soft);
    border-color: #fcd34d;
    border-left-color: var(--amber);
    color: #78350f;
  }
  .workflow-box {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    background: var(--slate-50);
    border: 1px solid var(--slate-200);
    border-radius: 10px;
    padding: 12px 14px;
    margin: 10px 0 14px;
    break-inside: avoid;
  }
  .wf-step {
    padding: 5px 10px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 11.5px;
    border: 1px solid var(--slate-200);
    background: #ffffff;
    color: var(--navy);
  }
  .wf-step.valide { background: #dcfce7; border-color: #86efac; color: #166534; }
  .wf-step.soumis { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
  .wf-step.revoque { background: #ffe4e6; border-color: #fda4af; color: #9f1239; }
  .wf-arrow { color: var(--slate-500); font-weight: 700; }
  .fig {
    margin: 12px 0 18px;
    background: #ffffff;
    border: 1px solid var(--slate-200);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
    break-inside: avoid;
  }
  .fig img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 6px;
    border: 1px solid #e6edf3;
  }
  .fig figcaption {
    margin-top: 7px;
    font-size: 11.5px;
    color: var(--slate-600);
    text-align: center;
  }
  .regions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px 18px;
    background: var(--slate-50);
    border: 1px solid var(--slate-200);
    border-radius: 8px;
    padding: 10px 14px;
    margin: 8px 0 14px;
    font-size: 12.5px;
    break-inside: avoid;
  }
  .regions-grid div strong {
    display: inline-block;
    width: 24px;
    color: var(--teal);
  }
  @media print {
    body { background: #ffffff; }
    .doc-shell {
      max-width: none;
      margin: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .content { padding: 0; }
    .cover {
      border-radius: 12px;
      padding: 40px 38px 36px;
    }
  }
</style>
</head>
<body>
<div class="doc-shell">
  <section class="cover">
    <div class="cover-logos">
      <img src="${onssaLogoUri}" alt="ONSSA" />
      <img src="${vetraLogoUri}" alt="VETRA" />
    </div>
    <p class="cover-eyebrow">Office National de Sécurité Sanitaire des Produits Alimentaires · DPA</p>
    <h1>Manuel complet d’utilisation<br/>Plateforme VETRA</h1>
    <p class="cover-sub">
      Veille, Traçabilité et Reporting des Activités des Services Vétérinaires — Guide illustré pas à pas en 4 volets opérationnels avec captures d’écran actualisées.
    </p>
    <div class="cover-grid">
      <div class="cover-card">
        <strong>Volet 1 · Administrateur national</strong>
        <span>Organisation (12 DR, 43 services), comptes, réinitialisation MDP, habilitations par rubrique et messagerie.</span>
      </div>
      <div class="cover-card">
        <strong>Volet 2 · Administration centrale (DPA)</strong>
        <span>Tableau de bord national, carte interactive 12 régions, Total consolidé multi-services, Reporting officiel et Veille IA.</span>
      </div>
      <div class="cover-card">
        <strong>Volet 3 · Directions régionales &amp; Divisions</strong>
        <span>Supervision territoriale, validation / révocation des rapports, exports individuels et consolidés par périmètre.</span>
      </div>
      <div class="cover-card">
        <strong>Volet 4 · Chefs de services vétérinaires</strong>
        <span>Saisie mensuelle guidée (Provinciaux &amp; DCSP Frontaliers), totaux automatiques, soumission et corrections.</span>
      </div>
    </div>
    <div class="cover-meta">
      <span>ONSSA – Direction des Produits Alimentaires (DPA)</span>
      <span>Édition actualisée · 20 captures HD · Version 2026</span>
    </div>
  </section>

  <main class="content">
    <div class="section-banner first">
      <div class="volet-tag">Section 0 · Référentiel commun</div>
      <h2>Vue d’ensemble, matrice des rôles et accès sécurisé</h2>
    </div>

    <h3>0.1 Matrice des droits et périmètres par profil</h3>
    <table>
      <thead>
        <tr>
          <th>Fonctionnalité VETRA</th>
          <th>Volet 1<br/>ADMIN_NATIONAL</th>
          <th>Volet 2<br/>DIRECTION_CENTRALE</th>
          <th>Volet 3A<br/>DIRECTEUR_REGIONAL</th>
          <th>Volet 3B<br/>CHEF_DIVISION</th>
          <th>Volet 4<br/>CHEF_SERVICE</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Périmètre visible</strong></td>
          <td>National (12 DR)</td>
          <td>National (12 DR)</td>
          <td>Sa Direction régionale</td>
          <td>Sa Division vétérinaire</td>
          <td>Son Service uniquement</td>
        </tr>
        <tr>
          <td><strong>Tableau de bord &amp; Carte</strong></td>
          <td>National (12 DR)</td>
          <td>National + raccourcis IA</td>
          <td>Régional</td>
          <td>Division</td>
          <td>Son service</td>
        </tr>
        <tr>
          <td><strong>Saisie mensuelle</strong></td>
          <td>Lecture seule</td>
          <td>Lecture seule</td>
          <td>Lecture seule</td>
          <td>Lecture seule</td>
          <td><strong>Saisie &amp; Soumission</strong></td>
        </tr>
        <tr>
          <td><strong>Valider un rapport SOUMIS</strong></td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td><strong>Oui (Valider)</strong></td>
          <td>—</td>
        </tr>
        <tr>
          <td><strong>Révoquer un rapport</strong></td>
          <td>—</td>
          <td><strong>SOUMIS &amp; VALIDE</strong></td>
          <td>—</td>
          <td><strong>SOUMIS uniquement</strong></td>
          <td>—</td>
        </tr>
        <tr>
          <td><strong>Export individuel (Excel/PDF/Mail/WA)</strong></td>
          <td>Oui</td>
          <td>Oui</td>
          <td>Oui</td>
          <td>Oui</td>
          <td>Oui (ses rapports)</td>
        </tr>
        <tr>
          <td><strong>Total consolidé multi-services</strong></td>
          <td><strong>National / DR</strong></td>
          <td><strong>National / DR</strong></td>
          <td><strong>Sa Région</strong></td>
          <td><strong>Sa Division</strong></td>
          <td>—</td>
        </tr>
        <tr>
          <td><strong>Reporting officiel consolidé</strong></td>
          <td>National</td>
          <td>National</td>
          <td>Régional</td>
          <td>Division</td>
          <td>Son service</td>
        </tr>
        <tr>
          <td><strong>Veille &amp; Analyse IA</strong></td>
          <td>—</td>
          <td><strong>Exclusif (4 modules)</strong></td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
        </tr>
        <tr>
          <td><strong>Administration</strong></td>
          <td><strong>Exclusif (5 onglets)</strong></td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
        </tr>
      </tbody>
    </table>

    <h3>0.2 Cycle de vie officiel d’un rapport mensuel</h3>
    <div class="workflow-box">
      <span class="wf-step">NON INTRODUIT</span>
      <span class="wf-arrow">→</span>
      <span class="wf-step">BROUILLON</span>
      <span class="wf-arrow">→</span>
      <span class="wf-step soumis">SOUMIS (100 %)</span>
      <span class="wf-arrow">→</span>
      <span class="wf-step valide">VALIDE</span>
      <span class="wf-arrow">|</span>
      <span class="wf-step revoque">REVOQUE (motif)</span>
      <span class="wf-arrow">→</span>
      <span class="wf-step">CORRIGE</span>
      <span class="wf-arrow">→</span>
      <span class="wf-step soumis">SOUMIS</span>
    </div>
    <ul>
      <li><strong>NON INTRODUIT</strong> : aucune donnée enregistrée pour le mois sélectionné.</li>
      <li><strong>BROUILLON</strong> : saisie en cours par le Chef de service ; sauvegardable et modifiable librement.</li>
      <li><strong>SOUMIS</strong> : 100 % des rubriques habilitées complétées et transmises au Chef de division (lecture seule).</li>
      <li><strong>VALIDE</strong> : approuvé par le Chef de division et intégré automatiquement dans le <strong>Reporting officiel</strong>.</li>
      <li><strong>REVOQUE → CORRIGE</strong> : renvoyé avec <strong>motif obligatoire</strong> pour déverrouillage, correction et nouvelle soumission.</li>
    </ul>

    <h3>0.3 Connexion, changement de mot de passe et « Mot de passe oublié ? »</h3>
    <ol>
      <li>Saisissez votre <strong>E-mail professionnel</strong> et votre <strong>Mot de passe</strong>, puis cliquez sur <strong>« Se connecter »</strong>.</li>
      <li>Une fois connecté, le menu latéral gauche propose <strong>« Modifier mon mot de passe »</strong> (12 caractères minimum).</li>
      <li>En cas d’oubli, cliquez sur <strong>« Mot de passe oublié ? »</strong> pour recevoir un code à 6 chiffres par e-mail (valable 10 min) ou transmettre automatiquement une demande à l’Administrateur national (code valable 24 h).</li>
    </ol>
    ${figure(1, '01_connexion.png', 'Écran de connexion officiel VETRA (ONSSA – DPA)')}
    ${figure(2, '02_mot_de_passe_oublie.png', 'Procédure sécurisée de réinitialisation de mot de passe')}

    <div class="section-banner">
      <div class="volet-tag">Volet 1 · Administration nationale</div>
      <h2>Administrateur national (ADMIN_NATIONAL)</h2>
    </div>
    <p>L’Administrateur national configure l’architecture territoriale (12 Directions régionales, Divisions et Services vétérinaires), gère les comptes, les habilitations par rubrique et vérifie la messagerie transactionnelle.</p>

    <h3>1.1 Organisation nationale et alertes d’accès</h3>
    <p>Consultez la synthèse nationale des <strong>Directions régionales</strong>, <strong>Divisions vétérinaires</strong> et <strong>Services</strong>. Toute demande de réinitialisation de mot de passe s’affiche dans un bandeau dédié avec accès direct.</p>
    ${figure(3, '03_admin_organisation.png', 'Administration — Vue d’ensemble de l’organisation territoriale')}

    <h3>1.2 Gestion des services vétérinaires</h3>
    <p>Dans <strong>Administration → Services</strong>, créez ou modifiez les services vétérinaires en précisant leur <strong>Division vétérinaire</strong> de rattachement et leur type (<strong>Provincial</strong> ou <strong>Frontalier / DCSP</strong>).</p>
    ${figure(4, '04_admin_services.png', 'Administration — Création et mise à jour des services vétérinaires')}

    <h3>1.3 Gestion des comptes utilisateurs &amp; réinitialisation d’accès</h3>
    <ol>
      <li>Dans <strong>Administration → Comptes utilisateurs</strong>, traitez les demandes en attente, créez de nouveaux utilisateurs avec rattachement automatique (Région / Division / Service) et désactivez les comptes inactifs sans altérer l’historique d’audit.</li>
      <li>Le bouton <strong>« Réinitialiser MDP »</strong> permet soit d’émettre un <strong>code à usage unique (24 h)</strong>, soit de générer un <strong>mot de passe temporaire fort</strong> envoyé par e-mail.</li>
    </ol>
    ${figure(5, '05_admin_comptes.png', 'Administration — Gestion des comptes utilisateurs')}
    ${figure(6, '06_admin_reset_mdp.png', 'Administration — Panneau de réinitialisation d’accès en 1 clic')}

    <h3>1.4 Habilitations par rubrique et diagnostic messagerie</h3>
    <ol>
      <li><strong>Habilitations</strong> : cochez les sections exactes autorisées pour chaque service (ex. sections I, II, III, V, VI pour un service provincial ; section IV — Importation pour un service frontalier DCSP).</li>
      <li><strong>Messagerie</strong> : vérifiez le fournisseur actif (Brevo, Resend ou SMTP) et envoyez un e-mail de test.</li>
    </ol>
    ${figure(7, '07_admin_habilitations.png', 'Administration — Paramétrage des habilitations par rubrique')}
    ${figure(8, '08_admin_messagerie.png', 'Administration — Diagnostic et test de la messagerie')}

    <div class="section-banner">
      <div class="volet-tag">Volet 2 · Pilotage national</div>
      <h2>Administration centrale (DIRECTION_CENTRALE)</h2>
    </div>
    <p>La Direction centrale (DPA) supervise les 12 Directions régionales et l’ensemble des 43 services vétérinaires, dispose d’exports consolidés multi-services, du Reporting officiel et du module exclusif <strong>Veille &amp; Analyse IA</strong>.</p>

    <h3>2.1 Tableau de bord national</h3>
    <ol>
      <li>Naviguez dans le temps avec le <strong>ruban Année / Mois</strong> (Jan → Déc) et filtrez par <strong>Type de service</strong> ou <strong>Direction régionale</strong>.</li>
      <li>Cliquez sur l’une des <strong>8 cartes KPI</strong> (<em>Services attendus, Rapports saisis, Non introduits, Brouillons, Soumis, Validés, Révoqués, Taux de validation</em>) pour filtrer immédiatement la liste détaillée.</li>
      <li>Accédez directement aux 4 modules du bloc <strong>Veille sanitaire &amp; Analyse IA</strong>.</li>
    </ol>
    ${figure(9, '09_central_dashboard.png', 'Direction centrale — Tableau de bord national et raccourcis IA')}

    <h3>2.2 Carte régionale interactive &amp; liste défilable des 12 directions régionales</h3>
    <p>La carte du Maroc reflète en temps réel le taux de saisie par région selon 5 nuances de vert (<code>0 %</code>, <code>1–49 %</code>, <code>50–74 %</code>, <code>75–99 %</code>, <code>100 %</code>) ainsi que l’écart en points par rapport au mois précédent. La liste encadrée à droite affiche les <strong>12 directions régionales numérotées de 01 à 12</strong> dans l’ordre retenu par VETRA, avec barre de défilement, boutons <strong>▲ / ▼</strong> et synchronisation automatique au clic sur la carte :</p>
    <div class="regions-grid">
      <div><strong>01</strong> Rabat-Salé-Kénitra</div>
      <div><strong>07</strong> Laâyoune-Sakia El Hamra</div>
      <div><strong>02</strong> Tanger-Tétouan-Al Hoceïma</div>
      <div><strong>08</strong> Marrakech-Safi</div>
      <div><strong>03</strong> Casablanca-Settat</div>
      <div><strong>09</strong> Béni Mellal-Khénifra</div>
      <div><strong>04</strong> L’Oriental</div>
      <div><strong>10</strong> Fès-Meknès</div>
      <div><strong>05</strong> Drâa-Tafilalet</div>
      <div><strong>11</strong> Dakhla-Oued Ed-Dahab</div>
      <div><strong>06</strong> Souss-Massa</div>
      <div><strong>12</strong> Guelmim-Oued Noun</div>
    </div>
    ${figure(10, '10_central_carte_regionale.png', 'Carte interactive du Maroc et liste défilable des 12 directions régionales (01 → 12)')}

    <h3>2.3 Rapports, colonne Complétude &amp; Total consolidé multi-services</h3>
    <div class="callout">
      <strong>Nouveauté majeure — Total consolidé :</strong> en haut du tableau <em>Rapports et validation</em>, la barre <strong>« Total consolidé — Somme des services vétérinaires »</strong> permet à la Direction centrale, aux Directions régionales et aux Divisions vétérinaires de télécharger ou d’envoyer en 1 clic la <strong>somme consolidée de l’ensemble des services de leur périmètre</strong> en <strong>Excel (.xlsx)</strong>, <strong>PDF</strong>, par <strong>E-mail (PDF)</strong> ou via <strong>WhatsApp (PDF)</strong>.
    </div>
    <ol>
      <li>Filtrez par Direction régionale et par état via les <strong>5 onglets avec compteurs</strong> (Tous, Introduits, Non introduits, En validation, Validés).</li>
      <li>Suivez l’avancement de chaque rapport grâce à la colonne <strong>Complétude (%)</strong> avec barre de progression.</li>
      <li>Utilisez les actions individuelles (Consulter, Excel, PDF, E-mail, WhatsApp) ou la barre <strong>Total consolidé</strong> pour un export global.</li>
      <li><strong>Pouvoir central de révocation :</strong> la Direction centrale peut révoquer (avec motif obligatoire) aussi bien un rapport <code>SOUMIS</code> qu’un rapport déjà <code>VALIDE</code>.</li>
    </ol>
    ${figure(11, '11_central_rapports.png', 'Rapports et validation — Barre Total consolidé multi-services et colonne Complétude')}

    <h3>2.4 Reporting officiel consolidé (Mensuel &amp; Annuel 2025 / 2026)</h3>
    <p>Alimenté exclusivement par les rapports <code>VALIDE</code>, le <strong>Reporting officiel</strong> offre une analyse mensuelle ou annuelle complète : taux de transmission par région (classé 01 → 12), répartition des statuts, histogramme mensuel (12 mois à 100 % sur 2025 et août/octobre 2026), comparaison inter-régions ou inter-services et exports Excel / PDF / E-mail / WhatsApp.</p>
    ${figure(12, '12_central_reporting.png', 'Reporting officiel — Suivi annuel 2026 avec comparaison régionale et mensuelle')}
    ${figure(13, '20_central_reporting_2025.png', 'Reporting officiel — Bilan annuel 2025 consolidé à 100 % (516/516 rapports validés)')}

    <h3>2.5 Veille sanitaire &amp; Analyse IA (exclusif Direction centrale)</h3>
    <ul>
      <li><strong>Synthèse exécutive</strong> : note nationale consolidée (faits marquants, points de vigilance, recommandations).</li>
      <li><strong>Contrôle anomalies</strong> : audit qualité automatique des valeurs atypiques et ruptures de tendance.</li>
      <li><strong>Assistant analytique</strong> : interrogation directe des indicateurs en langage naturel (<strong>français ou arabe</strong>).</li>
      <li><strong>Signaux faibles</strong> : détection précoce des dérives sanitaires sur 6 mois glissants.</li>
    </ul>
    ${figure(14, '13_central_veille_ia.png', 'Module Veille sanitaire & Analyse IA — Direction centrale')}

    <div class="section-banner">
      <div class="volet-tag">Volet 3 · Pilotage territorial &amp; Contrôle</div>
      <h2>Directions régionales &amp; Divisions vétérinaires</h2>
    </div>

    <h3>3.1 Supervision par le Directeur régional (DIRECTEUR_REGIONAL)</h3>
    <ol>
      <li>Le Tableau de bord, la carte et les indicateurs sont automatiquement restreints aux divisions et services de votre Direction régionale.</li>
      <li>Identifiez rapidement les services en retard (<em>Non introduits</em> / <em>Brouillons</em>), exportez le <strong>Total consolidé régional</strong> (Excel, PDF, E-mail, WhatsApp) et exploitez le <strong>Reporting officiel régional</strong>.</li>
    </ol>
    ${figure(15, '14_dr_dashboard.png', 'Directeur régional — Tableau de bord restreint au périmètre régional')}

    <h3>3.2 Validation, révocation et export consolidé par le Chef de division (CHEF_DIVISION)</h3>
    <ol>
      <li>Ouvrez <strong>Rapports et validation</strong> et filtrez sur l’onglet <strong>« En validation »</strong> (rapports <code>SOUMIS</code>).</li>
      <li>Cliquez sur l’icône <strong>Œil</strong> pour contrôler l’intégralité des rubriques saisies.</li>
      <li>Cliquez sur <strong>« Valider »</strong> (verrouille en <code>VALIDE</code> et alimente le Reporting) ou sur <strong>« Révoquer »</strong> (motif obligatoire, renvoi au Chef de service).</li>
      <li>Utilisez la barre <strong>Total consolidé</strong> pour exporter ou envoyer la somme de tous les services de votre division.</li>
    </ol>
    <div class="callout warn">
      <strong>Règle de gouvernance :</strong> une fois un rapport validé par le Chef de division, seule la <strong>Direction centrale</strong> peut le révoquer en cas de correction exceptionnelle.
    </div>
    ${figure(16, '15_division_validation.png', 'Chef de division — Validation, révocation et Total consolidé de la division')}

    <div class="section-banner">
      <div class="volet-tag">Volet 4 · Saisie terrain</div>
      <h2>Chefs de services vétérinaires (CHEF_SERVICE)</h2>
    </div>

    <h3>4.1 Saisie mensuelle guidée (Service provincial / préfectoral)</h3>
    <ol>
      <li>Ouvrez <strong>Saisie mensuelle</strong> et sélectionnez le mois dans le ruban supérieur.</li>
      <li>Complétez les rubriques habilitées étape par étape (les totaux <strong>Σ</strong> sont calculés en temps réel ; une rubrique sans activité peut être validée vide via <strong>« Enregistrer et continuer → »</strong>).</li>
      <li>Sauvegardez à tout moment avec <strong>« Enregistrer le brouillon »</strong> (<code>BROUILLON</code>).</li>
    </ol>
    ${figure(17, '19_chef_saisie_active.png', 'Chef de service — Saisie mensuelle active et suivi d’avancement')}

    <h3>4.2 Soumission du rapport complet et exports</h3>
    <ol>
      <li>À <strong>100 % de complétude</strong>, cliquez sur <strong>« Soumettre le rapport complet »</strong> : le rapport passe en <code>SOUMIS</code> et est transmis au Chef de division.</li>
      <li>Utilisez la barre inférieure pour télécharger en <strong>Excel (.xlsx)</strong> / <strong>PDF</strong>, envoyer par <strong>E-mail</strong> ou partager via <strong>WhatsApp</strong>.</li>
    </ol>
    ${figure(18, '16_chef_saisie_provincial.png', 'Chef de service — Rapport complet consultable et verrouillé')}
    ${figure(19, '17_chef_saisie_canevas_dock.png', 'Chef de service — Barre d’exports et partage en bas de canevas')}

    <h3>4.3 Cas particulier des Services Frontaliers / DCSP &amp; rapports révoqués</h3>
    <ul>
      <li><strong>Services Frontaliers (DCSP)</strong> : le canevas affiche exclusivement la <strong>Section IV — Activités relatives à l’importation</strong> (<em>Quantités contrôlées</em> et <em>Quantités non admises</em>).</li>
      <li><strong>Traitement d’un rapport révoqué (<code>REVOQUE</code>)</strong> : un bandeau rouge affiche le motif saisi par le Chef de division ou la Direction centrale ; le canevas se déverrouille automatiquement pour correction (<code>CORRIGE</code>) puis nouvelle soumission.</li>
    </ul>
    ${figure(20, '18_chef_saisie_dcsp.png', 'Chef de service frontalier DCSP — Canevas dédié à la Section IV (Importation)')}
  </main>
</div>
</body>
</html>`;
}

async function buildPowerPoint(): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
  pptx.author = 'ONSSA – DPA | Plateforme VETRA';
  pptx.company = 'ONSSA – Direction des Produits Alimentaires';
  pptx.subject = 'Présentation exécutive de la plateforme VETRA';
  pptx.title = 'VETRA | ONSSA – DPA — Présentation à la Direction Générale';

  const C = {
    navy: '0C2B47',
    navyDark: '081D31',
    navyMid: '153D61',
    teal: '0F654C',
    tealBright: '15946F',
    tealSoft: 'E7F5F0',
    bg: 'F4F8FB',
    white: 'FFFFFF',
    slate900: '0F172A',
    slate700: '334155',
    slate600: '475569',
    slate500: '64748B',
    border: 'DCE6EF',
    amber: 'B45309',
    amberSoft: 'FEF3C7',
    rose: 'BE123C',
    roseSoft: 'FFE4E6',
  };

  const FONT = 'Calibri';

  const addHeader = (
    slide: PptxGenJS.Slide,
    eyebrow: string,
    title: string,
    pageNum: number,
  ) => {
    slide.background = { color: C.bg };
    // Top navy accent strip
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.1,
      fill: { color: C.teal },
      line: { type: 'none' },
    });
    // Header bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0.1,
      w: 13.333,
      h: 1.02,
      fill: { color: C.white },
      line: { color: C.border, width: 0.75 },
    });
    // Eyebrow
    slide.addText(eyebrow.toUpperCase(), {
      x: 0.55,
      y: 0.2,
      w: 9.5,
      h: 0.25,
      fontFace: FONT,
      fontSize: 9.5,
      bold: true,
      color: C.teal,
      charSpacing: 1.2,
    });
    // Title
    slide.addText(title, {
      x: 0.55,
      y: 0.44,
      w: 9.8,
      h: 0.55,
      fontFace: FONT,
      fontSize: 22,
      bold: true,
      color: C.navy,
    });
    // Top-right logos pill
    slide.addImage({
      path: onssaLogoPath,
      x: 10.65,
      y: 0.26,
      w: 1.05,
      h: 0.68,
      sizing: { type: 'contain', w: 1.05, h: 0.68 },
    });
    slide.addImage({
      path: vetraLogoPath,
      x: 11.78,
      y: 0.26,
      w: 1.15,
      h: 0.68,
      sizing: { type: 'contain', w: 1.15, h: 0.68 },
    });
    // Footer
    slide.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 7.08,
      w: 12.23,
      h: 0,
      line: { color: C.border, width: 0.75 },
    });
    slide.addText(
      'VETRA · ONSSA – DPA · Veille, Traçabilité et Reporting des Activités des Services Vétérinaires',
      {
        x: 0.55,
        y: 7.13,
        w: 9.5,
        h: 0.28,
        fontFace: FONT,
        fontSize: 8.5,
        color: C.slate500,
      },
    );
    slide.addText(`${pageNum} / 12`, {
      x: 11.6,
      y: 7.13,
      w: 1.18,
      h: 0.28,
      fontFace: FONT,
      fontSize: 8.5,
      bold: true,
      color: C.navy,
      align: 'right',
    });
  };

  const addScreenshotFrame = (
    slide: PptxGenJS.Slide,
    imgPath: string,
    x: number,
    y: number,
    w: number,
    h: number,
    caption?: string,
  ) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x - 0.06,
      y: y - 0.06,
      w: w + 0.12,
      h: h + (caption ? 0.38 : 0.12),
      rectRadius: 0.1,
      fill: { color: C.white },
      line: { color: C.border, width: 1 },
      shadow: {
        type: 'outer',
        color: '0C2B47',
        blur: 6,
        offset: 2,
        angle: 90,
        opacity: 0.1,
      },
    });
    slide.addImage({
      path: imgPath,
      x,
      y,
      w,
      h,
      sizing: { type: 'contain', w, h },
    });
    if (caption) {
      slide.addText(caption, {
        x,
        y: y + h + 0.04,
        w,
        h: 0.24,
        fontFace: FONT,
        fontSize: 8.5,
        italic: true,
        color: C.slate600,
        align: 'center',
      });
    }
  };

  const addBulletCard = (
    slide: PptxGenJS.Slide,
    x: number,
    y: number,
    w: number,
    h: number,
    heading: string,
    bullets: string[],
    accent = C.teal,
  ) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w,
      h,
      rectRadius: 0.1,
      fill: { color: C.white },
      line: { color: C.border, width: 1 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 0.09,
      h,
      fill: { color: accent },
      line: { type: 'none' },
    });
    slide.addText(heading, {
      x: x + 0.22,
      y: y + 0.14,
      w: w - 0.34,
      h: 0.35,
      fontFace: FONT,
      fontSize: 13.5,
      bold: true,
      color: C.navy,
    });
    slide.addText(
      bullets.map((b) => ({
        text: b,
        options: {
          bullet: { code: '2022', color: accent },
          paraSpaceAfter: 6,
        },
      })),
      {
        x: x + 0.22,
        y: y + 0.52,
        w: w - 0.34,
        h: h - 0.64,
        fontFace: FONT,
        fontSize: 11,
        color: C.slate700,
        valign: 'top',
      },
    );
  };

  // =========================================================================
  // SLIDE 1 — COUVERTURE INSTITUTIONNELLE
  // =========================================================================
  {
    const s = pptx.addSlide();
    s.background = { color: C.navy };
    // Right decorative teal panel
    s.addShape(pptx.ShapeType.rect, {
      x: 8.65,
      y: 0,
      w: 4.683,
      h: 7.5,
      fill: { color: C.teal },
      line: { type: 'none' },
    });
    // White card for logos
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.65,
      y: 0.58,
      w: 4.2,
      h: 1.05,
      rectRadius: 0.14,
      fill: { color: C.white },
      line: { type: 'none' },
    });
    s.addImage({
      path: onssaLogoPath,
      x: 0.85,
      y: 0.72,
      w: 1.65,
      h: 0.78,
      sizing: { type: 'contain', w: 1.65, h: 0.78 },
    });
    s.addImage({
      path: vetraLogoPath,
      x: 2.68,
      y: 0.7,
      w: 1.98,
      h: 0.82,
      sizing: { type: 'contain', w: 1.98, h: 0.82 },
    });

    s.addText(
      'OFFICE NATIONAL DE SÉCURITÉ SANITAIRE DES PRODUITS ALIMENTAIRES · DPA',
      {
        x: 0.65,
        y: 2.02,
        w: 7.7,
        h: 0.32,
        fontFace: FONT,
        fontSize: 10.5,
        bold: true,
        color: '9DE5CD',
        charSpacing: 1.2,
      },
    );
    s.addText('Plateforme VETRA', {
      x: 0.65,
      y: 2.38,
      w: 7.6,
      h: 0.9,
      fontFace: FONT,
      fontSize: 44,
      bold: true,
      color: C.white,
    });
    s.addText(
      'Veille, Traçabilité et Reporting des Activités\ndes Services Vétérinaires',
      {
        x: 0.65,
        y: 3.35,
        w: 7.5,
        h: 0.95,
        fontFace: FONT,
        fontSize: 20,
        color: 'DBEAFE',
      },
    );
    s.addText('Présentation exécutive à la Direction Générale', {
      x: 0.65,
      y: 4.55,
      w: 7.2,
      h: 0.4,
      fontFace: FONT,
      fontSize: 13.5,
      italic: true,
      color: '9DE5CD',
    });

    // 4 KPI pills along bottom left
    const kpis = [
      { v: '12', l: 'Directions\nrégionales' },
      { v: '43', l: 'Services\nvétérinaires' },
      { v: '5', l: 'Profils\nhiérarchiques' },
      { v: 'IA', l: 'Veille &\nAnalyse DPA' },
    ];
    kpis.forEach((k, i) => {
      const kx = 0.65 + i * 1.92;
      s.addShape(pptx.ShapeType.roundRect, {
        x: kx,
        y: 5.45,
        w: 1.76,
        h: 1.22,
        rectRadius: 0.12,
        fill: { color: C.navyMid },
        line: { color: '2B5E86', width: 1 },
      });
      s.addText(k.v, {
        x: kx,
        y: 5.56,
        w: 1.76,
        h: 0.5,
        fontFace: FONT,
        fontSize: 24,
        bold: true,
        color: '9DE5CD',
        align: 'center',
      });
      s.addText(k.l, {
        x: kx + 0.08,
        y: 6.08,
        w: 1.6,
        h: 0.5,
        fontFace: FONT,
        fontSize: 10,
        color: C.white,
        align: 'center',
      });
    });

    // Right preview showcase
    s.addShape(pptx.ShapeType.roundRect, {
      x: 8.98,
      y: 1.05,
      w: 3.95,
      h: 5.45,
      rectRadius: 0.16,
      fill: { color: C.white },
      line: { type: 'none' },
      shadow: {
        type: 'outer',
        color: '000000',
        blur: 14,
        offset: 4,
        angle: 90,
        opacity: 0.22,
      },
    });
    s.addImage({
      path: shotPath('01_connexion.png'),
      x: 9.13,
      y: 1.22,
      w: 3.65,
      h: 2.35,
      sizing: { type: 'contain', w: 3.65, h: 2.35 },
    });
    s.addImage({
      path: shotPath('10_central_carte_regionale.png'),
      x: 9.13,
      y: 3.74,
      w: 3.65,
      h: 2.15,
      sizing: { type: 'contain', w: 3.65, h: 2.15 },
    });
    s.addText('Portail national unifié · ONSSA – DPA · 2026', {
      x: 9.13,
      y: 6.03,
      w: 3.65,
      h: 0.35,
      fontFace: FONT,
      fontSize: 10,
      bold: true,
      color: C.navy,
      align: 'center',
    });
  }

  // =========================================================================
  // SLIDE 2 — ENJEUX ET PROPOSITION DE VALEUR
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Vision & Transformation digitale',
      'D’un reporting manuel dispersé à un pilotage national unifié',
      2,
    );

    // Left comparison column: Avant vs Avec VETRA
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 1.4,
      w: 5.9,
      h: 2.45,
      rectRadius: 0.12,
      fill: { color: C.white },
      line: { color: C.border, width: 1 },
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.55,
      y: 1.4,
      w: 5.9,
      h: 0.48,
      fill: { color: C.roseSoft },
      line: { type: 'none' },
    });
    s.addText('Défis du reporting classique', {
      x: 0.78,
      y: 1.49,
      w: 5.4,
      h: 0.32,
      fontFace: FONT,
      fontSize: 13.5,
      bold: true,
      color: C.rose,
    });
    s.addText(
      [
        'Fichiers Excel multiples envoyés par e-mail, consolidation manuelle chronophage',
        'Risques d’erreurs de formules, doublons et versions contradictoires',
        'Manque de visibilité instantanée sur les services en retard par région',
        'Traçabilité limitée des validations et des demandes de correction',
      ].map((t) => ({
        text: t,
        options: { bullet: { code: '2022', color: C.rose }, paraSpaceAfter: 6 },
      })),
      {
        x: 0.78,
        y: 2.0,
        w: 5.45,
        h: 1.75,
        fontFace: FONT,
        fontSize: 11.5,
        color: C.slate700,
      },
    );

    s.addShape(pptx.ShapeType.roundRect, {
      x: 6.85,
      y: 1.4,
      w: 5.93,
      h: 2.45,
      rectRadius: 0.12,
      fill: { color: C.white },
      line: { color: C.border, width: 1 },
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 6.85,
      y: 1.4,
      w: 5.93,
      h: 0.48,
      fill: { color: C.tealSoft },
      line: { type: 'none' },
    });
    s.addText('Apports immédiats de VETRA', {
      x: 7.08,
      y: 1.49,
      w: 5.4,
      h: 0.32,
      fontFace: FONT,
      fontSize: 13.5,
      bold: true,
      color: C.teal,
    });
    s.addText(
      [
        'Saisie en ligne guidée avec calculs automatiques (Σ) et contrôle de complétude',
        'Circuit hiérarchique sécurisé (Chef de service → Chef de division → DPA)',
        'Consolidation instantanée multi-services : Excel, PDF, E-mail & WhatsApp en 1 clic',
        'Cartographie interactive des 12 régions et module de Veille & Analyse IA',
      ].map((t) => ({
        text: t,
        options: { bullet: { code: '2022', color: C.teal }, paraSpaceAfter: 6 },
      })),
      {
        x: 7.08,
        y: 2.0,
        w: 5.48,
        h: 1.75,
        fontFace: FONT,
        fontSize: 11.5,
        color: C.slate700,
      },
    );

    // 4 value pillars at bottom
    const pillars = [
      {
        num: '01',
        t: 'Fiabilité des données',
        d: 'Canevas officiel ONSSA structuré, habilitations par rubrique et verrouillage après validation.',
      },
      {
        num: '02',
        t: 'Gain de temps majeur',
        d: 'Somme consolidée automatique des services vétérinaires sans ressaisie ni fusion manuelle.',
      },
      {
        num: '03',
        t: 'Pilotage territorial',
        d: 'Suivi mensuel & annuel sur les 12 DR, carte du Maroc multi-niveaux et écarts mensuels.',
      },
      {
        num: '04',
        t: 'Aide à la décision IA',
        d: 'Synthèses exécutives, contrôle d’anomalies, assistant FR/AR et signaux faibles sur 6 mois.',
      },
    ];
    pillars.forEach((p, idx) => {
      const px = 0.55 + idx * 3.12;
      s.addShape(pptx.ShapeType.roundRect, {
        x: px,
        y: 4.18,
        w: 2.88,
        h: 2.55,
        rectRadius: 0.12,
        fill: { color: C.white },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pptx.ShapeType.roundRect, {
        x: px + 0.2,
        y: 4.38,
        w: 0.56,
        h: 0.42,
        rectRadius: 0.08,
        fill: { color: C.navy },
        line: { type: 'none' },
      });
      s.addText(p.num, {
        x: px + 0.2,
        y: 4.42,
        w: 0.56,
        h: 0.34,
        fontFace: FONT,
        fontSize: 13,
        bold: true,
        color: '9DE5CD',
        align: 'center',
      });
      s.addText(p.t, {
        x: px + 0.2,
        y: 4.94,
        w: 2.48,
        h: 0.38,
        fontFace: FONT,
        fontSize: 13.5,
        bold: true,
        color: C.navy,
      });
      s.addText(p.d, {
        x: px + 0.2,
        y: 5.38,
        w: 2.48,
        h: 1.2,
        fontFace: FONT,
        fontSize: 10.8,
        color: C.slate600,
      });
    });
  }

  // =========================================================================
  // SLIDE 3 — ARCHITECTURE DES 4 VOLETS (5 PROFILS)
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Gouvernance & Sécurité (RBAC)',
      'Une architecture cloisonnée en 4 volets opérationnels (5 profils)',
      3,
    );

    const rows: PptxGenJS.TableRow[] = [
      [
        { text: 'Fonctionnalité', options: { bold: true, color: C.white, fill: { color: C.navy } } },
        { text: 'Volet 1\nADMIN_NATIONAL', options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' } },
        { text: 'Volet 2\nDIRECTION_CENTRALE', options: { bold: true, color: C.white, fill: { color: C.teal }, align: 'center' } },
        { text: 'Volet 3A\nDIRECTEUR_REGIONAL', options: { bold: true, color: C.white, fill: { color: C.navyMid }, align: 'center' } },
        { text: 'Volet 3B\nCHEF_DIVISION', options: { bold: true, color: C.white, fill: { color: C.navyMid }, align: 'center' } },
        { text: 'Volet 4\nCHEF_SERVICE', options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' } },
      ],
      [
        { text: 'Périmètre d’accès', options: { bold: true } },
        { text: 'National (12 DR)', options: { align: 'center' } },
        { text: 'National (12 DR)', options: { align: 'center', bold: true, color: C.teal } },
        { text: 'Sa Direction régionale', options: { align: 'center' } },
        { text: 'Sa Division', options: { align: 'center' } },
        { text: 'Son Service', options: { align: 'center' } },
      ],
      [
        { text: 'Saisie mensuelle', options: { bold: true } },
        { text: 'Lecture seule', options: { align: 'center', color: C.slate500 } },
        { text: 'Lecture seule', options: { align: 'center', color: C.slate500 } },
        { text: 'Lecture seule', options: { align: 'center', color: C.slate500 } },
        { text: 'Lecture seule', options: { align: 'center', color: C.slate500 } },
        { text: 'Saisie & Soumission', options: { align: 'center', bold: true, color: C.teal } },
      ],
      [
        { text: 'Validation (VALIDE)', options: { bold: true } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: 'Oui (SOUMIS)', options: { align: 'center', bold: true, color: C.teal } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
      ],
      [
        { text: 'Révocation (motif)', options: { bold: true } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: 'SOUMIS & VALIDE', options: { align: 'center', bold: true, color: C.rose } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: 'SOUMIS uniquement', options: { align: 'center', color: C.amber, bold: true } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
      ],
      [
        { text: 'Total consolidé multi-services', options: { bold: true } },
        { text: 'National / DR', options: { align: 'center', bold: true, color: C.teal } },
        { text: 'National / DR', options: { align: 'center', bold: true, color: C.teal } },
        { text: 'Sa Région', options: { align: 'center', bold: true, color: C.teal } },
        { text: 'Sa Division', options: { align: 'center', bold: true, color: C.teal } },
        { text: 'Export individuel', options: { align: 'center' } },
      ],
      [
        { text: 'Reporting officiel', options: { bold: true } },
        { text: 'National', options: { align: 'center' } },
        { text: 'National', options: { align: 'center', bold: true, color: C.teal } },
        { text: 'Régional', options: { align: 'center' } },
        { text: 'Division', options: { align: 'center' } },
        { text: 'Son Service', options: { align: 'center' } },
      ],
      [
        { text: 'Veille & Analyse IA', options: { bold: true } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: 'Exclusif (4 modules)', options: { align: 'center', bold: true, color: C.teal } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
      ],
      [
        { text: 'Administration & Droits', options: { bold: true } },
        { text: 'Exclusif (5 onglets)', options: { align: 'center', bold: true, color: C.navy } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
        { text: '—', options: { align: 'center', color: C.slate500 } },
      ],
    ];

    s.addTable(rows, {
      x: 0.55,
      y: 1.38,
      w: 12.23,
      rowH: [0.56, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52],
      colW: [2.73, 1.9, 2.05, 1.85, 1.85, 1.85],
      fontFace: FONT,
      fontSize: 10.5,
      color: C.slate900,
      border: { type: 'solid', color: C.border, pt: 0.75 },
      autoPage: false,
      valign: 'middle',
      fill: { color: C.white },
    });

    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 6.26,
      w: 12.23,
      h: 0.62,
      rectRadius: 0.08,
      fill: { color: C.tealSoft },
      line: { color: 'B7DFD1', width: 1 },
    });
    s.addText(
      'Cloisonnement strict côté serveur : chaque utilisateur n’accède qu’aux données, exports et consolidations autorisés par son rattachement hiérarchique.',
      {
        x: 0.75,
        y: 6.38,
        w: 11.83,
        h: 0.36,
        fontFace: FONT,
        fontSize: 11,
        bold: true,
        color: C.navy,
      },
    );
  }

  // =========================================================================
  // SLIDE 4 — CYCLE DE VIE SÉCURISÉ DU RAPPORT
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Workflow métier & Traçabilité',
      'Cycle de vie contrôlé de chaque rapport mensuel',
      4,
    );

    const steps = [
      {
        code: '1 · NON INTRODUIT',
        actor: 'Début de mois',
        desc: 'Service attendu dans le calendrier mensuel. Suivi visible sur le tableau de bord.',
        bg: C.white,
        bar: C.slate500,
      },
      {
        code: '2 · BROUILLON',
        actor: 'Chef de service',
        desc: 'Saisie progressive par rubrique habilitée, totaux Σ automatiques, sauvegarde libre.',
        bg: C.white,
        bar: C.navyMid,
      },
      {
        code: '3 · SOUMIS (100 %)',
        actor: 'Chef de service',
        desc: 'Soumission autorisée uniquement à 100 % de complétude. Verrouillé en lecture seule.',
        bg: C.amberSoft,
        bar: C.amber,
      },
      {
        code: '4 · VALIDE',
        actor: 'Chef de division',
        desc: 'Approbation officielle. Intégration immédiate dans le Reporting national et les exports.',
        bg: C.tealSoft,
        bar: C.teal,
      },
    ];

    steps.forEach((st, i) => {
      const sx = 0.55 + i * 3.12;
      s.addShape(pptx.ShapeType.roundRect, {
        x: sx,
        y: 1.55,
        w: 2.86,
        h: 2.65,
        rectRadius: 0.12,
        fill: { color: st.bg },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pptx.ShapeType.rect, {
        x: sx,
        y: 1.55,
        w: 2.86,
        h: 0.44,
        fill: { color: st.bar },
        line: { type: 'none' },
      });
      s.addText(st.code, {
        x: sx + 0.12,
        y: 1.61,
        w: 2.62,
        h: 0.32,
        fontFace: FONT,
        fontSize: 11.5,
        bold: true,
        color: C.white,
        align: 'center',
      });
      s.addText(st.actor, {
        x: sx + 0.18,
        y: 2.15,
        w: 2.5,
        h: 0.32,
        fontFace: FONT,
        fontSize: 11.5,
        bold: true,
        color: C.navy,
      });
      s.addText(st.desc, {
        x: sx + 0.18,
        y: 2.54,
        w: 2.5,
        h: 1.45,
        fontFace: FONT,
        fontSize: 10.8,
        color: C.slate700,
      });
      if (i < steps.length - 1) {
        s.addText('→', {
          x: sx + 2.86,
          y: 2.55,
          w: 0.26,
          h: 0.5,
          fontFace: FONT,
          fontSize: 22,
          bold: true,
          color: C.teal,
          align: 'center',
        });
      }
    });

    // Bottom circuit: Révocation & Correction
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 4.55,
      w: 12.23,
      h: 2.2,
      rectRadius: 0.12,
      fill: { color: C.white },
      line: { color: 'F5B5C0', width: 1.2 },
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.55,
      y: 4.55,
      w: 0.12,
      h: 2.2,
      fill: { color: C.rose },
      line: { type: 'none' },
    });
    s.addText('Circuit de contrôle qualité : Révocation & Correction tracée', {
      x: 0.85,
      y: 4.72,
      w: 11.5,
      h: 0.38,
      fontFace: FONT,
      fontSize: 14,
      bold: true,
      color: C.rose,
    });
    s.addText(
      [
        'Chef de division : peut révoquer un rapport SOUMIS (avant validation) en saisissant un motif obligatoire.',
        'Direction centrale (DPA) : dispose du pouvoir exclusif de révoquer aussi bien un rapport SOUMIS qu’un rapport déjà VALIDE.',
        'Chef de service : reçoit le bandeau rouge « Motif de révocation », corrige librement le canevas (statut CORRIGE) puis re-soumet le rapport complet.',
        'Journal d’audit complet : chaque action (soumission, validation, révocation, motif, horodatage et auteur) est conservée en base.',
      ].map((t) => ({
        text: t,
        options: { bullet: { code: '2022', color: C.rose }, paraSpaceAfter: 5 },
      })),
      {
        x: 0.85,
        y: 5.18,
        w: 11.65,
        h: 1.45,
        fontFace: FONT,
        fontSize: 11,
        color: C.slate700,
      },
    );
  }

  // =========================================================================
  // SLIDE 5 — VOLET 1 : ADMINISTRATION NATIONALE
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Volet 1 · Administration nationale',
      'Paramétrage centralisé, habilitations et sécurité des accès',
      5,
    );

    addScreenshotFrame(
      s,
      shotPath('03_admin_organisation.png'),
      0.55,
      1.38,
      6.2,
      3.55,
      'Organisation nationale : 12 Directions régionales, Divisions et 43 Services',
    );
    addScreenshotFrame(
      s,
      shotPath('07_admin_habilitations.png'),
      0.55,
      5.26,
      6.2,
      1.55,
    );

    addBulletCard(
      s,
      7.05,
      1.38,
      5.73,
      2.65,
      '5 onglets dédiés à l’Administrateur national',
      [
        'Organisation : suivi en temps réel des 12 DR, divisions et services.',
        'Services : création / mise à jour des services Provinciaux et Frontaliers (DCSP).',
        'Comptes utilisateurs : création, affectation hiérarchique et désactivation sans perte d’historique.',
        'Habilitations : activation fine des rubriques du canevas par service.',
        'Messagerie : diagnostic et test d’envoi des notifications e-mail.',
      ],
      C.navy,
    );

    addBulletCard(
      s,
      7.05,
      4.25,
      5.73,
      2.56,
      'Sécurité & continuité de service',
      [
        'Mots de passe forts (≥ 12 caractères) et authentification sécurisée.',
        'Réinitialisation d’accès en 1 clic : code à usage unique (24 h) ou mot de passe temporaire envoyé par e-mail.',
        'Remontée directe des demandes « Mot de passe oublié ? » avec badge d’alerte.',
        'Séparation stricte : l’Admin paramètre sans altérer les chiffres validés.',
      ],
      C.teal,
    );
  }

  // =========================================================================
  // SLIDE 6 — VOLET 2 : CARTE INTERACTIVE DU MAROC (12 RÉGIONS)
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Volet 2 · Direction centrale (DPA)',
      'Carte interactive des 12 Directions régionales et suivi mensuel',
      6,
    );

    addScreenshotFrame(
      s,
      shotPath('10_central_carte_regionale.png'),
      0.55,
      1.38,
      8.15,
      4.35,
      'Carte choroplèthe multi-niveaux (0 % à 100 %) et liste défilable des 12 Directions régionales (01 → 12)',
    );

    addBulletCard(
      s,
      8.98,
      1.38,
      3.8,
      5.42,
      'Pilotage visuel en temps réel',
      [
        'Couverture complète des 12 Directions régionales (43 services vétérinaires).',
        'Échelle de progression en 5 nuances de vert reflétant le taux exact de saisie (25 %, 33 %, 50 %, 67 %, 75 %, 100 %).',
        'Écart en points affiché automatiquement par rapport au mois précédent.',
        'Liste encadrée défilable ordonnée de 01 à 12 avec boutons ▲ / ▼.',
        'Interactivité bidirectionnelle : cliquer une région sur la carte filtre tout le tableau de bord et synchronise la liste.',
      ],
      C.teal,
    );

    // Compact bottom strip listing the 12 ordered regions
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 6.18,
      w: 8.15,
      h: 0.68,
      rectRadius: 0.08,
      fill: { color: C.white },
      line: { color: C.border, width: 1 },
    });
    s.addText(
      'Classement 01 → 12 : 01 Rabat-Salé-Kénitra · 02 Tanger-Tétouan-Al Hoceïma · 03 Casablanca-Settat · 04 L’Oriental · 05 Drâa-Tafilalet · 06 Souss-Massa · 07 Laâyoune-Sakia El Hamra · 08 Marrakech-Safi · 09 Béni Mellal-Khénifra · 10 Fès-Meknès · 11 Dakhla-Oued Ed-Dahab · 12 Guelmim-Oued Noun',
      {
        x: 0.72,
        y: 6.24,
        w: 7.82,
        h: 0.56,
        fontFace: FONT,
        fontSize: 8.8,
        color: C.slate700,
      },
    );
  }

  // =========================================================================
  // SLIDE 7 — VOLET 2 : RAPPORTS, COMPLÉTUDE & TOTAL CONSOLIDÉ
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Volet 2 · Consolidation opérationnelle',
      'Rapports, Complétude & Export « Total consolidé » multi-services',
      7,
    );

    addScreenshotFrame(
      s,
      shotPath('11_central_rapports.png'),
      0.55,
      1.38,
      8.15,
      5.1,
      'Rubrique Rapports et validation — Barre Total consolidé (Excel, PDF, E-mail, WhatsApp) et colonne Complétude',
    );

    addBulletCard(
      s,
      8.98,
      1.38,
      3.8,
      2.62,
      'Total consolidé en 1 clic',
      [
        'Additionne automatiquement tous les services vétérinaires du périmètre filtré.',
        'Disponible en Excel (.xlsx), PDF officiel, E-mail (PDF) et WhatsApp (PDF).',
        'S’adapte automatiquement au profil : National (DPA), Régional (DR) ou Division.',
      ],
      C.teal,
    );

    addBulletCard(
      s,
      8.98,
      4.22,
      3.8,
      2.62,
      'Contrôle de complétude & Audit',
      [
        'Colonne « Complétude » avec jauge visuelle par service.',
        '5 onglets avec compteurs : Tous, Introduits, Non introduits, En validation, Validés.',
        'Consultation en lecture seule et révocation motivée directe.',
      ],
      C.navy,
    );
  }

  // =========================================================================
  // SLIDE 8 — VOLET 2 : REPORTING OFFICIEL (2025 & 2026)
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Volet 2 · Reporting officiel consolidé',
      'Analyse mensuelle & annuelle des indicateurs validés (2025 & 2026)',
      8,
    );

    addScreenshotFrame(
      s,
      shotPath('12_central_reporting.png'),
      0.55,
      1.38,
      5.95,
      3.78,
      'Suivi annuel 2026 : août & octobre à 100 %, suivi dynamique des autres mois',
    );
    addScreenshotFrame(
      s,
      shotPath('20_central_reporting_2025.png'),
      6.83,
      1.38,
      5.95,
      3.78,
      'Bilan annuel 2025 complet : 516 / 516 rapports validés (100 % sur les 12 DR)',
    );

    // Bottom highlight strip
    const highlights = [
      {
        t: 'Données exclusivement validées',
        d: 'Seuls les rapports au statut VALIDE alimentent les tableaux officiels et courbes d’évolution.',
      },
      {
        t: 'Comparaisons multi-axes',
        d: 'Comparaison par périmètre global, inter-régions ou inter-services, au mois ou à l’année.',
      },
      {
        t: 'Diffusion multi-canal',
        d: 'Export Excel multi-onglets, rapport PDF institutionnel, envoi E-mail et partage WhatsApp.',
      },
    ];
    highlights.forEach((h, i) => {
      const hx = 0.55 + i * 4.14;
      s.addShape(pptx.ShapeType.roundRect, {
        x: hx,
        y: 5.58,
        w: 3.94,
        h: 1.3,
        rectRadius: 0.1,
        fill: { color: C.white },
        line: { color: C.border, width: 1 },
      });
      s.addText(h.t, {
        x: hx + 0.18,
        y: 5.7,
        w: 3.58,
        h: 0.32,
        fontFace: FONT,
        fontSize: 12,
        bold: true,
        color: C.teal,
      });
      s.addText(h.d, {
        x: hx + 0.18,
        y: 6.06,
        w: 3.58,
        h: 0.72,
        fontFace: FONT,
        fontSize: 10.2,
        color: C.slate600,
      });
    });
  }

  // =========================================================================
  // SLIDE 9 — VOLET 2 : VEILLE SANITAIRE & ANALYSE IA
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Volet 2 · Intelligence décisionnelle (Direction centrale)',
      'Module exclusif Veille sanitaire & Analyse IA',
      9,
    );

    addScreenshotFrame(
      s,
      shotPath('13_central_veille_ia.png'),
      0.55,
      1.38,
      7.15,
      5.05,
      'Interface Veille sanitaire & Analyse IA — 4 modules dédiés à la Direction centrale',
    );

    const iaModules = [
      {
        t: '1. Synthèse exécutive',
        d: 'Génère une note de briefing nationale consolidée (faits marquants, vigilances, recommandations).',
        col: C.teal,
      },
      {
        t: '2. Contrôle qualité & Anomalies',
        d: 'Repère les valeurs atypiques ou ruptures de série et propose un motif de révocation ciblé.',
        col: C.amber,
      },
      {
        t: '3. Assistant analytique (FR / AR)',
        d: 'Répond aux questions de la Direction en français ou en arabe à partir des chiffres réels.',
        col: C.navyMid,
      },
      {
        t: '4. Signaux faibles (6 mois)',
        d: 'Identifie précocement les dérives sanitaires régionales sur 6 mois glissants.',
        col: C.rose,
      },
    ];
    iaModules.forEach((m, i) => {
      const my = 1.38 + i * 1.38;
      s.addShape(pptx.ShapeType.roundRect, {
        x: 7.98,
        y: my,
        w: 4.8,
        h: 1.24,
        rectRadius: 0.1,
        fill: { color: C.white },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pptx.ShapeType.rect, {
        x: 7.98,
        y: my,
        w: 0.09,
        h: 1.24,
        fill: { color: m.col },
        line: { type: 'none' },
      });
      s.addText(m.t, {
        x: 8.2,
        y: my + 0.12,
        w: 4.45,
        h: 0.32,
        fontFace: FONT,
        fontSize: 12.5,
        bold: true,
        color: C.navy,
      });
      s.addText(m.d, {
        x: 8.2,
        y: my + 0.46,
        w: 4.45,
        h: 0.7,
        fontFace: FONT,
        fontSize: 10.3,
        color: C.slate600,
      });
    });
  }

  // =========================================================================
  // SLIDE 10 — VOLET 3 : DIRECTIONS RÉGIONALES & DIVISIONS
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Volet 3 · Pilotage territorial & Contrôle',
      'Directions régionales et Validation par les Divisions vétérinaires',
      10,
    );

    addScreenshotFrame(
      s,
      shotPath('14_dr_dashboard.png'),
      0.55,
      1.38,
      5.95,
      3.62,
      'Directeur régional : tableau de bord et suivi filtrés sur sa Direction régionale',
    );
    addScreenshotFrame(
      s,
      shotPath('15_division_validation.png'),
      6.83,
      1.38,
      5.95,
      3.62,
      'Chef de division : validation, révocation motivée et Total consolidé de la division',
    );

    addBulletCard(
      s,
      0.55,
      5.38,
      5.95,
      1.52,
      'Rôle du Directeur régional',
      [
        'Relance ciblée des services Non introduits ou en Brouillon.',
        'Export consolidé régional (Excel, PDF, E-mail, WhatsApp) et Reporting régional.',
      ],
      C.navyMid,
    );
    addBulletCard(
      s,
      6.83,
      5.38,
      5.95,
      1.52,
      'Rôle du Chef de division',
      [
        'Contrôle intégral des rapports SOUMIS avant validation (VALIDE) ou révocation.',
        'Total consolidé de la division accessible directement depuis Rapports et validation.',
      ],
      C.teal,
    );
  }

  // =========================================================================
  // SLIDE 11 — VOLET 4 : CHEFS DE SERVICES VÉTÉRINAIRES
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Volet 4 · Saisie terrain',
      'Expérience guidée pour les Chefs de services (Provinciaux & DCSP)',
      11,
    );

    addScreenshotFrame(
      s,
      shotPath('19_chef_saisie_active.png'),
      0.55,
      1.38,
      5.95,
      3.62,
      'Service provincial : saisie mensuelle progressive, jauge d’avancement et totaux Σ',
    );
    addScreenshotFrame(
      s,
      shotPath('18_chef_saisie_dcsp.png'),
      6.83,
      1.38,
      5.95,
      3.62,
      'Service frontalier DCSP : canevas ciblé Section IV — Importation',
    );

    addBulletCard(
      s,
      0.55,
      5.38,
      5.95,
      1.52,
      'Simplicité & zéro erreur de calcul',
      [
        'Navigation par étape avec calculs automatiques Σ et sauvegarde brouillon continue.',
        'Soumission sécurisée à 100 % et export immédiat (Excel, PDF, E-mail, WhatsApp).',
      ],
      C.teal,
    );
    addBulletCard(
      s,
      6.83,
      5.38,
      5.95,
      1.52,
      'Canevas adapté à chaque mission',
      [
        'Les habilitations adaptent automatiquement le formulaire (Provincial vs Frontalier DCSP).',
        'En cas de révocation, le motif s’affiche en clair et le formulaire se déverrouille aussitôt.',
      ],
      C.navyMid,
    );
  }

  // =========================================================================
  // SLIDE 12 — DÉPLOIEMENT & PROCHAINES ÉTAPES
  // =========================================================================
  {
    const s = pptx.addSlide();
    addHeader(
      s,
      'Déploiement & Accompagnement',
      'Feuille de route de généralisation nationale',
      12,
    );

    const phases = [
      {
        step: 'Phase 1',
        title: 'Mise en place & Comptes',
        color: C.navy,
        items: [
          'Création des comptes pour les 12 Directions régionales, Divisions et Services vétérinaires.',
          'Paramétrage des habilitations (Provinciaux & DCSP) par l’Administrateur national.',
          'Validation de la messagerie officielle et des procédures d’accès.',
        ],
      },
      {
        step: 'Phase 2',
        title: 'Formation & Prise en main',
        color: C.teal,
        items: [
          'Diffusion du Manuel complet PDF illustré (4 volets, 20 captures d’écran).',
          'Sessions de démonstration ciblées par profil (DR, Chefs de division, Chefs de service).',
          'Première campagne mensuelle accompagnée avec suivi sur la carte nationale.',
        ],
      },
      {
        step: 'Phase 3',
        title: 'Pilotage & Exploitation DPA',
        color: C.tealBright,
        items: [
          'Généralisation du Reporting officiel mensuel et annuel consolidé.',
          'Diffusion rapide des synthèses via Total consolidé (Excel, PDF, E-mail, WhatsApp).',
          'Exploitation continue des 4 modules de Veille sanitaire & Analyse IA.',
        ],
      },
    ];

    phases.forEach((p, i) => {
      const px = 0.55 + i * 4.14;
      s.addShape(pptx.ShapeType.roundRect, {
        x: px,
        y: 1.45,
        w: 3.94,
        h: 3.95,
        rectRadius: 0.12,
        fill: { color: C.white },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pptx.ShapeType.rect, {
        x: px,
        y: 1.45,
        w: 3.94,
        h: 0.52,
        fill: { color: p.color },
        line: { type: 'none' },
      });
      s.addText(`${p.step} · ${p.title}`, {
        x: px + 0.16,
        y: 1.54,
        w: 3.62,
        h: 0.34,
        fontFace: FONT,
        fontSize: 12.5,
        bold: true,
        color: C.white,
      });
      s.addText(
        p.items.map((it) => ({
          text: it,
          options: {
            bullet: { code: '2022', color: p.color },
            paraSpaceAfter: 9,
          },
        })),
        {
          x: px + 0.2,
          y: 2.15,
          w: 3.54,
          h: 3.05,
          fontFace: FONT,
          fontSize: 11.2,
          color: C.slate700,
        },
      );
    });

    // Executive closing banner
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: 5.72,
      w: 12.23,
      h: 1.12,
      rectRadius: 0.12,
      fill: { color: C.navy },
      line: { type: 'none' },
    });
    s.addText(
      'VETRA — Un socle numérique national, fiable et évolutif au service de la sécurité sanitaire',
      {
        x: 0.85,
        y: 5.88,
        w: 11.6,
        h: 0.38,
        fontFace: FONT,
        fontSize: 15,
        bold: true,
        color: '9DE5CD',
      },
    );
    s.addText(
      'Documentation disponible : Manuel complet PDF illustré (4 volets) & Présentation PowerPoint Direction Générale · ONSSA – DPA',
      {
        x: 0.85,
        y: 6.32,
        w: 11.6,
        h: 0.34,
        fontFace: FONT,
        fontSize: 11,
        color: C.white,
      },
    );
  }

  const pptxArtifactPath = path.join(
    SHOTS_DIR,
    'Presentation_VETRA_ONSSA_DPA.pptx',
  );
  const pptxPublicPath = path.join(
    PUBLIC_TUTORIEL_DIR,
    'Presentation_VETRA_ONSSA_DPA.pptx',
  );
  await pptx.writeFile({ fileName: pptxArtifactPath });
  fs.copyFileSync(pptxArtifactPath, pptxPublicPath);
  console.log('PPTX generated:', pptxArtifactPath, 'and', pptxPublicPath);
}

async function main() {
  const html = buildTutorialHtml();
  const htmlArtifactPath = path.join(
    SHOTS_DIR,
    'Tutoriel_VETRA_ONSSA_DPA.html',
  );
  const htmlPublicPath = path.join(
    PUBLIC_TUTORIEL_DIR,
    'Tutoriel_VETRA_ONSSA_DPA.html',
  );
  fs.writeFileSync(htmlArtifactPath, html, 'utf8');
  fs.writeFileSync(htmlPublicPath, html, 'utf8');
  console.log('HTML generated:', htmlArtifactPath, 'and', htmlPublicPath);

  await buildPowerPoint();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
