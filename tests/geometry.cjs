const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const runtime=process.env.MAVIMAKER_TEST_MODULES;
const {PNG}=require(runtime?runtime+'/pngjs':'pngjs'),JSZip=require(runtime?runtime+'/jszip':'jszip');
const root=path.resolve(__dirname,'..'),out=process.env.MAVIMAKER_OUTPUT_DIR||path.join(root,'test-results');
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:({size:40,base:2,relief:.6,resolution:256,maxcolors:5})[id]||'',addEventListener(){}});return elements.get(id);}
const sandbox={console,Blob,JSZip,setTimeout,document:{getElementById:el},window:{},Uint8Array,Int16Array,Map};vm.createContext(sandbox);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const inline=html.split('<script>')[1].split('</script>')[0];
vm.runInContext(inline,sandbox);vm.runInContext(fs.readFileSync(path.join(root,'converter.js'),'utf8'),sandbox);
function check(mesh){
 const edges=new Map();let volume=0,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const p of mesh.vertices)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
 for(const f of mesh.faces){const [a,b,c]=f.map(i=>mesh.vertices[i]);volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 for(let j=0;j<3;j++){const a=f[j],b=f[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}}
 const bad=[...edges.values()].filter(([n,d])=>n!==2||d!==0).length;
 assert.equal(bad,0,'non-manifold edges');assert(volume>0,'positive volume');
 return {vertices:mesh.vertices.length,triangles:mesh.faces.length,volumeMm3:volume,min,max,badEdges:bad};
}
(async()=>{
 const png=PNG.sync.read(fs.readFileSync(path.join(root,'assets/jesus-original.png')));
 let x0=png.width,y0=png.height,x1=0,y1=0;
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]>=128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const h=256,w=Math.round(h*(x1-x0+1)/(y1-y0+1));
 // Deterministic nearest sampling of the original RGBA PNG for offline QA.
 sandbox.raster={source:png.data,sourceWidth:png.width,x0,y0,x1,y1,w,h};
 const pixels=vm.runInContext('sampleRaster(raster.source,raster.sourceWidth,raster.x0,raster.y0,raster.x1,raster.y1,raster.w,raster.h)',sandbox);
 sandbox.input={w,h,pixels};
 const result=vm.runInContext(`(()=>{const {w,h,pixels}=input,colors=JESUS_PALETTE.map(rgb),labels=new Int16Array(w*h).fill(-1);for(let i=0;i<labels.length;i++)if(pixels[4*i+3]>=128)labels[i]=nearest(pixels.slice(4*i,4*i+3),colors);cleanLabels(labels,w,h);state.w=w;state.h=h;state.layers=[{name:'Base continua',color:JESUS_PALETTE[0],height:2,mask:silhouette(labels,w,h)},...colors.map((c,j)=>({name:COLOR_NAMES[j],color:hex(...c),height:.6,mask:Array.from(labels,v=>v===j?1:0)}))];return state.layers.map((l,i)=>({name:l.name,color:l.color,cells:l.mask.filter(Boolean).length,mesh:indexedMesh(triangles(l,i))}));})()`,sandbox);
 const layers=result.map(l=>({name:l.name,color:l.color,cells:l.cells,...check(l.mesh)}));
 // Exercise the actual process action using the decoded PNG as a canvas source.
 sandbox.pngSource=png.data;sandbox.imageSize={width:png.width,height:png.height};
 sandbox.document.createElement=()=>({getContext:()=>({drawImage(){},getImageData(){return {data:png.data};}})});
 const actualCounts=vm.runInContext('draw=()=>{};state.source=imageSize;process();state.layers.map(l=>l.mask.filter(Boolean).length)',sandbox);
 assert.deepEqual(Array.from(actualCounts),Array.from(result,l=>l.cells),'process action matches validated export masks');
 const baseMask=vm.runInContext('state.layers[0].mask',sandbox),seen=new Set(),queue=[baseMask.indexOf(1)];seen.add(queue[0]);
 for(let k=0;k<queue.length;k++){const i=queue[k],x=i%w,y=Math.floor(i/w);for(const n of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(n>=0&&baseMask[n]&&!seen.has(n)){seen.add(n);queue.push(n);}}
 assert.equal(seen.size,layers[0].cells,'base is one connected region');
 assert.equal(layers.length,6);assert.equal(layers[0].min[2],0);assert.equal(layers[0].max[2],2);assert.equal(layers[0].max[1]-layers[0].min[1],40);
 layers.slice(1).forEach(l=>{assert.equal(l.min[2],2);assert.equal(l.max[2],2.6);});
 fs.mkdirSync(out,{recursive:true});const blob=await vm.runInContext('make3mf()',sandbox);const data=Buffer.from(await blob.arrayBuffer());fs.writeFileSync(path.join(out,'jesus-40mm.3mf'),data);
 const zip=await JSZip.loadAsync(data);const xml=await zip.file('3D/3dmodel.model').async('string');assert.equal((xml.match(/<component /g)||[]).length,6);assert.equal((xml.match(/<item /g)||[]).length,1);assert.equal((xml.match(/<base /g)||[]).length,5);
 fs.writeFileSync(path.join(out,'jesus-proyecto.json'),vm.runInContext('JSON.stringify({version:2,w:state.w,h:state.h,layers:state.layers,size:40,base:2})',sandbox));
 const preview=new PNG({width:w,height:h});const masks=vm.runInContext('state.layers',sandbox);for(let i=0;i<w*h;i++)for(const l of masks)if(l.mask[i]){preview.data.set([...l.color.slice(1).match(/../g).map(v=>parseInt(v,16)),255],i*4);}
 fs.writeFileSync(path.join(out,'jesus-colores.png'),PNG.sync.write(preview));
 const report={source:'Original attached PNG',sampling:'Deterministic nearest-neighbor shared with browser converter',grid:[w,h],layers,checks:['closed consistently oriented edges','positive volumes','40mm high','2mm base','0.6mm relief','single connected base','process action with simulated canvas','one assembly / six components / five materials','3MF ZIP readable'],browserQA:'Not run: execution approval rejected',slicerQA:'FlashForge Studio import not tested'};
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
