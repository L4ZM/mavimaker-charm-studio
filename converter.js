/* Original implementation: raster segmentation and boundary-only extrusion.
   No Nzzleworks code or project profiles are used. */
const JESUS_PALETTE=['#080706','#a54120','#f7cf99','#fafafa','#ff3920'];
const COLOR_NAMES=['Negro','Café rojizo','Piel','Blanco','Rojo'];
function cleanLabels(labels,w,h){
  // Conservative majority filter removes isolated antialias speckles.
  const original=labels.slice();
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x;if(original[i]<0)continue;
    const counts=new Map();
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const v=original[i+dy*w+dx];if(v>=0)counts.set(v,(counts.get(v)||0)+1);
    }
    for(const [v,n] of counts)if(n>=7)labels[i]=v;
  }
  // Resolve diagonal-only contacts consistently across all colors. Such contacts
  // otherwise create an edge shared by four faces after extrusion.
  for(let pass=0;pass<12;pass++){
    let changed=false;
    for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
      const a=y*w+x,b=a+1,c=a+w,d=c+1;
      if(labels[a]>=0&&labels[a]===labels[d]&&labels[a]!==labels[b]&&labels[a]!==labels[c]){labels[b]=labels[a];changed=true;}
      if(labels[b]>=0&&labels[b]===labels[c]&&labels[b]!==labels[a]&&labels[b]!==labels[d]){labels[a]=labels[b];changed=true;}
    }
    if(!changed)break;
  }
  return labels;
}
function silhouette(labels,w,h){
  const mask=Uint8Array.from(labels,v=>v>=0?1:0),outside=new Uint8Array(w*h),q=[];
  function visit(i){if(!mask[i]&&!outside[i]){outside[i]=1;q.push(i);}}
  for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}
  for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
  for(let k=0;k<q.length;k++){const i=q[k],x=i%w,y=Math.floor(i/w);if(x)visit(i-1);if(x<w-1)visit(i+1);if(y)visit(i-w);if(y<h-1)visit(i+w);}
  return Array.from(mask,(v,i)=>v||!outside[i]?1:0);
}
process=function(){
  if(!state.source)return status('Primero carga un PNG o SVG.');
  const img=state.source,c=document.createElement('canvas');c.width=img.width;c.height=img.height;
  const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);
  const source=cx.getImageData(0,0,c.width,c.height).data;
  let x0=c.width,y0=c.height,x1=-1,y1=-1;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(source[(y*c.width+x)*4+3]>=128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x1<0)return status('La imagen no tiene píxeles visibles.');
  const n=+$('resolution').value,w=Math.max(1,Math.round(n*(x1-x0+1)/(y1-y0+1))),h=n;
  if(w*h>300000)return status('La proporción de imagen es demasiado ancha.');
  const data=sampleRaster(source,c.width,x0,y0,x1,y1,w,h),k=+$('maxcolors').value;
  // Fixed semantic seeds deliberately preserve the small red cross and avoid
  // spending multiple palette entries on the shaded hair or skin.
  const colors=k===5?JESUS_PALETTE.map(rgb):palette(data,k);
  const labels=new Int16Array(w*h).fill(-1);
  for(let i=0;i<labels.length;i++)if(data[i*4+3]>=128)labels[i]=nearest(Array.from(data.slice(i*4,i*4+3)),colors);
  cleanLabels(labels,w,h);
  state.w=w;state.h=h;
  state.layers=[{name:'Base continua',color:JESUS_PALETTE[0],mask:silhouette(labels,w,h),height:+$('base').value}];
  colors.forEach((color,j)=>{const mask=Array.from(labels,v=>v===j?1:0);if(mask.some(Boolean))state.layers.push({name:k===5?COLOR_NAMES[j]:'Color '+(j+1),color:hex(...color),mask,height:+$('relief').value});});
  draw();
  status(`${w} × ${h}; ${state.layers.length-1} colores; alto ${$('size').value} mm; base ${$('base').value} mm + relieve ${$('relief').value} mm. Contornos suavizados sobre cuadrícula. Revisa detalles inferiores a 0.4 mm y asigna filamentos en el laminador.`);
};
const rasterTriangles=triangles;
triangles=function(layer,index){
  const old=$('size').value,oldBase=$('base').value;
  if(!Number.isFinite(+old)||+old<=0||!Number.isFinite(layer.height)||layer.height<=0)throw Error('Medidas inválidas');
  // Existing extrusion uses max dimension; scale to actual occupied image height.
  $('size').value=+old*Math.max(state.w,state.h)/state.h;
  $('base').value=state.layers[0].height;
  try{return rasterTriangles(layer,index);}finally{$('size').value=old;$('base').value=oldBase;}
};
function sampleRaster(source,sourceWidth,x0,y0,x1,y1,w,h){
  const data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const sx=x0+Math.min(x1-x0,Math.floor((x+.5)*(x1-x0+1)/w));
    const sy=y0+Math.min(y1-y0,Math.floor((y+.5)*(y1-y0+1)/h));
    data.set(source.slice((sy*sourceWidth+sx)*4,(sy*sourceWidth+sx)*4+4),(y*w+x)*4);
  }
  return data;
}
function indexedMesh(tris){
  const vertices=[],faces=[],lookup=new Map();
  for(let i=0;i<tris.length;i+=3){const face=[];for(let j=0;j<3;j++){
    const p=tris[i+j],key=p.map(v=>v.toFixed(7)).join(',');
    if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(p);}
    face.push(lookup.get(key));
  }faces.push(face);}
  return {vertices,faces};
}
modelXml=function(tris){const {vertices,faces}=indexedMesh(tris);return `<mesh><vertices>${vertices.map(p=>`<vertex x="${p[0].toFixed(7)}" y="${p[1].toFixed(7)}" z="${p[2].toFixed(7)}"/>`).join('')}</vertices><triangles>${faces.map(f=>`<triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}"/>`).join('')}</triangles></mesh>`;};
function escapeXml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
async function make3mf(){
  const zip=new JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
  const materialLayers=state.layers.filter((l,i,all)=>all.findIndex(v=>v.color.toLowerCase()===l.color.toLowerCase())===i);
  const materials=materialLayers.map(l=>`<base name="${escapeXml(l.name)}" displaycolor="${l.color.toUpperCase()}FF"/>`).join('');
  const objects=state.layers.map((l,i)=>`<object id="${i+2}" name="${escapeXml(l.name)}" type="model" pid="1" pindex="${materialLayers.findIndex(v=>v.color.toLowerCase()===l.color.toLowerCase())}">${modelXml(triangles(l,i))}</object>`).join('');
  const assembly=state.layers.length+2;
  zip.file('3D/3dmodel.model',`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="es" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">MaviMaker Charm Studio 0.2</metadata><resources><basematerials id="1">${materials}</basematerials>${objects}<object id="${assembly}" name="Charm" type="model"><components>${state.layers.map((_,i)=>`<component objectid="${i+2}"/>`).join('')}</components></object></resources><build><item objectid="${assembly}"/></build></model>`);
  return zip.generateAsync({type:'blob',compression:'DEFLATE'});
}
export3mf=async function(){if(!state.layers.length)return status('No hay geometría.');try{status('Generando 3MF…');await new Promise(r=>setTimeout(r,20));download(await make3mf(),'mavimaker-jesus.3mf');status('3MF generado: ensamblaje con base y piezas por color. Importa como un solo objeto con varias piezas para conservar alturas.');}catch(e){status('Error al exportar: '+e.message);}};
demo=function(){const img=new Image();img.onload=()=>setSource(img);img.onerror=()=>status('No se pudo cargar el PNG original.');img.src='assets/jesus-original.png';};
$('demo').onclick=demo;$('process').onclick=process;$('export3mf').onclick=export3mf;
