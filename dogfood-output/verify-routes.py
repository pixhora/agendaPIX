from pathlib import Path
import re,json,urllib.request,urllib.error,concurrent.futures
root=Path('/var/home/matheus/projetos')
projects={'agenda-tests':3103,'agenda-backend':3000,'agenda-dashboard':3343,'agenda-booking-ui':3001,'agenda-conversion':3005}
rows=[]
for project,port in projects.items():
 for f in sorted((root/project/'app').rglob('*')):
  if f.name not in ['route.ts','page.tsx']:continue
  parts=[x for x in f.parent.relative_to(root/project/'app').parts if not x.startswith('(')]
  path='/'+'/'.join(parts)
  content=f.read_text()
  methods=re.findall(r'export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b',content) if f.name=='route.ts' else ['GET']
  if not methods:methods=['GET','POST'] if '[...all]' in path else ['não identificado']
  for method in methods:
   line=next((i for i,s in enumerate(content.splitlines(),1) if re.search(r'function\s+'+method+r'\b',s)),1)
   sample=path.replace('[slug]','qa-route-inexistente').replace('[id]','invalid-id').replace('[businessId]','11111111-1111-4111-8111-111111111111').replace('[provider]','fake').replace('[...all]','get-session')
   if path.endswith('/availability'):sample+='?serviceId=invalid&date=invalid'
   rows.append(dict(project=project,port=port,path=path,method=method,sample=sample,file=str(f.relative_to(root/project)),line=line))
 # Lacunas de integração verificáveis: mesma URL em todos os snapshots.
 if not (root/project/'app/api/businesses/[businessId]/pix-key/route.ts').exists():rows.append(dict(project=project,port=port,path='/api/businesses/[businessId]/pix-key',method='GET',sample='/api/businesses/11111111-1111-4111-8111-111111111111/pix-key',file='app/api/businesses/[businessId]/pix-key/route.ts (ausente)',line=1,absent=True))
def probe(row):
 if row['method']!='GET':row.update(observed='não executado (mutação)',classification='PENDENTE');return row
 try:
  with urllib.request.urlopen(f"http://127.0.0.1:{row['port']}{row['sample']}",timeout=3) as r:row.update(observed=str(r.status)+( ' (redirect seguido)' if r.url!=f"http://127.0.0.1:{row['port']}{row['sample']}" else ''),finalPath=urllib.parse.urlparse(r.url).path)
 except urllib.error.HTTPError as e:row['observed']=str(e.code)
 except Exception as e:row['observed']='indisponível: '+type(e).__name__
 row['classification']='OK' if row['observed'].startswith(('200','400','401','405')) and not row.get('absent') else 'MELHORAR'
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:rows=list(pool.map(probe,rows))
Path('dogfood-output/verify-routes-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
headers=['# Verificação de rotas — T3 — 2026-10-04','','Somente leitura de produto; inventário por arquivo e GET anônimo com identificadores inválidos/slug inexistente. Sem POST/PUT/DELETE, cookies, email, webhook ou reserva real. GET payment usa ID inválido: validação precede consulta/expiração. Rotas de auth consultadas apenas em get-session anônimo; outros subendpoints não exercitados.','','HEADs observados: tests ecc62d9; backend cafc5b2; dashboard c098a7a; booking-ui5b4c3ad; conversion fa797d0. Portas convencionais3103/3000/3343/3001/3005; não há identificação de build servido, portanto HTTP não prova associação ao HEAD. Ausência de conexão não é404.200 em página dinâmica não prova existência do negócio.','','## Inventário e observação por rota','','PENDENTE indica método mutante não executado por instrução read-only. OK HTTP limita-se ao caso anônimo/inválido observado; não aprova autorização de tenant com sessão real. Arquivo:linha local ao projeto identificado.','','| Worktree | Caminho | Método | Observado | Classe | Arquivo:linha |','|---|---|---|---|---|---|']
for r in rows:headers.append(f"| {r['project']} | `{r['path']}` | {r['method']} | {r['observed']} | {r['classification']} | `{r['file']}:{r['line']}` |")
Path('docs/VERIFICACAO_ROTAS.md').write_text('\n'.join(headers)+'\n')
print(json.dumps({'rows':len(rows),'statusCounts':{s:sum(r['observed']==s for r in rows) for s in sorted(set(r['observed'] for r in rows))}},ensure_ascii=False))
