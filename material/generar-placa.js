// Genera la placa de instrucciones para el equipo (PNG 1080x1920).
const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.argv[2];
const OUT = process.argv[3];
const qrgen = require(SP + '/qr/package/qrcode.js');
const URL = 'https://sebasbelluscio09.github.io/Mi-primer-proyecto-/';
const q = qrgen(0, 'M'); q.addData(URL); q.make();
const n = q.getModuleCount();
let rects = '';
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1.02" height="1.02"/>`;
const qr = `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" xmlns="http://www.w3.org/2000/svg"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><g fill="#1f1a17">${rects}</g></svg>`;
const icon = fs.readFileSync('/home/user/Mi-primer-proyecto-/icon.svg', 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:540px;height:960px;font-family:Inter,sans-serif;background:#faf7f2;color:#1f1a17;overflow:hidden;position:relative}
.top{background:#7a1f2b;color:#fff;padding:34px 30px 26px;display:flex;gap:16px;align-items:center}
.top .ic{width:64px;height:64px;flex:none}.top .ic svg{width:64px;height:64px;border-radius:15px;box-shadow:0 0 0 2px rgba(255,255,255,.35)}
.top h1{font-size:30px;font-weight:800;letter-spacing:-.4px;line-height:1.05}.top p{font-size:15px;opacity:.85;margin-top:5px}
.main{padding:22px 30px 0}
.qrbox{display:flex;gap:18px;align-items:center;background:#fff;border:1px solid #e5ddd1;border-radius:18px;padding:14px 16px;margin-bottom:18px}
.qrbox .qr{width:118px;height:118px;flex:none}.qrbox .qr svg{width:118px;height:118px}
.qrbox b{font-size:17px;display:block;margin-bottom:4px}.qrbox span{font-size:13.5px;color:#6f655d;line-height:1.35;display:block}
.qrbox .url{margin-top:8px;font-size:12.5px;color:#7a1f2b;font-weight:700;word-break:break-all}
.paso{display:flex;gap:14px;margin-bottom:15px}
.num{flex:none;width:34px;height:34px;border-radius:999px;background:#7a1f2b;color:#fff;font-weight:800;font-size:17px;display:flex;align-items:center;justify-content:center}
.paso h2{font-size:17.5px;font-weight:700;margin:5px 0 3px}.paso p{font-size:14px;line-height:1.4;color:#4a423c}
.paso p b{color:#1f1a17}
.tag{display:inline-block;background:#f3eee6;border-radius:6px;padding:0 6px;font-weight:600;color:#1f1a17}
.nota{margin:4px 30px 0;background:#f3eee6;border-radius:14px;padding:12px 16px;font-size:13.5px;line-height:1.4;color:#4a423c}
.nota b{color:#1f1a17}
.pie{position:absolute;bottom:20px;left:0;right:0;text-align:center;font-size:12.5px;color:#8a8079}
</style></head><body>
<div class="top"><div class="ic">${icon}</div><div><h1>Agenda de Gira</h1><p>Cómo entrar a la app del equipo</p></div></div>
<div class="main">
 <div class="qrbox"><div class="qr">${qr}</div><div><b>Abrí la app</b><span>Escaneá el código con la cámara del celular o tocá el link que te mandé.</span><div class="url">sebasbelluscio09.github.io/<br>Mi-primer-proyecto-</div></div></div>
 <div class="paso"><div class="num">1</div><div><h2>Ingresá</h2><p>Con <b>tu email</b> y la <b>contraseña provisoria</b> que te pasé por mensaje.</p></div></div>
 <div class="paso"><div class="num">2</div><div><h2>Instalala en el celular</h2><p><b>iPhone (Safari):</b> botón <span class="tag">Compartir</span> → <span class="tag">Agregar a inicio</span><br><b>Android (Chrome):</b> menú <span class="tag">⋮</span> → <span class="tag">Instalar app</span></p></div></div>
 <div class="paso"><div class="num">3</div><div><h2>Cambiá tu contraseña</h2><p>Abajo tocá <span class="tag">Cuenta</span> → <span class="tag">Cambiar contraseña</span>. Elegí una que recuerdes.</p></div></div>
 <div class="paso"><div class="num">4</div><div><h2>Qué vas a ver</h2><p>Calendario, mapa de la gira y cada función con horarios, teatro, hotel, traslado, checklist técnico y documentos. Los cambios se ven al instante.</p></div></div>
</div>
<div class="nota"><b>Sin señal en el teatro o en la ruta:</b> la app abre igual con los últimos datos. Abrila un momento con señal antes de salir para que quede actualizada.</div>
<div class="pie">¿Problemas para entrar? Escribile a la producción.</div>
</body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await p.setContent(html);
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT });
  await b.close();
})();
