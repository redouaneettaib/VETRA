import rows from './casa.json';
export const CANEVAS=rows as {row:number;cells:Record<string,string|number>}[];
export const RUBRICS=[
 ['I.A.1',7,14,'Contrôle des viandes rouges'],['I.A.2',15,21,'Contrôle des viandes foraines'],['I.A.3',22,31,'Contrôle des viandes blanches'],['I.A.4',32,35,'Contrôle des lagomorphes'],['I.A.5',36,47,'Sorties de contrôle'],['I.A.6',48,57,'Procès-verbaux'],['I.A.7',58,63,'Certification marché local'],['I.B.1',65,79,'Sorties en commissions mixtes'],['I.B.2',80,89,'PV commissions mixtes'],['I.C.1',91,111,'Restauration collective'],['I.C.2',112,117,'Contrôle des produits en restauration'],['I.D',118,122,'Foyers TIAC'],['II.A',124,157,'Inspection des établissements'],['II.B',158,163,'Dossiers d’agrément'],['II.C',164,172,'Retrait et rappel'],['III',173,179,'Engins de transport'],['IV',180,227,'Importation'],['V',228,273,'Exportation'],['VI.A',275,293,'Plans de contrôle et surveillance'],['VI.B',294,310,'Autres investigations analytiques']
] as const;
export const rubricForRow=(row:number)=>RUBRICS.find(([,a,b])=>row>=a&&row<=b)?.[0];
export const unitFor=(row:number,label:string)=>/OVO\s*PRODUITS|Œufs de consommation \(unités\)/i.test(label)?'unités':/viandes|abats/i.test(label)&&row>=180&&row<=273?'kg':undefined;
