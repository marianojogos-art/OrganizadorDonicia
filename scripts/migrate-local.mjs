import {readFile,readdir} from 'node:fs/promises';

export async function migrateLocal(DB){
 await DB.prepare('CREATE TABLE IF NOT EXISTS _local_migrations(name TEXT PRIMARY KEY)').run();
 // Older demo databases already contain migration 0001, but did not track it.
 const existing=await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
 if(existing)await DB.prepare("INSERT OR IGNORE INTO _local_migrations(name) VALUES('0001_initial.sql')").run();
 const directory=new URL('../migrations/',import.meta.url);
 const files=(await readdir(directory)).filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
 for(const name of files){
  if(await DB.prepare('SELECT name FROM _local_migrations WHERE name=?').bind(name).first())continue;
  const sql=await readFile(new URL(name,directory),'utf8');
  DB.exec('BEGIN IMMEDIATE');
  try{DB.exec(sql);await DB.prepare('INSERT INTO _local_migrations(name) VALUES(?)').bind(name).run();DB.exec('COMMIT')}
  catch(error){DB.exec('ROLLBACK');throw error}
 }
}
