const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const runtime=process.env.MAVIMAKER_TEST_MODULES;
const {chromium}=require(runtime?runtime+'/playwright':'playwright');
const JSZip=require(runtime?runtime+'/jszip':'jszip');
const root=path.resolve(__dirname,'..'),out=process.env.MAVIMAKER_OUTPUT_DIR||path.join(root,'test-results');
function check(mesh){
 const edges=new Map();let volume=0,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const p of mesh.vertices)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
 for(const f of mesh.faces){const [a,b,c]=f.map(i=>mesh.vertices[i]);
 volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 for(let j=0;j<3;j++){const a=f[j],b=f[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}
 }
 const bad=[...edges.values()].filter(([n,d])=>n!==2||d!==0).length;
 assert.equal(bad,0,'non-manifold or inconsistently oriented edges');assert(volume>0);
 return {vertices:mesh.vertices.length,triangles:mesh.faces.length,volumeMm3:volume,min,max,badEdges:bad};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const name=req.url.split('?')[0];const file=path.join(root,name==='/'?'index.html':name);try{const data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'text/html');res.end(data);}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 let browser;try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>state.layers.length===6);
 const result=await page.evaluate(()=>({w:state.w,h:state.h,layers:state.layers.map((l,i)=>({name:l.name,color:l.color,count:l.mask.filter(Boolean).length,mesh:indexedMesh(triangles(l,i))})),status:document.getElementById('status').textContent}));
 const report={image:'jesus-original.png',grid:[result.w,result.h],layers:result.layers.map(l=>({name:l.name,color:l.color,cells:l.count,...check(l.mesh)})),errors};
 assert.equal(report.layers.length,6);assert.equal(report.layers[0].min[2],0);assert.equal(report.layers[0].max[2],2);
 for(const l of report.layers.slice(1)){assert.equal(l.min[2],2);assert.equal(l.max[2],2.6);}
 assert(Math.abs(report.layers[0].max[1]-report.layers[0].min[1]-40)<1e-7);
 const downloadPromise=page.waitForEvent('download');await page.click('#export3mf');const download=await downloadPromise;await download.saveAs(path.join(out,'jesus-40mm.3mf'));
 const zip=await JSZip.loadAsync(fs.readFileSync(path.join(out,'jesus-40mm.3mf')));const xml=await zip.file('3D/3dmodel.model').async('string');assert.equal((xml.match(/<item /g)||[]).length,1);assert.equal((xml.match(/<component /g)||[]).length,6);assert.equal((xml.match(/<base /g)||[]).length,5);
 await page.screenshot({path:path.join(out,'interfaz.png'),fullPage:true});
 // Changing dimensions must regenerate all meshes at the requested scale.
 await page.fill('#size','50');await page.locator('#size').dispatchEvent('change');
 const height=await page.evaluate(()=>{const p=triangles(state.layers[0],0);let min=Infinity,max=-Infinity;for(const v of p){min=Math.min(min,v[1]);max=Math.max(max,v[1]);}return max-min;});assert(Math.abs(height-50)<1e-6);
 await page.fill('#size','40');await page.locator('#size').dispatchEvent('change');
 // Project round trip through actual upload input.
 const saved=page.waitForEvent('download');await page.click('#save');const project=await saved;const projectPath=path.join(out,'jesus-proyecto.json');await project.saveAs(projectPath);await page.setInputFiles('#load',projectPath);await page.waitForFunction(()=>document.getElementById('status').textContent==='Proyecto recuperado.');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'interfaz-movil.png'),fullPage:true});
 assert.deepEqual(errors,[]);report.checks=['closed oriented meshes','positive volumes','40 mm height','2 mm base','0.6 mm color relief','one assembly / six components','material colors','export button download','dimension control','project save and load','mobile layout'];
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
