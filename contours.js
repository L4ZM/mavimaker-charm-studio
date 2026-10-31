/* Shared planar contours: every material boundary uses the same smoothed points.
   Original MaviMaker geometry; polygon triangulation uses ISC-licensed Earcut. */
function boundaryLoops(mask,w,h){
  const stride=w+1,edges=new Map();
  const has=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];
  const add=(a,b)=>{if(edges.has(a))throw Error('Contacto diagonal ambiguo; vuelve a procesar la imagen.');edges.set(a,b);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(has(x,y)){
    const tl=y*stride+x,tr=tl+1,bl=tl+stride,br=bl+1;
    if(!has(x,y-1))add(tr,tl);
    if(!has(x+1,y))add(br,tr);
    if(!has(x,y+1))add(bl,br);
    if(!has(x-1,y))add(tl,bl);
  }
  const loops=[];
  while(edges.size){const start=edges.keys().next().value,loop=[];let v=start;
    do{loop.push(v);const next=edges.get(v);if(next===undefined)throw Error('Contorno abierto');edges.delete(v);v=next;}while(v!==start);
    if(loop.length>=4)loops.push(loop);
  }
  return loops;
}
function polygonArea(points){let a=0;for(let i=0,j=points.length-1;i<points.length;j=i++)a+=points[j][0]*points[i][1]-points[i][0]*points[j][1];return a/2;}
function insidePolygon(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
}return inside;}
function pruneStraight(points){
  // Earcut may discard exactly collinear vertices. Remove them from both caps
  // and walls first so exported edges remain conforming and watertight.
  let p=points;
  for(let pass=0;pass<3;pass++){
    const q=p.filter((b,i)=>{const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];return Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>1e-10;});
    if(q.length===p.length||q.length<3)break;p=q;
  }
  return p;
}
function contourPlan(layers,w,h){
  const loops=layers.map(l=>boundaryLoops(l.mask,w,h)),adj=new Map(),original=new Map(),edges=new Map(),stride=w+1;
  for(const polygons of loops)for(const loop of polygons)for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length],key=a<b?a+','+b:b+','+a;
    edges.set(key,[a,b]);
    for(const [u,v] of [[a,b],[b,a]]){if(!adj.has(u))adj.set(u,new Set());adj.get(u).add(v);original.set(u,[u%stride,-Math.floor(u/stride)]);}
  }
  let points=new Map(original);
  // Smooth only along the contour graph. Junctions stay fixed and a movement
  // cap protects narrow strokes. Shared interfaces cannot drift apart.
  for(let pass=0;pass<16;pass++){
    const next=new Map(points);
    for(const [id,neighbors] of adj)if(neighbors.size===2){
      const [a,b]=[...neighbors].map(n=>points.get(n)),p=points.get(id),o=original.get(id);
      let q=[.5*p[0]+.25*(a[0]+b[0]),.5*p[1]+.25*(a[1]+b[1])];
      const dx=q[0]-o[0],dy=q[1]-o[1],d=Math.hypot(dx,dy),limit=Math.min(1.25,.08*h/(+$('size').value||40));
      if(d>limit)q=[o[0]+dx*limit/d,o[1]+dy*limit/d];next.set(id,q);
    }
    points=next;
  }
  // Detect boundary intersections with a spatial grid and back off smoothing
  // when a very thin region would change topology.
  function crosses(map){
    const bins=new Map(),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for(const [a,b] of edges.values()){
      const p=map.get(a),q=map.get(b);
      for(let x=Math.floor(Math.min(p[0],q[0]));x<=Math.floor(Math.max(p[0],q[0]));x++)for(let y=Math.floor(Math.min(p[1],q[1]));y<=Math.floor(Math.max(p[1],q[1]));y++){
        const key=x+','+y,bin=bins.get(key)||[];
        for(const [c,d] of bin)if(a!==c&&a!==d&&b!==c&&b!==d){const r=map.get(c),s=map.get(d);
          if(cross(p,q,r)*cross(p,q,s)<-1e-12&&cross(r,s,p)*cross(r,s,q)<-1e-12)return true;
        }
        bin.push([a,b]);bins.set(key,bin);
      }
    }
    return false;
  }
  let smoothingScale=1;
  while(crosses(points)&&smoothingScale>1/64){smoothingScale/=2;points=new Map([...points].map(([id,p])=>{const o=original.get(id);return[id,[(p[0]+o[0])/2,(p[1]+o[1])/2]];}));}
  if(crosses(points))throw Error('No se pudo suavizar conservando los contornos.');
  const basePoints=loops[0].flat().map(id=>points.get(id));
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of basePoints){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
  return {loops,points,minX,maxX,minY,maxY,smoothingScale};
}
let contourCache=null;
function getContourPlan(){
  if(!contourCache||contourCache.layers!==state.layers||contourCache.w!==state.w||contourCache.h!==state.h||contourCache.size!==+$('size').value){contourCache={layers:state.layers,w:state.w,h:state.h,size:+$('size').value,plan:contourPlan(state.layers,state.w,state.h)};}
  return contourCache.plan;
}
drawPreviewOnly=function(){
  const ctx=$('preview').getContext('2d');ctx.clearRect(0,0,400,400);if(!state.layers.length)return;
  const p=getContourPlan(),scale=Math.min(370/(p.maxX-p.minX),370/(p.maxY-p.minY)),cx=(p.minX+p.maxX)/2,cy=(p.minY+p.maxY)/2;
  state.layers.forEach((l,i)=>{ctx.beginPath();for(const loop of p.loops[i]){
    loop.forEach((id,j)=>{const v=p.points.get(id),x=200+(v[0]-cx)*scale,y=200-(v[1]-cy)*scale;if(j)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.closePath();
  }ctx.fillStyle=l.color;ctx.fill('evenodd');});
};
const drawRasterUI=draw;
draw=function(){drawRasterUI();drawPreviewOnly();};
triangles=function(layer,index){
  const size=+$('size').value;
  if(!Number.isFinite(size)||size<=0||!Number.isFinite(layer.height)||layer.height<=0)throw Error('Medidas inválidas');
  const plan=getContourPlan(),scale=size/(plan.maxY-plan.minY),cx=(plan.minX+plan.maxX)/2,cy=(plan.minY+plan.maxY)/2;
  const polygons=plan.loops[index].map(loop=>pruneStraight(loop.map(id=>{const p=plan.points.get(id);return[+((p[0]-cx)*scale).toFixed(7),+((p[1]-cy)*scale).toFixed(7)];})));
  const outers=polygons.filter(p=>polygonArea(p)>0).map(p=>({points:p,holes:[]}));
  for(const hole of polygons.filter(p=>polygonArea(p)<0)){
    const parents=outers.filter(p=>insidePolygon(hole[0],p.points)).sort((a,b)=>polygonArea(a.points)-polygonArea(b.points));
    if(!parents.length)throw Error('Hueco sin contorno exterior');parents[0].holes.push(hole);
  }
  const z0=index?state.layers[0].height:0,z1=z0+layer.height,out=[];
  const tri=(a,b,c)=>out.push(a,b,c);
  for(const outer of outers){
    const rings=[outer.points,...outer.holes],flat=[],holes=[];let count=0;
    rings.forEach((r,i)=>{if(i)holes.push(count);for(const p of r){flat.push(...p);count++;}});
    const all=rings.flat(),raw=CharmEarcut(flat,holes,2),caps=[],repair=new Set();
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for(let k=0;k<raw.length;k+=3){const f=raw.slice(k,k+3);if(Math.abs(cross(...f.map(i=>all[i])))<1e-10)f.forEach(i=>repair.add(i));else caps.push(f);}
    // Earcut can emit a zero-area ear on a straight diagonal. Remove that ear
    // and split the neighboring cap at its boundary vertex to keep walls sewn.
    for(const id of repair){const p=all[id];for(let k=0;k<caps.length;k++){
      const f=caps[k];if(f.includes(id))continue;
      for(let j=0;j<3;j++){const a=all[f[j]],b=all[f[(j+1)%3]];
        if(Math.abs(cross(a,b,p))<1e-10&&(p[0]-a[0])*(p[0]-b[0])+(p[1]-a[1])*(p[1]-b[1])<-1e-12){
          const c=f[(j+2)%3];caps[k]=[f[j],id,c];caps.push([id,f[(j+1)%3],c]);break;
        }
      }
    }}
    const indices=caps.flat();
    for(let i=0;i<indices.length;i+=3){let [a,b,c]=indices.slice(i,i+3).map(j=>all[j]);
      if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0)[b,c]=[c,b];
      tri([...a,z1],[...b,z1],[...c,z1]);tri([...c,z0],[...b,z0],[...a,z0]);
    }
    for(const ring of rings)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      tri([...a,z0],[...b,z0],[...b,z1]);tri([...a,z0],[...b,z1],[...a,z1]);
    }
  }
  return out;
};
