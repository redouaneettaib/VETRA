import {PrismaClient} from '@prisma/client';import bcrypt from 'bcryptjs';
const db=new PrismaClient();
const regions=['Rabat-Salé-Kénitra','Casablanca-Settat','Fès-Meknès','Tanger-Tétouan-Al Hoceïma','Marrakech-Safi','Béni Mellal-Khénifra','Drâa-Tafilalet','Souss-Massa','Guelmim-Oued Noun','Laâyoune-Sakia El Hamra','Dakhla-Oued Ed-Dahab',"L’Oriental"];
async function main(){for(const name of regions){const region=await db.region.upsert({where:{name},create:{name},update:{}});await db.division.upsert({where:{regionId:region.id},create:{name:'Division vétérinaire — '+name,regionId:region.id},update:{}})}
const email=process.env.SEED_ADMIN_EMAIL||'admin@vetra.local',pw=process.env.SEED_ADMIN_PASSWORD;if(!pw||pw.length<12)throw Error('Définir SEED_ADMIN_PASSWORD (12 caractères min.) pour créer le compte administrateur');await db.user.upsert({where:{email},update:{},create:{email,name:'Administrateur',firstName:'National',role:'ADMIN_NATIONAL',passwordHash:await bcrypt.hash(pw,12),verified:true}});console.log('12 régions, 12 divisions et administrateur initialisés. Aucun service ni chiffre métier fictif.');}
main().finally(()=>db.$disconnect());
