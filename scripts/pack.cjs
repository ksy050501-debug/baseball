const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');let html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const css=fs.readFileSync(path.join(base,'style.css'),'utf8'),engine=fs.readFileSync(path.join(base,'engine.js'),'utf8');let app=fs.readFileSync(path.join(base,'app.js'),'utf8');
for(const name of ['stadium','players']){const data=fs.readFileSync(path.join(base,'assets',name+'.png')).toString('base64');app=app.replace("'assets/"+name+".png'",JSON.stringify('data:image/png;base64,'+data));}
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>').replace('<script src="engine.js"></script>','<script>'+engine+'</script>').replace('<script src="app.js"></script>','<script>'+app+'</script>');
fs.writeFileSync(path.join(base,'downloads/baseball.html'),html);console.log('Standalone HTML ready: '+(Buffer.byteLength(html)/1048576).toFixed(1)+' MB');
