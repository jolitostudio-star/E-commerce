// Dashboard served only after server-side authentication.
export const dashboard = `<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MargemIQ — Gestão de Margens e IA para Resellers</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23D8FF3E'/%3E%3Cpath d='M13 4L6 14h5l-1 6 7-10h-5l1-6z' fill='%230B0D05'/%3E%3C/svg%3E">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = { theme: { extend: { fontFamily: { display: ['Sora','sans-serif'], body: ['Inter','sans-serif'], mono: ['JetBrains Mono','monospace'] } } } };
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{
  --bg:#07080B; --surface:#0E1015; --surface-2:#12151C; --surface-3:#181C25;
  --border:rgba(255,255,255,.07); --border-2:rgba(255,255,255,.13);
  --text:#EEF1F5; --muted:#8B93A1; --faint:#5C6472;
  --volt:#D8FF3E; --volt-dim:rgba(216,255,62,.13);
  --emerald:#3DDC97; --rose:#FF5D73; --amber:#FFB224; --blue:#5EE0FF; --violet:#A78BFA;
  --radius:16px;
  --font-display:'Sora',sans-serif; --font-body:'Inter',sans-serif; --font-mono:'JetBrains Mono',monospace;
}
*{ -webkit-tap-highlight-color:transparent; }
html{ scroll-behavior:smooth; }
body{ background:var(--bg); color:var(--text); font-family:var(--font-body); font-size:14px; overflow-x:hidden; }
::selection{ background:rgba(216,255,62,.85); color:#0B0D05; }
[hidden]{ display:none !important; }
.noscroll{ overflow:hidden; }
:focus-visible{ outline:2px solid rgba(216,255,62,.7); outline-offset:2px; border-radius:6px; }
::-webkit-scrollbar{ width:10px; height:10px; }
::-webkit-scrollbar-track{ background:transparent; }
::-webkit-scrollbar-thumb{ background:#232833; border-radius:99px; border:2px solid var(--bg); }
::-webkit-scrollbar-thumb:hover{ background:#2E3542; }
input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
input[type=number]{ -moz-appearance:textfield; appearance:textfield; }
section{ scroll-margin-top:92px; }

#bgfx{ position:fixed; inset:0; z-index:-1; overflow:hidden; background:var(--bg); }
#bgfx::before{ content:''; position:absolute; width:760px; height:760px; left:-12%; top:-24%; background:radial-gradient(circle, rgba(216,255,62,.07), transparent 65%); animation:drift 26s ease-in-out infinite alternate; }
#bgfx::after{ content:''; position:absolute; width:640px; height:640px; right:-14%; bottom:-26%; background:radial-gradient(circle, rgba(130,90,255,.08), transparent 65%); animation:drift 30s ease-in-out infinite alternate-reverse; }
@keyframes drift{ from{ transform:translate(0,0) scale(1);} to{ transform:translate(6%,4%) scale(1.08);} }
.noise{ position:fixed; inset:0; z-index:200; pointer-events:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E"); }

.card{ background:linear-gradient(180deg, rgba(255,255,255,.028), rgba(255,255,255,0) 42%), var(--surface); border:1px solid var(--border); border-radius:var(--radius); }
.font-display{ font-family:var(--font-display); }
.t-pos{ color:var(--emerald); } .t-neg{ color:var(--rose); } .t-warn{ color:var(--amber); } .t-mut{ color:var(--muted); }

/* buttons */
.btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; height:40px; padding:0 16px; border-radius:11px; font-size:13.5px; font-weight:600; border:1px solid transparent; cursor:pointer; transition:.2s; white-space:nowrap; }
.btn:active{ transform:scale(.97); }
.btn-primary{ background:var(--volt); color:#0B0D05; box-shadow:0 0 0 1px rgba(216,255,62,.35), 0 10px 26px -10px rgba(216,255,62,.5); }
.btn-primary:hover{ filter:brightness(1.07); }
.btn-ghost{ background:var(--surface-2); border-color:var(--border); color:var(--text); }
.btn-ghost:hover{ border-color:var(--border-2); background:var(--surface-3); }
.btn-danger-soft{ background:rgba(255,93,115,.09); border-color:rgba(255,93,115,.28); color:#FF8CA0; }
.btn-danger-soft:hover{ background:rgba(255,93,115,.16); }
.btn-primary.sm, .btn-ghost.sm{ height:34px; padding:0 12px; font-size:12.5px; border-radius:9px; }
.icon-btn{ display:grid; place-items:center; width:38px; height:38px; border-radius:10px; border:1px solid var(--border); background:var(--surface-2); color:var(--muted); cursor:pointer; transition:.2s; position:relative; }
.icon-btn:hover{ color:var(--text); border-color:var(--border-2); }
.btn-volt-soft{ background:var(--volt-dim); color:var(--volt); border:1px solid rgba(216,255,62,.28); padding:4px 11px; border-radius:8px; font-size:11.5px; font-weight:700; cursor:pointer; transition:.2s; }
.btn-volt-soft:hover{ background:rgba(216,255,62,.22); }

/* inputs */
.inp{ width:100%; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:10px 12px; font-size:14px; color:var(--text); transition:.2s; }
.inp::placeholder{ color:var(--faint); }
.inp:focus{ outline:none; border-color:rgba(216,255,62,.55); box-shadow:0 0 0 3px rgba(216,255,62,.12); }
.inp.err{ border-color:rgba(255,93,115,.7); box-shadow:0 0 0 3px rgba(255,93,115,.14); animation:shake .3s; }
@keyframes shake{ 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
.inpwrap{ position:relative; display:flex; align-items:center; }
.inpwrap>span{ position:absolute; left:12px; font-size:13px; color:var(--faint); pointer-events:none; }
.inpwrap>input{ width:100%; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:10px 12px 10px 36px; font-size:14px; color:var(--text); transition:.2s; }
.inpwrap>input:focus{ outline:none; border-color:rgba(216,255,62,.55); box-shadow:0 0 0 3px rgba(216,255,62,.12); }
.inpwrap>input:disabled{ opacity:.4; cursor:not-allowed; }
.fld>label{ display:block; font-size:12px; font-weight:600; color:var(--muted); margin-bottom:6px; }
.fgrid{ display:grid; grid-template-columns:1fr; gap:12px; }
@media(min-width:560px){ .fgrid{ grid-template-columns:1fr 1fr; } }

/* toggle */
.tgl{ position:relative; display:inline-block; width:42px; height:24px; flex:none; }
.tgl input{ position:absolute; opacity:0; inset:0; cursor:pointer; z-index:2; }
.tgl span{ position:absolute; inset:0; background:var(--surface-3); border:1px solid var(--border-2); border-radius:99px; transition:.25s; }
.tgl span::after{ content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; background:#7C828D; border-radius:50%; transition:.25s cubic-bezier(.4,0,.2,1); }
.tgl input:checked + span{ background:var(--volt); border-color:var(--volt); }
.tgl input:checked + span::after{ transform:translateX(18px); background:#0B0D05; }

/* range */
input[type=range]{ -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:99px; background:linear-gradient(90deg, var(--volt) 0 var(--p,30%), var(--surface-3) var(--p,30%)); outline:none; cursor:pointer; }
input[type=range]::-webkit-slider-thumb{ -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:var(--volt); border:3px solid #0E1015; box-shadow:0 0 0 1px var(--volt), 0 4px 14px rgba(216,255,62,.55); cursor:pointer; }
input[type=range]::-moz-range-thumb{ width:12px; height:12px; border-radius:50%; background:var(--volt); border:3px solid #0E1015; box-shadow:0 0 0 1px var(--volt); cursor:pointer; }

/* sidebar */
.nav-item{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:11px; font-size:13.5px; font-weight:500; color:var(--muted); cursor:pointer; transition:.2s; border:1px solid transparent; }
.nav-item:hover{ color:var(--text); background:var(--surface-2); }
.nav-item.active{ color:var(--volt); background:var(--volt-dim); border-color:rgba(216,255,62,.22); }
.nav-item svg{ width:18px; height:18px; }
.nav-count{ margin-left:auto; font-size:11px; font-weight:700; background:var(--surface-3); border:1px solid var(--border); color:var(--muted); padding:2px 8px; border-radius:99px; }
.ai-tag{ margin-left:auto; font-size:10px; font-weight:800; letter-spacing:.08em; background:var(--volt); color:#0B0D05; padding:2px 7px; border-radius:6px; }
.logo-mark{ width:38px; height:38px; border-radius:12px; background:linear-gradient(135deg, var(--volt), #8CE63B); display:grid; place-items:center; color:#0B0D05; box-shadow:0 8px 22px -6px rgba(216,255,62,.55); flex:none; }
[data-integration][hidden]{ display:none !important; }
.plan-card{ background:linear-gradient(150deg, rgba(216,255,62,.1), rgba(120,80,255,.07)); border:1px solid rgba(216,255,62,.2); border-radius:14px; padding:14px; }
.plan-bar{ height:6px; border-radius:99px; background:var(--surface-3); margin-top:10px; overflow:hidden; }
.plan-bar i{ display:block; height:100%; background:var(--volt); border-radius:99px; }
.trend-card{ background:var(--surface-2); border:1px solid var(--border); border-radius:14px; padding:12px 14px; }

/* kpi */
.kpi-label{ font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.kpi-value{ font-size:clamp(22px,2vw,27px); font-weight:700; letter-spacing:-.02em; margin-top:6px; font-variant-numeric:tabular-nums; }
.kpi-sub{ font-size:12px; color:var(--muted); margin-top:3px; }
.kpi-ic{ width:40px; height:40px; border-radius:12px; display:grid; place-items:center; flex:none; }
.kpi-ic svg{ width:19px; height:19px; }
.ic-volt{ background:var(--volt-dim); color:var(--volt); border:1px solid rgba(216,255,62,.25); }
.ic-em{ background:rgba(61,220,151,.1); color:var(--emerald); border:1px solid rgba(61,220,151,.25); }
.ic-ro{ background:rgba(255,93,115,.1); color:var(--rose); border:1px solid rgba(255,93,115,.25); }
.ic-am{ background:rgba(255,178,36,.1); color:var(--amber); border:1px solid rgba(255,178,36,.25); }
.delta{ display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; padding:4px 9px; border-radius:8px; }
.delta svg{ width:13px; height:13px; }
.delta.up{ background:rgba(61,220,151,.12); color:#7CE9BF; }
.delta.warn{ background:rgba(255,178,36,.12); color:#FFC966; }
.delta span{ font-weight:500; color:var(--faint); }
.kpi-bar{ position:relative; height:6px; border-radius:99px; background:var(--surface-3); overflow:visible; }
.kpi-bar i{ display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,#8CE63B,var(--volt)); transition:width .8s cubic-bezier(.2,.8,.2,1); }
.kpi-bar .meta-tick{ position:absolute; top:-4px; bottom:-4px; width:2px; background:var(--text); opacity:.5; border-radius:2px; }

.insight{ position:relative; overflow:hidden; background:linear-gradient(115deg, rgba(216,255,62,.08), rgba(130,90,255,.06) 55%, transparent), var(--surface); border:1px solid rgba(216,255,62,.22); }
.ai-orb{ width:40px; height:40px; border-radius:12px; background:var(--volt-dim); border:1px solid rgba(216,255,62,.35); color:var(--volt); display:grid; place-items:center; flex:none; }
.ai-orb svg{ width:20px; height:20px; }

/* table */
.tbl th{ font-size:10.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--faint); font-weight:700; padding:12px 14px; text-align:left; border-bottom:1px solid var(--border); white-space:nowrap; }
.tbl th.sortable{ cursor:pointer; user-select:none; }
.tbl th.sortable:hover{ color:var(--text); }
.tbl td{ padding:14px; border-bottom:1px solid rgba(255,255,255,.045); font-size:13.5px; vertical-align:middle; }
.tbl tbody tr{ transition:background .15s; cursor:pointer; }
.tbl tbody tr:hover{ background:rgba(255,255,255,.025); }
.tbl tbody tr:last-child td{ border-bottom:none; }
.s-arr{ font-size:10px; margin-left:5px; color:var(--volt); }
.s-arr.off{ color:var(--faint); }
.p-avatar{ width:40px; height:40px; border-radius:12px; display:grid; place-items:center; font-weight:700; font-size:15px; font-family:var(--font-display); flex:none; }
.type-badge{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; padding:4px 10px; border-radius:8px; white-space:nowrap; }
.type-buy{ background:rgba(94,224,255,.1); color:#9BEAFF; border:1px solid rgba(94,224,255,.22); }
.type-prod{ background:rgba(167,139,250,.1); color:#C9B8FA; border:1px solid rgba(167,139,250,.25); }
.mp-chip{ display:inline-flex; align-items:center; gap:6px; background:var(--surface-2); border:1px solid var(--border); padding:4px 9px; border-radius:8px; font-size:11px; font-weight:600; color:var(--muted); white-space:nowrap; }
.mp-chip i{ width:6px; height:6px; border-radius:50%; display:inline-block; }
.mp-chip b{ color:var(--text); font-family:var(--font-mono); font-weight:600; font-size:11px; }
.mbar{ width:64px; height:6px; border-radius:99px; background:var(--surface-3); overflow:hidden; flex:none; }
.mbar i{ display:block; height:100%; border-radius:99px; }
.pill{ display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; padding:5px 10px; border-radius:99px; white-space:nowrap; }
.pill .dot{ width:6px; height:6px; border-radius:50%; background:currentColor; }
.st-ok{ background:rgba(61,220,151,.1); color:#7CE9BF; }
.st-amber{ background:rgba(255,178,36,.1); color:#FFC966; }
.st-rose{ background:rgba(255,93,115,.1); color:#FF8CA0; }
.st-muted{ background:var(--surface-3); color:var(--muted); }
.row-ai{ width:32px; height:32px; border-radius:9px; display:grid; place-items:center; background:var(--surface-2); border:1px solid var(--border); color:var(--muted); transition:.2s; }
.row-ai:hover{ color:var(--volt); border-color:rgba(216,255,62,.4); background:var(--volt-dim); }
.row-ai svg{ width:15px; height:15px; }

/* drawer */
.dov{ position:fixed; inset:0; z-index:55; background:rgba(4,5,7,.62); backdrop-filter:blur(4px); opacity:0; visibility:hidden; transition:.35s; }
.dov.open{ opacity:1; visibility:visible; }
#drawer{ position:fixed; top:0; right:0; height:100dvh; width:min(540px,100vw); background:var(--surface); border-left:1px solid var(--border-2); transform:translateX(103%); transition:transform .45s cubic-bezier(.32,.72,0,1); z-index:60; display:flex; flex-direction:column; box-shadow:-30px 0 80px rgba(0,0,0,.55); }
#drawer.open{ transform:none; }
.seg{ display:inline-flex; max-width:100%; overflow-x:auto; scrollbar-width:none; background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:4px; gap:4px; }
.seg::-webkit-scrollbar{ display:none; }
/* No celular, uma tabela que só mostra uma mensagem (vazia, carregando, erro) cabe na tela, sem rolagem lateral. */
@media (max-width:767px){
  .tbl:has(> tbody > tr > td[colspan]){ min-width:0 !important; }
  .tbl:has(> tbody > tr > td[colspan]) > thead{ display:none; }
}
/* Indicadores da Visão geral no celular: sem o ícone decorativo, que tomava metade da largura do cartão. */
@media (max-width:639px){
  #kpiGrid{ gap:12px; }
  #kpiGrid > .card{ padding:14px; }
  #kpiGrid .kpi-ic{ display:none; }
  #kpiGrid .kpi-value{ font-size:21px; }
  #kpiGrid .kpi-label{ font-size:10px; }
}
.seg button{ flex:none; display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:9px; font-size:12.5px; font-weight:600; color:var(--muted); cursor:pointer; transition:.2s; border:none; background:transparent; }
.seg button svg{ width:15px; height:15px; }
.seg button.on{ background:var(--volt); color:#0B0D05; box-shadow:0 4px 14px -4px rgba(216,255,62,.5); }
.mp-row{ background:var(--surface-2); border:1px solid var(--border); border-radius:14px; padding:14px; transition:.2s; }
.mp-row.on{ border-color:var(--border-2); }
.mp-logo{ width:36px; height:36px; border-radius:10px; display:grid; place-items:center; font-weight:800; font-family:var(--font-display); font-size:15px; flex:none; color:var(--c); background:color-mix(in srgb, var(--c) 16%, transparent); border:1px solid color-mix(in srgb, var(--c) 35%, transparent); }
.mp-body.off{ opacity:.45; filter:saturate(.4); }
.mp-stat{ background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px 10px; }
.mp-stat .l{ font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--faint); font-weight:700; }
.mp-stat .v{ font-size:13px; font-weight:700; margin-top:2px; font-variant-numeric:tabular-nums; }
.cost-panel{ background:linear-gradient(160deg, rgba(216,255,62,.09), rgba(216,255,62,.02) 60%), var(--surface-2); border:1px solid rgba(216,255,62,.25); border-radius:14px; padding:14px 16px; }
.cp-row{ display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--muted); padding:4px 0; }
.cp-row span:last-child{ font-family:var(--font-mono); font-size:12.5px; color:var(--text); }
.cp-total{ display:flex; justify-content:space-between; align-items:center; border-top:1px dashed rgba(255,255,255,.15); margin-top:8px; padding-top:10px; font-weight:700; font-size:13.5px; }
.cp-total span:last-child{ font-family:var(--font-display); font-size:22px; color:var(--volt); letter-spacing:-.01em; }
.drawer-strip{ display:flex; flex-wrap:wrap; gap:6px 14px; background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:10px 14px; font-size:12px; color:var(--muted); }
.drawer-strip b{ color:var(--text); font-family:var(--font-mono); font-weight:600; }
.ai-cta{ width:100%; display:flex; align-items:center; gap:12px; padding:16px; border:1.5px dashed rgba(216,255,62,.4); background:rgba(216,255,62,.04); border-radius:14px; cursor:pointer; transition:.25s; text-align:left; color:var(--text); }
.ai-cta:hover{ background:rgba(216,255,62,.09); border-color:rgba(216,255,62,.7); }
.ai-mini{ background:var(--surface-2); border:1px solid rgba(216,255,62,.25); border-radius:14px; padding:14px; }
.target-box{ background:var(--surface-2); border:1px solid var(--border); border-radius:14px; padding:14px 16px; }
.section-title{ font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:var(--faint); display:flex; align-items:center; gap:8px; }
.section-title .ai-tag{ margin-left:2px; }
.link-btn{ font-size:12px; color:var(--volt); font-weight:600; cursor:pointer; background:none; border:none; }
.link-btn:hover{ text-decoration:underline; }

/* modal */
.modal{ position:fixed; inset:0; z-index:80; display:flex; align-items:center; justify-content:center; padding:14px; visibility:hidden; }
.modal .modal-ov{ position:absolute; inset:0; background:rgba(4,5,7,.72); backdrop-filter:blur(7px); opacity:0; transition:.3s; }
.modal-panel{ position:relative; background:var(--surface); border:1px solid var(--border-2); border-radius:20px; width:100%; max-height:92dvh; overflow-y:auto; padding:22px; transform:translateY(16px) scale(.97); opacity:0; transition:.38s cubic-bezier(.2,.8,.2,1); box-shadow:0 40px 100px rgba(0,0,0,.65); }
.modal.open{ visibility:visible; }
.modal.open .modal-ov{ opacity:1; }
.modal.open .modal-panel{ transform:none; opacity:1; }
.chips{ display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.chip{ font-size:12px; font-weight:500; background:var(--surface-2); border:1px solid var(--border); color:var(--muted); padding:6px 12px; border-radius:99px; cursor:pointer; transition:.2s; }
.chip:hover{ color:var(--volt); border-color:rgba(216,255,62,.4); }
.ai-note{ font-size:11.5px; color:var(--faint); text-align:center; margin-top:14px; line-height:1.5; }
.step{ display:flex; align-items:center; gap:11px; font-size:13px; color:var(--muted); padding:7px 0; opacity:0; transform:translateY(8px); transition:.35s; }
.step.show{ opacity:1; transform:none; }
.step.done{ color:var(--text); }
.st-ic{ width:22px; height:22px; border:1px solid var(--border-2); border-radius:50%; display:grid; place-items:center; background:var(--surface-2); flex:none; }
.step.done .st-ic{ background:var(--volt-dim); border-color:rgba(216,255,62,.5); color:var(--volt); }
.spin{ width:11px; height:11px; border-radius:50%; border:2px solid rgba(255,255,255,.15); border-top-color:var(--volt); animation:sp .9s linear infinite; }
@keyframes sp{ to{ transform:rotate(360deg);} }
.skel{ position:relative; overflow:hidden; background:var(--surface-2); border-radius:12px; border:1px solid var(--border); }
.skel::after{ content:''; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.05), transparent); animation:sh 1.3s infinite; transform:translateX(-100%); }
@keyframes sh{ to{ transform:translateX(100%); } }
.stat-strip{ display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
@media(min-width:640px){ .stat-strip{ grid-template-columns:repeat(4,1fr); } }
.stat-cell{ background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:10px 12px; }
.stat-cell .l{ font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--faint); font-weight:700; }
.stat-cell .v{ font-family:var(--font-display); font-weight:700; font-size:17px; margin-top:3px; font-variant-numeric:tabular-nums; }
.comp-card{ background:var(--surface-2); border:1px solid var(--border); border-radius:14px; padding:13px 14px; animation:cardIn .5s cubic-bezier(.2,.8,.2,1) both; transition:.2s; }
.comp-card:hover{ border-color:var(--border-2); transform:translateY(-2px); }
@keyframes cardIn{ from{ opacity:0; transform:translateY(12px);} to{ opacity:1; transform:none;} }
.comp-av{ width:32px; height:32px; border-radius:10px; display:grid; place-items:center; font-weight:800; font-size:14px; font-family:var(--font-display); flex:none; color:hsl(var(--h),85%,72%); background:hsl(var(--h),60%,45%,.18); border:1px solid hsl(var(--h),60%,55%,.35); }
.tag{ display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:700; padding:4px 8px; border-radius:7px; }
.tag svg{ width:11px; height:11px; }
.tag-em{ background:rgba(61,220,151,.12); color:#7CE9BF; }
.tag-am{ background:rgba(255,178,36,.12); color:#FFC966; }
.tag-ro{ background:rgba(255,93,115,.12); color:#FF8CA0; }
.tag-bl{ background:rgba(94,224,255,.12); color:#9BEAFF; }
.dist{ margin-top:18px; }
.dist-track{ position:relative; height:10px; border-radius:99px; background:linear-gradient(90deg, rgba(94,224,255,.7), rgba(216,255,62,.85) 55%, rgba(255,178,36,.8)); }
.dist-band{ position:absolute; top:-4px; bottom:-4px; border-radius:99px; background:rgba(216,255,62,.16); border:1px dashed rgba(216,255,62,.55); }
.dist-tick{ position:absolute; top:-3px; width:2px; height:16px; background:rgba(255,255,255,.75); border-radius:2px; transform:translateX(-1px); }
.dist-lab{ position:absolute; top:16px; transform:translateX(-50%); font-size:10px; color:var(--faint); white-space:nowrap; font-weight:600; }
.dist-you{ position:absolute; top:-30px; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; }
.dist-you .flag{ background:var(--volt); color:#0B0D05; font-size:9.5px; font-weight:800; letter-spacing:.04em; padding:3px 7px; border-radius:6px 6px 6px 2px; white-space:nowrap; }
.dist-you .stem{ width:2px; height:14px; background:var(--volt); }
.dist-you .tip{ width:8px; height:8px; background:var(--volt); border-radius:50%; margin-top:-2px; box-shadow:0 0 0 3px rgba(216,255,62,.25); }
.rec-box{ background:linear-gradient(150deg, rgba(216,255,62,.12), rgba(216,255,62,.03)); border:1px solid rgba(216,255,62,.35); border-radius:16px; padding:16px; }
.fee-row{ display:flex; align-items:center; gap:12px; padding:13px 0; border-bottom:1px solid rgba(255,255,255,.05); }
.fee-row:last-child{ border-bottom:none; }
.bell-panel{ position:absolute; right:0; top:calc(100% + 10px); width:min(360px, calc(100vw - 24px)); background:var(--surface); border:1px solid var(--border-2); border-radius:16px; box-shadow:0 30px 70px rgba(0,0,0,.6); z-index:40; overflow:hidden; animation:cardIn .25s cubic-bezier(.2,.8,.2,1); }
.bell-item{ display:flex; gap:10px; width:100%; text-align:left; padding:11px 14px; font-size:12.5px; color:var(--text); border-bottom:1px solid rgba(255,255,255,.05); background:none; cursor:pointer; transition:.15s; line-height:1.4; }
.bell-item:hover{ background:var(--surface-2); }
.bell-item:last-child{ border-bottom:none; }
.bell-dot{ width:8px; height:8px; border-radius:50%; margin-top:5px; flex:none; }
.avatar-user{ width:38px; height:38px; border-radius:11px; background:linear-gradient(135deg,#8B5CF6,#D8FF3E); display:grid; place-items:center; font-weight:800; font-size:13px; color:#0B0D05; cursor:pointer; flex:none; }
.count-pill{ font-size:11.5px; font-weight:700; background:var(--surface-3); border:1px solid var(--border); color:var(--muted); padding:3px 10px; border-radius:99px; }

#toasts{ position:fixed; bottom:22px; left:50%; transform:translateX(-50%); z-index:120; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; width:max-content; max-width:calc(100vw - 24px); }
.toast{ display:flex; align-items:center; gap:10px; background:#14181F; border:1px solid var(--border-2); color:var(--text); padding:11px 16px; border-radius:12px; font-size:13px; font-weight:500; box-shadow:0 18px 44px rgba(0,0,0,.55); animation:toastIn .35s cubic-bezier(.2,.8,.2,1); max-width:calc(100vw - 24px); }
.toast .t-ic{ color:var(--volt); flex:none; display:grid; place-items:center; }
.toast .t-ic svg{ width:17px; height:17px; }
.toast.rose .t-ic{ color:var(--rose); }
.toast.out{ animation:toastOut .3s forwards; }
@keyframes toastIn{ from{ opacity:0; transform:translateY(14px) scale(.95);} to{ opacity:1; transform:none;} }
@keyframes toastOut{ to{ opacity:0; transform:translateY(10px) scale(.96);} }

/* ---------- Radar & análise de anúncio ---------- */
.star-btn{ color:var(--faint); background:none; border:none; cursor:pointer; padding:4px; border-radius:8px; }
.star-btn:hover{ color:var(--amber); }
.star-btn.on{ color:var(--amber); }
.star-btn svg{ width:17px; height:17px; }
.est{ display:inline-flex; align-items:center; font-size:9.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; padding:2px 7px; border-radius:6px; background:rgba(255,178,36,.12); color:#FFC966; vertical-align:middle; }
.opp-card{ border-radius:16px; padding:18px; border:1px solid var(--border); }
.opp-otimista{ background:linear-gradient(150deg, rgba(61,220,151,.14), rgba(61,220,151,.02)); border-color:rgba(61,220,151,.35); }
.opp-moderado{ background:linear-gradient(150deg, rgba(255,178,36,.14), rgba(255,178,36,.02)); border-color:rgba(255,178,36,.35); }
.opp-arriscado{ background:linear-gradient(150deg, rgba(255,93,115,.14), rgba(255,93,115,.02)); border-color:rgba(255,93,115,.35); }
.kv{ display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.045); font-size:13px; }
.kv:last-child{ border-bottom:none; }
.kv > span:first-child{ color:var(--muted); }
.kv > b{ text-align:right; font-variant-numeric:tabular-nums; }
.check{ display:flex; gap:10px; align-items:flex-start; padding:7px 0; font-size:12.5px; }
.check i{ width:18px; height:18px; border-radius:50%; flex:none; display:grid; place-items:center; font-style:normal; font-size:11px; font-weight:800; margin-top:1px; }
.check.ok i{ background:rgba(61,220,151,.15); color:#7CE9BF; }
.check.bad i{ background:rgba(255,93,115,.15); color:#FF8CA0; }
.prio{ font-size:10px; font-weight:800; padding:3px 8px; border-radius:6px; white-space:nowrap; }
.prio-1{ background:rgba(255,93,115,.14); color:#FF8CA0; }
.prio-2{ background:rgba(255,178,36,.14); color:#FFC966; }
.prio-3{ background:rgba(94,224,255,.12); color:#9BEAFF; }
.radar-tbl tbody tr{ cursor:default; }

@media (prefers-reduced-motion: reduce){ *{ animation-duration:.01ms !important; transition-duration:.01ms !important; } }
</style>
</head>
<body class="font-body">

<div id="bgfx"></div>
<div class="noise"></div>

<!-- ============ SIDEBAR ============ -->
<div id="sideOverlay" class="fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm lg:hidden" hidden></div>
<aside id="sidebar" class="fixed top-0 left-0 z-[50] h-dvh w-[252px] -translate-x-full lg:translate-x-0 transition-transform duration-300 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col">
  <div class="flex items-center gap-3 px-5 pt-6 pb-5">
    <div class="logo-mark"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 2L4.5 14H11l-1 8L18.5 10H12l1-8z"/></svg></div>
    <div>
      <div class="font-display font-bold text-[17px] tracking-tight leading-none">Margem<span style="color:var(--volt)">IQ</span></div>
      <div class="text-[9.5px] uppercase tracking-[.18em] text-[var(--faint)] mt-1">Reselling OS</div>
    </div>
  </div>

  <div class="px-4 pb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--faint)]">Menu</div>
  <nav class="space-y-1 px-3" id="mainNav">
    <a class="nav-item" data-nav="compra"><span data-ic="scan" data-icc="w-[18px] h-[18px]"></span>Vale a pena comprar?</a>
    <a class="nav-item active" data-nav="home"><span data-ic="grid" data-icc="w-[18px] h-[18px]"></span>Visão geral</a>
    <a class="nav-item" data-nav="products"><span data-ic="box" data-icc="w-[18px] h-[18px]"></span>Produtos<span class="nav-count" id="navCount">0</span></a>
    <a class="nav-item" data-nav="suppliers"><span data-ic="layers" data-icc="w-[18px] h-[18px]"></span>Fornecedores<span class="nav-count" id="supplierNavCount">64</span></a>
    <a class="nav-item" data-nav="listings"><span data-ic="tag" data-icc="w-[18px] h-[18px]"></span>Anúncios Mercado Livre</a>
    <a class="nav-item" data-nav="vendas"><span data-ic="wallet" data-icc="w-[18px] h-[18px]"></span>Minhas vendas</a>
    <a class="nav-item" data-nav="shopee" data-integration="shopee" hidden><span data-ic="tag" data-icc="w-[18px] h-[18px]"></span>Anúncios Shopee</a>
    <a class="nav-item" data-nav="tiktok" data-integration="tiktok" hidden><span data-ic="tag" data-icc="w-[18px] h-[18px]"></span>Produtos TikTok Shop</a>
    <a class="nav-item" data-nav="radar"><span data-ic="trendUp" data-icc="w-[18px] h-[18px]"></span>Radar de oportunidades</a>
    <a class="nav-item" data-nav="analysis"><span data-ic="target" data-icc="w-[18px] h-[18px]"></span>Análise de anúncio</a>
    <a class="nav-item" data-nav="ai"><span data-ic="sparkles" data-icc="w-[18px] h-[18px]"></span>Analisar concorrência<span class="ai-tag">IA</span></a>
    <a class="nav-item" data-nav="reports"><span data-ic="chart" data-icc="w-[18px] h-[18px]"></span>Relatórios</a>
    <a class="nav-item" data-nav="fees"><span data-ic="settings" data-icc="w-[18px] h-[18px]"></span>Marketplaces &amp; Taxas</a>
  </nav>

  <div class="mt-auto p-4">
    <div class="plan-card">
      <div class="text-[12.5px] font-bold">Mercado Livre</div>
      <div class="text-[11px] text-[var(--muted)] mt-1">Conecte sua conta para sincronizar anúncios e pesquisar concorrentes.</div>
      <a href="/conectar/mercadolivre" class="btn btn-primary w-full h-8 text-[12px] mt-3.5">Conectar conta</a>
      <a href="/conectar/shopee" class="btn btn-ghost w-full h-8 text-[12px] mt-2" data-integration="shopee" hidden>Conectar Shopee</a>
      <a href="/conectar/tiktok" class="btn btn-ghost w-full h-8 text-[12px] mt-2" data-integration="tiktok" hidden>Conectar TikTok Shop</a>
    </div>
  </div>
</aside>

<!-- ============ MAIN ============ -->
<main class="lg:pl-[252px] min-h-dvh">

  <header class="sticky top-0 z-30 border-b border-[var(--border)]" style="background:rgba(7,8,11,.82); backdrop-filter:blur(14px);">
    <div class="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 max-w-[1440px] mx-auto">
      <button class="icon-btn lg:hidden" id="btnMenu" aria-label="Abrir menu"><span data-ic="menu" data-icc="w-5 h-5"></span></button>
      <div class="min-w-0 flex-1 md:flex-none mr-1">
        <div class="hidden md:block text-[10.5px] uppercase tracking-[.14em] text-[var(--faint)] font-bold" id="pageKicker">Dashboard</div>
        <div class="text-[13.5px] font-display font-semibold leading-tight truncate" id="pageTitle">Visão geral da loja</div>
      </div>
      <div class="relative order-last w-full sm:order-none sm:w-80" id="headerSearch">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" data-ic="search" data-icc="w-4 h-4"></span>
        <input id="globalSearch" class="inp !pl-9 !bg-[var(--surface-2)]" placeholder="Buscar produto, SKU ou categoria…" autocomplete="off">
      </div>
      <div class="md:ml-auto flex items-center gap-2 flex-none">
        <span class="hidden lg:inline-flex items-center text-[12px] text-[var(--muted)] border border-[var(--border)] rounded-lg px-3 h-10 bg-[var(--surface-2)]" id="topDate"></span>
        <button class="btn-ghost btn !border-[rgba(216,255,62,.35)] !text-[var(--volt)] hover:!bg-[var(--volt-dim)] hidden md:inline-flex" id="btnAITop"><span data-ic="sparkles" data-icc="w-4 h-4"></span>Analisar concorrência</button>
        <div class="relative" id="bellWrap">
          <button class="icon-btn" id="bellBtn" aria-label="Alertas">
            <span data-ic="bell" data-icc="w-[18px] h-[18px]"></span>
            <span id="bellCount" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center" style="background:var(--rose); color:#fff;">3</span>
          </button>
          <div id="bellPanel" class="bell-panel" hidden>
            <div class="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span class="text-[13px] font-bold">Alertas de preço</span>
              <span class="count-pill" id="bellCount2"></span>
            </div>
            <div id="bellList" class="max-h-[320px] overflow-y-auto"></div>
          </div>
        </div>
        <button class="btn-ghost btn !px-3 sm:!px-4" id="btnFees" aria-label="Taxas"><span data-ic="percent" data-icc="w-4 h-4"></span><span class="hidden sm:inline">Taxas</span></button>
        <button class="btn btn-primary !px-3 sm:!px-4" id="btnNew" aria-label="Novo produto"><span data-ic="plus" data-icc="w-4 h-4"></span><span class="hidden sm:inline">Novo produto</span></button>
        <div class="avatar-user hidden sm:grid" title="Cliente Pro">CV</div>
      </div>
    </div>
  </header>

  <div class="max-w-[1440px] mx-auto px-4 sm:px-6 pb-24 pt-6 space-y-5" id="viewDashboard">

    <!-- AI INSIGHTS -->
    <div class="card insight p-4 sm:p-5 flex flex-wrap items-center gap-4">
      <div class="ai-orb"><span data-ic="sparkles" data-icc="w-5 h-5"></span></div>
      <div class="flex-1 min-w-[240px]">
        <div class="text-[10.5px] uppercase tracking-[.16em] font-bold" style="color:var(--volt)">Inteligência · Preço &amp; Concorrência</div>
        <div id="insightText" class="text-[13px] leading-relaxed text-[var(--muted)] mt-1.5"></div>
      </div>
      <button class="btn btn-primary sm" id="btnInsightAI"><span data-ic="target" data-icc="w-4 h-4"></span>Analisar agora</button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4" id="kpiGrid"></div>

    <!-- CHARTS -->
    <section class="grid grid-cols-1 xl:grid-cols-3 gap-4" id="chartsSec">
      <div class="card p-5 xl:col-span-2">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div>
            <h2 class="font-display font-semibold text-[15.5px]">Receita x custo por produto</h2>
            <p class="text-[12px] text-[var(--muted)] mt-0.5">Se todo o estoque atual for vendido pelos preços cadastrados</p>
          </div>
          <div class="ml-auto flex items-center gap-4 text-[11.5px] text-[var(--muted)]">
            <span class="flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-full inline-block" style="background:var(--volt)"></i>Receita potencial</span>
            <span class="flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-full inline-block" style="background:#4A5160"></i>Custo do estoque</span>
          </div>
        </div>
        <div class="h-[290px] relative"><canvas id="areaChart"></canvas></div>
      </div>
      <div class="card p-5">
        <h2 class="font-display font-semibold text-[15.5px]">Lucro por marketplace</h2>
        <p class="text-[12px] text-[var(--muted)] mt-0.5">Estimativa de lucro sobre o estoque completo</p>
        <div class="relative h-[190px] mt-3">
          <canvas id="donutChart"></canvas>
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div class="font-display font-bold text-[24px] tracking-tight" id="donutTotal" style="color:var(--volt)">—</div>
            <div class="text-[10.5px] uppercase tracking-[.12em] text-[var(--faint)] font-bold mt-0.5">lucro potencial</div>
          </div>
        </div>
        <ul id="donutLegend" class="mt-4 space-y-2"></ul>
      </div>
    </section>

    <!-- MERCADO LIVRE LISTINGS -->
    <section class="card" id="mlListingsSec">
      <div class="flex flex-wrap items-center gap-3 p-5 border-b border-[var(--border)]">
        <div>
          <h2 class="font-display font-semibold text-[15.5px]">Meus anúncios no Mercado Livre</h2>
          <p class="text-[12px] text-[var(--muted)] mt-0.5" id="mlSellerText">Sincronize a conta para gerenciar anúncios e promoções em lote.</p>
        </div>
        <span class="count-pill" id="mlListingCount">0 anúncios</span>
        <div class="ml-auto flex flex-wrap gap-2">
          <button class="btn btn-ghost sm" id="btnMlSync"><span data-ic="refresh" data-icc="w-4 h-4"></span>Sincronizar</button>
          <button class="btn btn-primary sm" id="btnBulkPromo" disabled><span data-ic="percent" data-icc="w-4 h-4"></span>Criar promoção <span id="mlSelectedCount">(0)</span></button>
        </div>
      </div>
      <div class="p-4 border-b border-[var(--border)] flex flex-wrap gap-3 items-center">
        <div class="relative flex-1 min-w-[230px] max-w-md">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" data-ic="search" data-icc="w-4 h-4"></span>
          <input id="mlListingSearch" class="inp !pl-9" placeholder="Buscar por título, SKU ou MLB…" autocomplete="off">
        </div>
        <span class="text-[11.5px] text-[var(--muted)]">Selecione até 50 anúncios por operação</span>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl w-full min-w-[920px]">
          <thead><tr>
            <th class="!w-12"><input type="checkbox" id="mlSelectAll" aria-label="Selecionar todos"></th>
            <th>Anúncio</th><th>Preço</th><th>Estoque</th><th>Vendas</th><th>Tipo</th><th>Status</th>
          </tr></thead>
          <tbody id="mlListingsBody"><tr><td colspan="7" class="!text-center !py-12 text-[var(--muted)]">Clique em “Sincronizar” para carregar os anúncios reais da conta.</td></tr></tbody>
        </table>
      </div>
    </section>

    <!-- SHOPEE LISTINGS -->
    <section class="card" id="shopeeListingsSec" data-integration="shopee" hidden>
      <div class="flex flex-wrap items-center gap-3 p-5 border-b border-[var(--border)]">
        <div>
          <h2 class="font-display font-semibold text-[15.5px]">Meus anúncios na Shopee</h2>
          <p class="text-[12px] text-[var(--muted)] mt-0.5" id="shopeeShopText">Conecte a loja para ver preços, estoque e vendas dos anúncios ativos.</p>
        </div>
        <span class="count-pill" id="shopeeListingCount">0 anúncios</span>
        <div class="ml-auto flex flex-wrap gap-2">
          <a href="/conectar/shopee" class="btn btn-ghost sm">Conectar Shopee</a>
          <button class="btn btn-ghost sm" id="btnShopeeSync"><span data-ic="refresh" data-icc="w-4 h-4"></span>Sincronizar</button>
        </div>
      </div>
      <div class="p-4 border-b border-[var(--border)] flex flex-wrap gap-3 items-center">
        <div class="relative flex-1 min-w-[230px] max-w-md">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" data-ic="search" data-icc="w-4 h-4"></span>
          <input id="shopeeListingSearch" class="inp !pl-9" placeholder="Buscar por título, SKU ou ID…" autocomplete="off">
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl w-full min-w-[820px]">
          <thead><tr><th>Anúncio</th><th>Preço</th><th>Estoque</th><th>Vendas</th><th>Status</th></tr></thead>
          <tbody id="shopeeListingsBody"><tr><td colspan="5" class="!text-center !py-12 text-[var(--muted)]">Clique em “Sincronizar” para carregar os anúncios reais da loja.</td></tr></tbody>
        </table>
      </div>
    </section>

    <!-- TIKTOK SHOP LISTINGS -->
    <section class="card" id="tiktokListingsSec" data-integration="tiktok" hidden>
      <div class="flex flex-wrap items-center gap-3 p-5 border-b border-[var(--border)]">
        <div>
          <h2 class="font-display font-semibold text-[15.5px]">Meus produtos no TikTok Shop</h2>
          <p class="text-[12px] text-[var(--muted)] mt-0.5" id="tiktokShopText">Conecte a loja para ver preços e estoque dos produtos ativos.</p>
        </div>
        <span class="count-pill" id="tiktokListingCount">0 anúncios</span>
        <div class="ml-auto flex flex-wrap gap-2">
          <a href="/conectar/tiktok" class="btn btn-ghost sm">Conectar TikTok Shop</a>
          <button class="btn btn-ghost sm" id="btnTiktokSync"><span data-ic="refresh" data-icc="w-4 h-4"></span>Sincronizar</button>
        </div>
      </div>
      <div class="p-4 border-b border-[var(--border)] flex flex-wrap gap-3 items-center">
        <div class="relative flex-1 min-w-[230px] max-w-md">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" data-ic="search" data-icc="w-4 h-4"></span>
          <input id="tiktokListingSearch" class="inp !pl-9" placeholder="Buscar por título, SKU ou ID…" autocomplete="off">
        </div>
        <span class="text-[11.5px] text-[var(--muted)]">A API do TikTok Shop não informa vendas por produto nesta consulta</span>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl w-full min-w-[720px]">
          <thead><tr><th>Produto</th><th>Preço</th><th>Estoque</th><th>Status</th></tr></thead>
          <tbody id="tiktokListingsBody"><tr><td colspan="4" class="!text-center !py-12 text-[var(--muted)]">Clique em “Sincronizar” para carregar os produtos reais da loja.</td></tr></tbody>
        </table>
      </div>
    </section>

    <!-- PRODUCTS TABLE -->
    <section class="card" id="productsSec">
      <div class="flex flex-wrap items-center gap-3 p-5 border-b border-[var(--border)]">
        <h2 class="font-display font-semibold text-[15.5px]">Produtos</h2>
        <span class="count-pill" id="prodCount">0 produtos</span>
        <div class="w-full sm:w-auto sm:ml-auto flex flex-wrap gap-2">
          <button class="btn btn-ghost sm" id="btnImportMl"><span data-ic="refresh" data-icc="w-4 h-4"></span>Importar do Mercado Livre</button>
          <button class="btn btn-ghost sm" id="btnExport"><span data-ic="download" data-icc="w-4 h-4"></span>Exportar CSV</button>
          <button class="btn btn-primary sm" id="btnNew2"><span data-ic="plus" data-icc="w-4 h-4"></span>Adicionar</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl w-full min-w-[880px]">
          <thead id="tHead"></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </section>

    <p class="text-center text-[11.5px] text-[var(--faint)] pt-2">MargemIQ · Custos informados por você e salvos neste navegador · Anúncios sincronizados pelas contas conectadas</p>
  </div>

  <!-- Radar de oportunidades e Análise de anúncio (renderizados por assets/strategy.js) -->
  <div class="max-w-[1440px] mx-auto px-4 sm:px-6 pb-24 pt-6 space-y-5" id="viewRadar" hidden></div>
  <div class="max-w-[1440px] mx-auto px-4 sm:px-6 pb-24 pt-6 space-y-5" id="viewAnalysis" hidden></div>
  <!-- Catálogo de fornecedores (renderizado por assets/suppliers.js) -->
  <div class="max-w-[1440px] mx-auto px-4 sm:px-6 pb-24 pt-6 space-y-5" id="viewSuppliers" hidden></div>
  <!-- Vale a pena comprar? (renderizada por assets/purchase.js) -->
  <div class="px-4 sm:px-6 pb-24 pt-6" id="viewPurchase" hidden></div>
  <!-- Minhas vendas (renderizada por assets/sales.js) -->
  <div class="px-4 sm:px-6 pb-24 pt-6" id="viewSales" hidden></div>
</main>

<!-- ============ DRAWER ============ -->
<div class="dov" id="drawerOverlay"></div>
<aside id="drawer" aria-label="Editor de produto">
  <div id="drawerContent" class="flex flex-col h-full min-h-0"></div>
</aside>

<!-- ============ FEES MODAL ============ -->
<div class="modal" id="feesModal" aria-hidden="true">
  <div class="modal-ov" data-fclose></div>
  <div class="modal-panel max-w-lg">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="font-display font-bold text-[17px]">Marketplaces &amp; taxas</h3>
        <p class="text-[12.5px] text-[var(--muted)] mt-1">Percentuais de comissão e taxas aplicados no cálculo de margens de cada produto.</p>
      </div>
      <button class="icon-btn" data-fclose><span data-ic="x" data-icc="w-4 h-4"></span></button>
    </div>
    <div id="feesList" class="mt-4"></div>
    <div class="flex flex-wrap items-center gap-2 mt-6">
      <button class="btn btn-danger-soft" id="btnResetDemo"><span data-ic="refresh" data-icc="w-4 h-4"></span>Carregar exemplos</button>
      <div class="ml-auto flex gap-2">
        <button class="btn btn-ghost" data-fclose>Cancelar</button>
        <button class="btn btn-primary" id="btnFeesSave">Salvar taxas</button>
      </div>
    </div>
  </div>
</div>

<!-- ============ AI MODAL ============ -->
<div class="modal" id="aiModal" aria-hidden="true">
  <div class="modal-ov" data-aclose></div>
  <div class="modal-panel max-w-3xl" id="aiPanel">
    <div class="flex items-start justify-between gap-3 pb-4 border-b border-[var(--border)]">
      <div class="flex items-center gap-3">
        <div class="ai-orb"><span data-ic="sparkles" data-icc="w-5 h-5"></span></div>
        <div>
          <h3 class="font-display font-bold text-[16.5px] leading-tight">Radar de Concorrência</h3>
          <p class="text-[12px] text-[var(--muted)] mt-0.5">Análise de mercado com inteligência artificial</p>
        </div>
      </div>
      <button class="icon-btn" data-aclose><span data-ic="x" data-icc="w-4 h-4"></span></button>
    </div>

    <div id="aiSearchView" class="pt-5">
      <label class="fld"><label class="block text-[12px] font-semibold text-[var(--muted)] mb-1.5">Produto ou palavra-chave</label>
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" data-ic="search" data-icc="w-4 h-4"></span>
        <input id="aiInput" class="inp !pl-9 !h-12" placeholder="Ex.: fone bluetooth tws ótimo custo-benefício" autocomplete="off">
      </div></label>
      <div class="chips" id="aiChips"></div>
      <button class="btn btn-primary w-full !h-12 mt-6 text-[14px]" id="aiRunBtn"><span data-ic="sparkles" data-icc="w-4.5 h-4.5"></span>Analisar concorrentes com IA</button>
      <p class="ai-note">A análise consulta produtos reais do catálogo e suas ofertas vencedoras no Mercado Livre, comparando preços com o custo e a margem-alvo. <a href="/conectar/mercadolivre" style="color:var(--volt);font-weight:700">Conectar conta</a></p>
    </div>

    <div id="aiLoadingView" class="pt-5" hidden>
      <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4" id="aiSteps"></div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4" id="aiSkel"></div>
    </div>

    <div id="aiResultsView" class="pt-5" hidden>
      <div id="aiResultBody"></div>
      <div class="ai-apply flex flex-col sm:flex-row gap-2 mt-5">
        <select id="aiProductSelect" class="inp flex-1"></select>
        <button class="btn btn-primary" id="aiApplyBtn"><span data-ic="check" data-icc="w-4 h-4"></span>Aplicar preço sugerido</button>
      </div>
      <button class="btn btn-ghost w-full mt-2" id="aiAgain"><span data-ic="refresh" data-icc="w-4 h-4"></span>Reanalisar outra busca</button>
    </div>
  </div>
</div>

<div class="modal" id="promoModal" aria-hidden="true">
  <div class="modal-ov" data-pclose></div>
  <div class="modal-panel max-w-2xl">
    <div class="flex items-start justify-between gap-3">
      <div><h3 class="font-display font-bold text-[17px]">Promoção em lote</h3><p class="text-[12px] text-[var(--muted)] mt-1" id="promoSelectionText"></p></div>
      <button class="icon-btn" data-pclose aria-label="Fechar"><span data-ic="x" data-icc="w-4 h-4"></span></button>
    </div>
    <div class="grid sm:grid-cols-3 gap-3 mt-5">
      <label class="field"><span>Desconto</span><div class="relative"><input id="promoDiscount" class="inp !pr-9" type="number" min="5" max="80" step="1" value="10"><b class="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--muted)]">%</b></div></label>
      <label class="field"><span>Início</span><input id="promoStart" class="inp" type="date"></label>
      <label class="field"><span>Término</span><input id="promoFinish" class="inp" type="date"></label>
    </div>
    <div class="mt-5 rounded-xl border border-[var(--border)] overflow-hidden">
      <div class="px-4 py-3 bg-[var(--surface-2)] text-[11px] uppercase tracking-wider font-bold text-[var(--faint)]">Simulação antes de confirmar</div>
      <div id="promoPreview" class="max-h-[300px] overflow-y-auto"></div>
    </div>
    <div class="rounded-xl p-3 mt-4 text-[11.5px] leading-relaxed" style="background:rgba(255,178,36,.08);color:var(--muted);border:1px solid rgba(255,178,36,.2)">O Mercado Livre valida reputação, histórico de preço e elegibilidade de cada anúncio. Alguns itens podem ser recusados individualmente.</div>
    <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-5">
      <button class="btn btn-ghost" data-pclose>Cancelar</button>
      <button class="btn btn-primary" id="btnConfirmPromo"><span data-ic="check" data-icc="w-4 h-4"></span>Aplicar promoção no Mercado Livre</button>
    </div>
  </div>
</div>

<div id="toasts"></div>

<script>
/* ============================================================
   MargemIQ — Dashboard de gestão de margens com IA
   ============================================================ */

/* ---------- Icons ---------- */
const ICONS = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  sparkles:'<path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  chart:'<line x1="3" y1="20" x2="21" y2="20"/><line x1="7" y1="20" x2="7" y2="11"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="17" y1="20" x2="17" y2="14"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.24.6.83 1 1.46 1H21a2 2 0 1 1 0 4h-.09c-.63 0-1.22.4-1.51 1z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  pencil:'<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  alert:'<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  trendUp:'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  trendDown:'<path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/>',
  truck:'<path d="M1 8h13v8H1z"/><path d="M14 11h4l3 3v2h-7z"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
  tag:'<path d="M20.6 13.4L12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  layers:'<path d="M12 2l10 5.5-10 5.5L2 7.5 12 2z"/><path d="M2 12.5l10 5.5 10-5.5"/><path d="M2 17.5l10 5.5 10-5.5"/>',
  zap:'<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>',
  star:'<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevR:'<path d="M9 6l6 6-6 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  cart:'<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.1h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H5.5"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  scan:'<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10.5 8v8M14 8v8M17 8v8"/>',
  percent:'<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16V7"/><circle cx="16.5" cy="13.5" r="1.3"/>'
};
function icon(n, cls){ return \`<svg class="\${cls||'w-5 h-5'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\${ICONS[n]||''}</svg>\`; }
function starIco(cls){ return \`<svg class="\${cls||'w-3 h-3'}" viewBox="0 0 24 24" fill="currentColor" style="color:#FFB224">\${ICONS.star}</svg>\`; }
function hydrateIcons(root){ (root||document).querySelectorAll('[data-ic]').forEach(el=>{ el.style.display='inline-flex'; el.innerHTML = icon(el.dataset.ic, el.dataset.icc||'w-5 h-5'); el.removeAttribute('data-ic'); }); }

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const clone = o => JSON.parse(JSON.stringify(o));
const brl = v => (isFinite(v)? v:0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const brlShort = v => v>=1000 ? 'R$ ' + (v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' mil' : brl(Math.round(v));
const fmtPct1 = v => v.toLocaleString('pt-BR',{minimumFractionDigits:1, maximumFractionDigits:1}) + '%';
const fmtN = (v,d) => v.toLocaleString('pt-BR',{minimumFractionDigits:d||0, maximumFractionDigits:d||0});
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function hueOf(s){ let h=0; for(const c of String(s)) h = (h*33 + c.charCodeAt(0)) % 360; return h; }
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function charm(v){ return Math.round((Math.max(1, Math.round(v - .1) + .9))*100)/100; }
function soldFmt(n){ return n>=1000 ? (n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' mil' : String(n); }
function timeAgo(ts){ const m = Math.max(0, Math.round((Date.now()-ts)/60000)); if(m<1) return 'análise de agora'; if(m<60) return \`há \${m} min\`; const h = Math.round(m/60); return h<24 ? \`há \${h}h\` : \`há \${Math.round(h/24)}d\`; }

/* ---------- Marketplaces & AI generator ---------- */
const MP_DEFAULT = [
  { id:'ml', name:'Mercado Livre', short:'ML', letter:'M', color:'#F7E033', commission:11.9, hint:'Comissão + taxas de pagamento e frete programado' },
  { id:'shopee', name:'Shopee', short:'SHP', letter:'S', color:'#FF6A3D', commission:10.0, hint:'Taxas da plataforma + frete do vendedor' },
  { id:'tiktok', name:'TikTok Shop', short:'TTS', letter:'T', color:'#FE2C55', commission:8.5, hint:'Comissão do TikTok Shop + logística' },
  { id:'amazon', name:'Amazon', short:'AMZ', letter:'a', color:'#FF9900', commission:15.0, hint:'Recomendação de preço + taxa de referência' }
];
/* ---------- Seed / State ---------- */
// Produtos de exemplo, marcados com demo:true. Só entram no painel quando o usuário pede.
function demoProducts(){
  return [
    { id:'p1', name:'Fone Bluetooth TWS Pro', category:'Eletrônicos • Áudio', sku:'ELC-FNE-1001', type:'buy', buyCost:14.90, materials:0, labor:0, overhead:0, hours:0, freight:5.80, packaging:1.90, stock:120, prices:{ml:49.90, shopee:null, tiktok:55.90, amazon:null}, ai:null },
    { id:'p2', name:'Luminária Smart Wi-Fi RGB', category:'Casa • Iluminação', sku:'CAS-LUM-2042', type:'buy', buyCost:18.20, materials:0, labor:0, overhead:0, hours:0, freight:7.40, packaging:3.10, stock:80, prices:{ml:54.90, shopee:49.90, tiktok:null, amazon:59.90}, ai:null },
    { id:'p3', name:'Caneca Térmica Inox 500ml', category:'Casa • Cozinha', sku:'CAS-CAN-3310', type:'prod', buyCost:0, materials:8.90, labor:3.20, overhead:2.40, hours:1.2, freight:3.80, packaging:1.20, stock:200, prices:{ml:34.90, shopee:null, tiktok:39.90, amazon:null}, ai:null },
    { id:'p4', name:'Kit Skincare Vitamina C (3un)', category:'Beleza • Skincare', sku:'BEL-SKC-4411', type:'buy', buyCost:11.40, materials:0, labor:0, overhead:0, hours:0, freight:6.90, packaging:4.60, stock:150, prices:{ml:24.90, shopee:42.90, tiktok:null, amazon:null}, ai:null },
    { id:'p5', name:'Organizador de Mesa em Madeira', category:'Casa • Decoração', sku:'CAS-ORG-5123', type:'prod', buyCost:0, materials:16.80, labor:12.00, overhead:4.00, hours:6, freight:9.50, packaging:5.20, stock:30, prices:{ml:89.90, shopee:null, tiktok:null, amazon:null}, ai:null },
    { id:'p6', name:'Chaveiro Personalizado Unissex', category:'Acessórios', sku:'ACE-CHE-6090', type:'prod', buyCost:0, materials:3.20, labor:1.80, overhead:0.90, hours:0.4, freight:2.10, packaging:0.80, stock:400, prices:{ml:19.90, shopee:17.90, tiktok:24.90, amazon:null}, ai:null }
  ].map(p => ({ ...p, demo:true }));
}
function emptyState(){
  return { marketplaces: MP_DEFAULT.map(m=>({...m})), products: [], settings:{ target:.25, months:12 }, version:2 };
}
const LS_KEY = 'margemIQ_v1';
// Até a versão 1 os exemplos entravam sozinhos e sem marcação: remove os que ainda estão como vieram.
function dropLegacyDemo(d){
  if((d.version || 1) >= 2) return d;
  const demo = demoProducts();
  d.products = d.products.filter(p => !demo.some(x => x.id === p.id && x.sku === p.sku));
  d.version = 2;
  return d;
}
function normalize(d){
  d.marketplaces = d.marketplaces.map(m => {
    const base = MP_DEFAULT.find(x=>x.id===m.id) || MP_DEFAULT[0];
    const commission = Number(m.commission);
    return { ...base, commission: Number.isFinite(commission) ? clamp(commission, 0, 99) : base.commission };
  });
  d.products = (d.products||[]).map(p => Object.assign(
    { id:'p'+Math.random().toString(36).slice(2,8), name:'', category:'Geral', sku:'SKU-'+Math.random().toString(36).slice(2,6).toUpperCase(), type:'buy', buyCost:0, materials:0, labor:0, overhead:0, hours:0, freight:0, packaging:0, stock:0, ai:null },
    p,
    { prices: Object.assign({ml:null, shopee:null, tiktok:null, amazon:null}, p.prices||{}) }
  )).map(p => ({ ...p, ai: ['mercado_livre_marketplace','mercado_livre_catalog'].includes(p.ai?.source) ? p.ai : null }));
  d.settings = Object.assign({ target:.25, months:12 }, d.settings||{});
  return d;
}
function loadState(){ try{ const raw = localStorage.getItem((window.accountId || 'guest') + ':' + LS_KEY); if(!raw) return null; const d = JSON.parse(raw); if(!d || !Array.isArray(d.products) || !Array.isArray(d.marketplaces)) return null; return normalize(dropLegacyDemo(d)); }catch(e){ return null; } }
function persist(){ try{ localStorage.setItem((window.accountId || 'guest') + ':' + LS_KEY, JSON.stringify(state)); }catch(e){} }
let state = loadState() || emptyState();
persist();

/* ---------- Compute ---------- */
function unitCost(p){ return (p.type==='prod' ? (p.materials + p.labor + p.overhead) : p.buyCost) + p.freight + p.packaging; }
// Sem custo a margem calculada seria falsa (perto de 100%); esses produtos ficam fora dos totais.
function hasCost(p){ return unitCost(p) > 0; }
function compute(p){
  const cost = unitCost(p);
  const mps = state.marketplaces.map(m => {
    const raw = p.prices ? p.prices[m.id] : null;
    const price = (typeof raw === 'number' && raw > 0) ? raw : null;
    const active = price !== null;
    const fee = active ? price * m.commission / 100 : 0;
    const net = active ? price - fee : 0;
    const profit = active ? net - cost : 0;
    const margin = active ? profit / price : 0;
    const eq = (1 - m.commission/100) > 0 ? cost / (1 - m.commission/100) : Infinity;
    return { mp:m, active, price, fee, net, profit, margin, eq };
  });
  const act = mps.filter(x => x.active);
  const best = act.length ? act.reduce((a,b) => b.margin > a.margin ? b : a) : null;
  return { cost, mps, active: act, best, marginBest: best ? best.margin : null };
}
function idealPrice(cost, commission, target){ const d = 1 - commission/100 - target; return d > 0 ? cost / d : null; }
function computeAll(){
  let investido=0, receitaPot=0, lucroPot=0, unidades=0, semCusto=0;
  const perMp = {};
  state.products.forEach(p => {
    if(!hasCost(p)){ semCusto++; return; }
    const c = compute(p);
    investido += c.cost * p.stock;
    unidades += p.stock;
    const n = Math.max(1, c.active.length);
    c.active.forEach(m => {
      const units = p.stock / n;
      receitaPot += m.price * units;
      lucroPot += Math.max(0, m.profit) * units;
      if(!perMp[m.mp.id]) perMp[m.mp.id] = { id:m.mp.id, name:m.mp.name, color:m.mp.color, lucro:0, short:m.mp.short };
      perMp[m.mp.id].lucro += Math.max(0, m.profit) * units;
    });
  });
  return { investido, receitaPot, lucroPot, margem: receitaPot ? lucroPot/receitaPot : 0, unidades, perMp, semCusto };
}
function statusOf(p){
  const c = compute(p);
  if(!c.active.length) return { k:'sem', label:'Sem preço', cls:'st-muted' };
  if(!hasCost(p)) return { k:'custo', label:'Sem custo', cls:'st-amber' };
  const worst = c.active.reduce((a,m) => m.profit < a.profit ? m : a);
  if(worst.profit < 0) return { k:'perdido', label:'No prejuízo', cls:'st-rose' };
  if(p.ai){
    const cheapest = p.ai.stats.min;
    let mine = Infinity; c.active.forEach(m => { if(m.price < mine) mine = m.price; });
    if(mine > cheapest * 1.08) return { k:'atencao', label:'Acima do concorrente', cls:'st-amber' };
  }
  if(c.marginBest !== null && c.marginBest < 0.2) return { k:'atencao', label:'Margem baixa', cls:'st-amber' };
  return { k:'ok', label:'Ativo', cls:'st-ok' };
}
function getAlerts(){
  const list = [];
  const missing = state.products.filter(p => !hasCost(p));
  if(missing.length) list.push({ tone:'#FFB224', text: missing.length === 1 ? \`\${missing[0].name} — informe o custo para calcular a margem\` : \`\${missing.length} produtos sem custo informado — a margem deles não é calculada\`, pid:missing[0].id });
  state.products.forEach(p => {
    const c = compute(p);
    if(!c.active.length){ list.push({ tone:'#FFB224', text:\`\${p.name} — sem preço em nenhum marketplace\`, pid:p.id }); return; }
    if(!hasCost(p)) return;
    c.mps.forEach(m => { if(m.active && m.profit < 0) list.push({ tone:'#FF5D73', text:\`\${p.name} · \${m.mp.name} — prejuízo de \${brl(-m.profit)}/un.\`, pid:p.id }); });
    if(p.ai){
      const cheapest = p.ai.stats.min;
      let mine = Infinity; c.active.forEach(m => { if(m.price < mine) mine = m.price; });
      if(mine > cheapest * 1.08) list.push({ tone:'#FFB224', text:\`\${p.name} — \${Math.round((mine/cheapest-1)*100)}% acima do concorrente mais barato (\${brl(cheapest)})\`, pid:p.id });
    }
  });
  return list;
}

/* ---------- UI state ---------- */
let draft = null, draftIsNew = false, openId = null;
let targetMargin = state.settings.target;
const ui = { query:'', sort:{ key:'margin', dir:-1 } };
let LAST_AI = null, AI_CTX = { productId:null }, aiToken = 0;

/* ---------- Toasts ---------- */
function toast(msg, tone){
  const t = document.createElement('div');
  t.className = 'toast' + (tone === 'rose' ? ' rose' : '');
  t.innerHTML = \`<span class="t-ic">\${icon(tone === 'rose' ? 'alert' : 'check')}</span><span></span>\`;
  t.lastElementChild.textContent = String(msg);
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
}

/* ---------- KPIs ---------- */
function renderKPIs(){
  const c = computeAll();
  const meta = Math.round(targetMargin*100);
  const ticket = c.unidades ? c.receitaPot / c.unidades : 0;
  const roi = c.investido ? c.lucroPot / c.investido : 0;
  const alerts = getAlerts();
  const margColor = c.margem >= .2 ? 'var(--emerald)' : c.margem >= 0 ? 'var(--amber)' : 'var(--rose)';
  const pct = clamp(c.margem*100, 0, 100);
  const alertPrev = alerts.slice(0,2).map(a => \`<div class="flex items-start gap-2 text-[11.5px] text-[var(--muted)] leading-snug"><i class="w-1.5 h-1.5 rounded-full mt-1.5 flex-none" style="background:\${a.tone}"></i><span class="line-clamp-2">\${esc(a.text)}</span></div>\`).join('');
  $('#kpiGrid').innerHTML = \`
    <div class="card p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="kpi-label">Receita potencial</div>
          <div class="kpi-value font-display">\${brlShort(c.receitaPot)}</div>
          <div class="kpi-sub">\${state.products.length} produtos · \${soldFmt(c.unidades)} un. em estoque\${c.semCusto ? \` · <span class="t-warn">\${c.semCusto} sem custo</span>\` : ''}</div>
        </div>
        <div class="kpi-ic ic-volt">\${icon('wallet')}</div>
      </div>
      <div class="mt-4 text-[12px] text-[var(--muted)]">Preço médio por unidade: <b style="color:var(--text)">\${brl(ticket)}</b></div>
    </div>
    <div class="card p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="kpi-label">Margem média</div>
          <div class="kpi-value font-display" style="color:\${margColor}">\${fmtPct1(c.margem*100)}</div>
          <div class="kpi-sub">meta: \${meta}% · após comissões e frete</div>
        </div>
        <div class="kpi-ic \${c.margem >= .2 ? 'ic-em' : 'ic-am'}">\${icon('percent')}</div>
      </div>
      <div class="mt-5">
        <div class="kpi-bar"><i style="width:\${clamp(pct/60*100,2,100)}%"></i><span class="meta-tick" style="left:\${clamp(meta,0,60)/60*100}%"></span></div>
        <div class="flex justify-between text-[10.5px] text-[var(--faint)] mt-2 font-semibold"><span>0%</span><span>meta \${meta}%</span><span>60%</span></div>
      </div>
    </div>
    <div class="card p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="kpi-label">Lucro potencial</div>
          <div class="kpi-value font-display t-pos">\${brlShort(c.lucroPot)}</div>
          <div class="kpi-sub">líquido de comissões, frete e embalagem</div>
        </div>
        <div class="kpi-ic ic-em">\${icon('zap')}</div>
      </div>
      <div class="mt-4 text-[12px] text-[var(--muted)]"><b style="color:var(--text)">\${brlShort(c.investido)}</b> investidos em estoque · retorno de <b class="\${roi >= 0 ? 't-pos' : 't-neg'}">\${fmtPct1(roi*100)}</b></div>
    </div>
    <div class="card p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="kpi-label">Alertas de preço</div>
          <div class="kpi-value font-display" style="color:\${alerts.length? 'var(--amber)' : 'var(--emerald)'}">\${alerts.length}</div>
          <div class="kpi-sub">\${alerts.length ? 'requerem ajuste' : 'tudo certo na loja'}</div>
        </div>
        <div class="kpi-ic \${alerts.length? 'ic-am' : 'ic-em'}">\${icon(alerts.length ? 'alert' : 'check')}</div>
      </div>
      <div class="mt-4 space-y-2">\${alertPrev || '<div class="text-[12px] text-[var(--muted)]">Nenhum produto fora da faixa competitiva.</div>'}</div>
    </div>\`;
}

/* ---------- Insights strip ---------- */
function renderInsights(){
  if(!state.products.length){
    $('#insightText').innerHTML = 'Nenhum produto cadastrado ainda. Importe seus anúncios do Mercado Livre em <b style="color:var(--text)">Produtos</b> e informe o custo de cada um para ver margem e lucro reais.';
    return;
  }
  const parts = [];
  const semCusto = state.products.filter(p => !hasCost(p)).length;
  if(semCusto) parts.push(\`<b class="t-warn">\${semCusto} produto(s) sem custo</b> — informe custo, frete e embalagem para calcular a margem real.\`);
  state.products.filter(hasCost).forEach(p => {
    const c = compute(p);
    if(p.ai && c.active.length){
      const cheapest = p.ai.stats.min;
      let mine = Infinity; c.active.forEach(m => { if(m.price < mine) mine = m.price; });
      if(mine > cheapest * 1.08) parts.push(\`<b style="color:var(--text)">\${esc(p.name)}</b> está <b class="t-warn">\${Math.round((mine/cheapest-1)*100)}% acima</b> do concorrente mais barato (\${brl(cheapest)}) — reajustar captura até <b style="color:var(--text)">\${brl((mine-cheapest)*p.stock)}</b> no estoque.\`);
    }
  });
  const neg = state.products.filter(p => hasCost(p) && compute(p).mps.some(m => m.active && m.profit < 0));
  if(neg.length) parts.push(\`<b class="t-neg">\${neg.length} produto(s) no prejuízo</b> — revise frete, embalagem ou preço antes de listar.\`);
  const ranked = state.products.filter(hasCost).map(p => ({ p, c: compute(p) })).filter(x => x.c.best).sort((a,b) => b.c.best.margin - a.c.best.margin);
  if(ranked[0] && ranked[0].c.best.margin >= targetMargin) parts.push(\`<b style="color:var(--text)">\${esc(ranked[0].p.name)}</b> lidera com margem de <b class="t-pos">\${fmtPct1(ranked[0].c.best.margin*100)}</b> — candidata ideal a escalar anúncios.\`);
  $('#insightText').innerHTML = parts.length
    ? parts.slice(0,2).map(t => \`<span class="flex gap-2 items-start"><i class="mt-1.5 w-1.5 h-1.5 rounded-full flex-none" style="background:var(--volt)"></i><span>\${t}</span></span>\`).join('') + (parts.length > 2 ? \`<span class="block mt-1.5 text-[11.5px] t-mut">+ \${parts.length-2} insights adicionais no radar.</span>\` : '')
    : \`Tudo certo — preços e custos equilibrados em toda a loja. Rode uma nova análise de concorrência para validar os pontos de venda.\`;
}

/* ---------- Table ---------- */
function sortIcon(k){
  if(ui.sort.key !== k) return '<span class="s-arr off">⇅</span>';
  return \`<span class="s-arr">\${ui.sort.dir > 0 ? '↑' : '↓'}</span>\`;
}
function renderTable(){
  $('#tHead').innerHTML = \`<tr>
    <th class="sortable" data-sort="name">Produto \${sortIcon('name')}</th>
    <th>Tipo</th>
    <th class="sortable" data-sort="cost">Custo unitário \${sortIcon('cost')}</th>
    <th>Preços por marketplace</th>
    <th class="sortable" data-sort="margin">Margem \${sortIcon('margin')}</th>
    <th>Status</th>
    <th class="!text-right">Ações</th>
  </tr>\`;

  let rows = state.products.map(p => ({ p, c: compute(p) }));
  const q = ui.query.trim().toLowerCase();
  if(q) rows = rows.filter(x => (x.p.name + ' ' + x.p.category + ' ' + x.p.sku).toLowerCase().includes(q));
  const dir = ui.sort.dir;
  rows.sort((a,b) => {
    if(ui.sort.key === 'name') return a.p.name.localeCompare(b.p.name,'pt-BR') * dir;
    if(ui.sort.key === 'cost') return ((a.c.cost) - (b.c.cost)) * dir;
    const am = a.c.marginBest === null ? -Infinity : a.c.marginBest;
    const bm = b.c.marginBest === null ? -Infinity : b.c.marginBest;
    return (am - bm) * dir;
  });
  $('#prodCount').textContent = \`\${rows.length} produto(s)\`;
  $('#navCount').textContent = state.products.length;

  if(!state.products.length){
    $('#tbody').innerHTML = \`<tr><td colspan="7" class="!py-14 text-center">
      <div class="text-[13.5px] font-semibold">Nenhum produto cadastrado</div>
      <div class="text-[12.5px] text-[var(--muted)] mt-1">Importe seus anúncios do Mercado Livre e depois informe o custo de cada produto.</div>
      <button class="btn btn-primary sm mt-4" data-import-ml>\${icon('download','w-4 h-4')}Importar do Mercado Livre</button>
    </td></tr>\`;
    $$('#tbody [data-import-ml]').forEach(b => b.addEventListener('click', importMlProducts));
    return;
  }
  if(!rows.length){
    $('#tbody').innerHTML = \`<tr><td colspan="7" class="!py-14 text-center text-[var(--muted)]">Nenhum produto encontrado para “\${esc(ui.query)}”.</td></tr>\`;
    return;
  }
  $('#tbody').innerHTML = rows.map(({ p, c }) => {
    const st = statusOf(p);
    const h = hueOf(p.sku);
    const chips = state.marketplaces.filter(m => p.prices[m.id] > 0)
      .map(m => \`<span class="mp-chip"><i style="background:\${m.color}"></i>\${m.short}<b>\${brl(p.prices[m.id])}</b></span>\`).join('') || '<span class="text-[var(--faint)] text-[12.5px]">Sem preços listados</span>';
    let bestCell;
    if(!hasCost(p)) bestCell = '<span class="text-[12px] t-warn font-semibold">Informe o custo</span>';
    else if(c.best){
      const col = c.best.margin >= .2 ? 'var(--emerald)' : c.best.margin >= 0 ? 'var(--amber)' : 'var(--rose)';
      bestCell = \`<div class="flex items-center gap-2.5"><div class="mbar"><i style="width:\${clamp(c.best.margin*100,0,100)}%; background:\${col}"></i></div><b class="\${c.best.margin >= 0 ? 't-pos' : 't-neg'}" style="font-variant-numeric:tabular-nums">\${fmtPct1(c.best.margin*100)}</b></div><div class="text-[11px] text-[var(--faint)] mt-1">no \${c.best.mp.name}</div>\`;
    } else bestCell = '<span class="text-[var(--faint)]">—</span>';
    const costSub = p.type === 'prod'
      ? \`produção \${brl(p.materials + p.labor + p.overhead)}\`
      : \`compra \${brl(p.buyCost)}\`;
    return \`<tr data-pid="\${esc(p.id)}">
      <td>
        <div class="flex items-center gap-3 min-w-0">
          <span class="p-avatar" style="background:linear-gradient(135deg, hsl(\${h} 55% 40% / .3), hsl(\${(h+40)%360} 55% 32% / .15)); color:hsl(\${h} 85% 74%); border:1px solid hsl(\${h} 55% 50% / .3)">\${esc(p.name.charAt(0).toUpperCase())}</span>
          <div class="min-w-0">
            <div class="font-semibold text-[13.5px] truncate max-w-[220px]">\${esc(p.name)}</div>
            <div class="text-[11.5px] text-[var(--faint)] truncate">\${p.demo ? '<b class="t-warn">EXEMPLO</b> · ' : ''}\${esc(p.category)} · \${esc(p.sku)}</div>
          </div>
        </div>
      </td>
      <td><span class="type-badge \${p.type === 'buy' ? 'type-buy' : 'type-prod'}">\${p.type === 'buy' ? icon('cart','w-3.5 h-3.5') + 'Comprado' : icon('layers','w-3.5 h-3.5') + 'Produção'}</span></td>
      <td>
        <div class="font-bold" style="font-variant-numeric:tabular-nums">\${brl(c.cost)}</div>
        <div class="text-[11px] text-[var(--faint)] mt-0.5">\${costSub} · frete \${brl(p.freight)} · emb. \${brl(p.packaging)}</div>
        <div class="text-[11px] text-[var(--muted)] mt-0.5">estoque: \${p.stock} un.</div>
      </td>
      <td><div class="flex flex-wrap gap-1.5 max-w-[230px]">\${chips}</div></td>
      <td>\${bestCell}</td>
      <td><span class="pill \${st.cls}"><span class="dot"></span>\${st.label}</span></td>
      <td class="!text-right">
        <div class="flex items-center justify-end gap-2">
          <button class="row-ai" data-ai="\${p.id}" title="Analisar concorrentes com IA">\${icon('sparkles')}</button>
          <span class="text-[var(--faint)]">\${icon('chevR','w-4 h-4')}</span>
        </div>
      </td>
    </tr>\`;
  }).join('');

  $$('#tHead th.sortable').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.sort;
    if(ui.sort.key === k) ui.sort.dir *= -1; else { ui.sort.key = k; ui.sort.dir = k === 'name' ? 1 : -1; }
    renderTable();
  }));
  $$('#tbody tr[data-pid]').forEach(tr => {
    tr.addEventListener('click', e => {
      const aiBtn = e.target.closest('[data-ai]');
      if(aiBtn){ e.stopPropagation(); openAI(aiBtn.dataset.ai); return; }
      openDrawer(tr.dataset.pid);
    });
  });
}

/* ---------- Charts ---------- */
let areaChart, donutChart;
// Mesma regra de computeAll: o estoque é dividido igualmente entre os marketplaces com preço.
function buildProductBreakdown(){
  const rows = state.products.filter(hasCost).map(p => {
    const c = compute(p);
    const units = p.stock / Math.max(1, c.active.length);
    const revenue = c.active.reduce((sum, m) => sum + m.price * units, 0);
    return { name: p.name || p.sku, revenue, cost: c.active.length ? c.cost * p.stock : 0 };
  }).filter(r => r.revenue > 0).sort((a,b) => b.revenue - a.revenue).slice(0, 10);
  return {
    labels: rows.map(r => r.name.length > 22 ? r.name.slice(0, 21) + '…' : r.name),
    rev: rows.map(r => Math.round(r.revenue)),
    cost: rows.map(r => Math.round(r.cost))
  };
}
function initCharts(){
  Chart.defaults.font.family = 'Inter';
  Chart.defaults.color = '#7C828D';
  Chart.defaults.font.size = 11;
  const actx = $('#areaChart').getContext('2d');
  const tooltip = {
    backgroundColor:'#14181F', borderColor:'rgba(255,255,255,.12)', borderWidth:1,
    titleColor:'#EEF1F5', bodyColor:'#B7BEC9', padding:12, cornerRadius:10,
    boxWidth:8, boxHeight:8, usePointStyle:true, boxPadding:4,
    callbacks:{ label: c => \` \${c.dataset.label}: \${brl(c.parsed.y)}\` }
  };
  areaChart = new Chart(actx, {
    type:'bar',
    data:{ labels: [], datasets:[
      { label:'Receita potencial', data: [], backgroundColor:'#D8FF3E', borderRadius:4, maxBarThickness:28 },
      { label:'Custo do estoque', data: [], backgroundColor:'#4A5160', borderRadius:4, maxBarThickness:28 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ display:false }, tooltip },
      scales:{
        x:{ grid:{ display:false }, border:{ display:false }, ticks:{ autoSkip:false, maxRotation:40, minRotation:0, padding:6 } },
        y:{ beginAtZero:true, grid:{ color:'rgba(255,255,255,.05)' }, border:{ display:false },
            ticks:{ maxTicksLimit:5, padding:8, callback: v => v >= 1000 ? 'R$' + (v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' mil' : 'R$' + v } }
      }
    }
  });
  donutChart = new Chart($('#donutChart'), {
    type:'doughnut',
    data:{ labels:[], datasets:[{ data:[], backgroundColor:[], borderColor:'#0E1015', borderWidth:3, hoverOffset:8, borderRadius:6, spacing:2 }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'74%',
      plugins:{ legend:{ display:false }, tooltip: Object.assign({}, tooltip, { callbacks:{ label: c => \` \${c.label}: \${brl(c.parsed)}\` } }) }
    }
  });
  refreshCharts();
}
function refreshCharts(){
  const d = buildProductBreakdown();
  areaChart.data.labels = d.labels;
  areaChart.data.datasets[0].data = d.rev;
  areaChart.data.datasets[1].data = d.cost;
  areaChart.update();
  const c = computeAll();
  const labels = [], data = [], colors = [];
  state.marketplaces.forEach(m => {
    const pm = c.perMp[m.id];
    if(pm && pm.lucro > 0){ labels.push(pm.name); data.push(Math.round(pm.lucro)); colors.push(pm.color); }
  });
  if(!labels.length){ labels.push('Sem lucros'); data.push(1); colors.push('rgba(255,255,255,.08)'); }
  donutChart.data.labels = labels;
  donutChart.data.datasets[0].data = data;
  donutChart.data.datasets[0].backgroundColor = colors;
  donutChart.update();
  const total = data.reduce((a,b) => a+b, 0);
  $('#donutTotal').textContent = brlShort(c.lucroPot);
  $('#donutLegend').innerHTML = labels.map((l,i) => {
    if(!c.perMp[state.marketplaces.find(m => m.name === l)?.id]) return '';
    const pm = c.perMp[state.marketplaces.find(m => m.name === l).id];
    const pctL = total ? Math.round((data[i]/total)*100) : 0;
    return \`<li class="flex items-center gap-2.5 text-[12.5px]">
      <i class="w-2.5 h-2.5 rounded-full flex-none" style="background:\${colors[i]}"></i>
      <span class="flex-1 text-[var(--muted)]">\${esc(l)}</span>
      <b style="font-variant-numeric:tabular-nums">\${brlShort(pm.lucro)}</b>
      <span class="text-[11px] text-[var(--faint)] w-9 text-right">\${pctL}%</span>
    </li>\`;
  }).join('');
}

/* ---------- Bell ---------- */
function renderBell(){
  const alerts = getAlerts();
  $('#bellCount').textContent = alerts.length;
  $('#bellCount').style.display = alerts.length ? 'grid' : 'none';
  $('#bellCount2').textContent = alerts.length + ' alertas';
  $('#bellList').innerHTML = alerts.length
    ? alerts.map(a => \`<button class="bell-item" data-pid="\${esc(a.pid)}"><i class="bell-dot" style="background:\${a.tone}"></i><span>\${esc(a.text)}</span></button>\`).join('')
    : '<div class="px-4 py-8 text-center text-[12.5px] text-[var(--muted)]">Nenhum alerta no momento. Loja competitiva.</div>';
  $$('#bellList .bell-item').forEach(b => b.addEventListener('click', () => { $('#bellPanel').hidden = true; openDrawer(b.dataset.pid); }));
}

/* ---------- Full render ---------- */
function renderAll(){ renderKPIs(); renderInsights(); renderTable(); renderBell(); updateDemoButton(); if(areaChart) refreshCharts(); }

/* ---------- Drawer ---------- */
const drawerEl = $('#drawer');
function openDrawer(id, keepOpen){
  const p = state.products.find(x => x.id === id);
  if(!p) return;
  openId = id; draftIsNew = false;
  draft = clone(p);
  $('#drawerContent').innerHTML = drawerHTML(draft, false);
  hydrateIcons($('#drawerContent'));
  if(!keepOpen){ drawerEl.classList.add('open'); $('#drawerOverlay').classList.add('open'); document.body.classList.add('noscroll'); }
  refreshDrawer();
  const sld = $('#dTarget'); if(sld){ sld.value = Math.round(targetMargin*100); sld.style.setProperty('--p', ((sld.value - sld.min)/(sld.max - sld.min)*100) + '%'); }
}
function openNewProduct(){
  draftIsNew = true; openId = null;
  draft = { id:'p_new', name:'', category:'Geral', sku:'NEW-' + Math.random().toString(36).slice(2,6).toUpperCase(), type:'buy', buyCost:0, materials:0, labor:0, overhead:0, hours:0, freight:0, packaging:0, stock:0, prices:{ml:null, shopee:null, tiktok:null, amazon:null}, ai:null };
  $('#drawerContent').innerHTML = drawerHTML(draft, true);
  hydrateIcons($('#drawerContent'));
  drawerEl.classList.add('open'); $('#drawerOverlay').classList.add('open'); document.body.classList.add('noscroll');
  refreshDrawer();
  const sld = $('#dTarget'); if(sld){ sld.value = Math.round(targetMargin*100); sld.style.setProperty('--p', ((sld.value - sld.min)/(sld.max - sld.min)*100) + '%'); }
  setTimeout(() => { const n = $('#dName'); if(n) n.focus(); }, 380);
}
function closeDrawer(){ drawerEl.classList.remove('open'); $('#drawerOverlay').classList.remove('open'); document.body.classList.remove('noscroll'); openId = null; }

function drawerHTML(p, isNew){
  const made = p.type === 'prod';
  const mpRows = state.marketplaces.map(m => {
    const price = p.prices[m.id];
    const on = price !== null && price > 0;
    return \`<div class="mp-row \${on ? 'on' : ''}" data-row="\${m.id}">
      <div class="flex items-center gap-3">
        <span class="mp-logo" style="--c:\${m.color}">\${m.letter}</span>
        <div class="flex-1 min-w-0">
          <div class="text-[13.5px] font-semibold">\${m.name}</div>
          <div class="text-[11.5px] text-[var(--muted)]">Comissão \${fmtPct1(m.commission)} · frete do vendedor</div>
        </div>
        <label class="tgl"><input type="checkbox" data-mptoggle="\${m.id}" \${on ? 'checked' : ''}><span></span></label>
      </div>
      <div class="mp-body \${on ? '' : 'off'} mt-3">
        <div class="inpwrap"><span>R$</span><input type="number" min="0" step="0.01" inputmode="decimal" data-price="\${m.id}" value="\${on ? price.toFixed(2) : ''}" placeholder="Definir preço de venda" \${on ? '' : 'disabled'}></div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5">
          <div class="mp-stat"><div class="l">Comissão</div><div class="v t-mut" id="fee-\${m.id}">—</div></div>
          <div class="mp-stat"><div class="l">Líquido p/ você</div><div class="v" id="net-\${m.id}">—</div></div>
          <div class="mp-stat"><div class="l">Lucro / un.</div><div class="v" id="pf-\${m.id}">—</div></div>
          <div class="mp-stat"><div class="l">Margem</div><div class="v" id="mg-\${m.id}">—</div></div>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[12px] text-[var(--muted)]">
          <span id="eq-\${m.id}">Equilíbrio: —</span>
          <span id="id-\${m.id}">Ideal: —</span>
          <button class="btn-volt-soft" data-act="apply-ideal" data-mp="\${m.id}">Aplicar ideal</button>
        </div>
      </div>
    </div>\`;
  }).join('');

  return \`
  <div class="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-[var(--border)]">
    <button class="icon-btn" data-act="close">\${icon('x','w-4 h-4')}</button>
    <div class="flex-1 min-w-0">
      <div class="text-[10.5px] uppercase tracking-[.14em] text-[var(--faint)] font-bold">\${isNew ? 'Novo produto' : esc(p.sku)}</div>
      <input id="dName" class="w-full bg-transparent border-none focus:outline-none font-display font-bold text-[16px] mt-0.5 placeholder-[var(--faint)]" placeholder="Nome do produto" value="\${esc(p.name)}" data-f="name">
    </div>
  </div>

  <div class="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
    <div class="drawer-strip" id="drawerStrip"></div>

    <div>
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="section-title">Origem do produto</div>
        <div class="seg">
          <button data-otype="buy" class="\${p.type === 'buy' ? 'on' : ''}">\${icon('cart')}Compra de estoque</button>
          <button data-otype="prod" class="\${p.type === 'prod' ? 'on' : ''}">\${icon('layers')}Produção própria</button>
        </div>
      </div>
      <div class="fgrid">
        <div class="field" id="fBuyCost" style="\${made ? 'display:none' : ''}">
          <label>Preço do fornecedor</label>
          <div class="inpwrap"><span>R$</span><input type="number" min="0" step="0.01" inputmode="decimal" data-f="buyCost" value="\${p.buyCost ? p.buyCost.toFixed(2) : ''}" placeholder="0.00"></div>
        </div>
        <div class="field" id="fMateriais" style="\${made ? '' : 'display:none'}">
          <label>Materiais e insumos</label>
          <div class="inpwrap"><span>R$</span><input type="number" min="0" step="0.01" inputmode="decimal" data-f="materials" value="\${p.materials ? p.materials.toFixed(2) : ''}" placeholder="0.00"></div>
        </div>
        <div class="field" id="fLabor" style="\${made ? '' : 'display:none'}">
          <label>Mão de obra</label>
          <div class="inpwrap"><span>R$</span><input type="number" min="0" step="0.01" inputmode="decimal" data-f="labor" value="\${p.labor ? p.labor.toFixed(2) : ''}" placeholder="0.00"></div>
        </div>
        <div class="field" id="fOverhead" style="\${made ? '' : 'display:none'}">
          <label>Custos fixos (energia, ferramentas…)</label>
          <div class="inpwrap"><span>R$</span><input type="number" min="0" step="0.01" inputmode="decimal" data-f="overhead" value="\${p.overhead ? p.overhead.toFixed(2) : ''}" placeholder="0.00"></div>
        </div>
        <div class="field" id="fHours" style="\${made ? '' : 'display:none'}">
          <label>Tempo médio por un. (h)</label>
          <input class="inp" type="number" min="0" step="0.1" inputmode="decimal" data-f="hours" value="\${p.hours || ''}" placeholder="0">
        </div>
        <div class="field" style="\${made ? '' : ''}">
          <label>Frete de inbound</label>
          <div class="inpwrap"><span>R$</span><input type="number" min="0" step="0.01" inputmode="decimal" data-f="freight" value="\${p.freight ? p.freight.toFixed(2) : ''}" placeholder="0.00"></div>
        </div>
        <div class="field">
          <label>Embalagem</label>
          <div class="inpwrap"><span>R$</span><input type="number" min="0" step="0.01" inputmode="decimal" data-f="packaging" value="\${p.packaging ? p.packaging.toFixed(2) : ''}" placeholder="0.00"></div>
        </div>
        <div class="field">
          <label>Estoque</label>
          <input class="inp" type="number" min="0" step="1" inputmode="numeric" data-f="stock" value="\${p.stock || ''}" placeholder="0">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 mt-3">
        <div><label class="block text-[12px] font-semibold text-[var(--muted)] mb-1.5">Categoria</label><input class="inp" data-f="category" value="\${esc(p.category)}"></div>
        <div><label class="block text-[12px] font-semibold text-[var(--muted)] mb-1.5">SKU</label><input class="inp" data-f="sku" value="\${esc(p.sku)}"></div>
      </div>
    </div>

    <div class="cost-panel">
      <div class="cp-row"><span id="dCostMadeLabel">Custo de produção</span><span id="dCostBase">—</span></div>
      <div class="cp-row"><span>Frete de inbound</span><span id="dCostFreight">—</span></div>
      <div class="cp-row"><span>Embalagem</span><span id="dCostPack">—</span></div>
      <div class="cp-total"><span>Custo total por unidade</span><span id="dCostTotal">—</span></div>
      <div class="text-[11.5px] text-[var(--muted)] mt-2" id="dCostRate"></div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-3">
        <div class="section-title">Marketplaces &amp; preços</div>
        <button class="link-btn" data-act="fees">Editar taxas</button>
      </div>
      <div class="space-y-3">\${mpRows}</div>
    </div>

    <div class="target-box">
      <div class="flex justify-between items-center">
        <span class="text-[12.5px] font-semibold">Margem-alvo por unidade</span>
        <b class="font-display" id="dTargetVal" style="color:var(--volt)">\${Math.round(targetMargin*100)}%</b>
      </div>
      <input type="range" id="dTarget" min="5" max="60" step="1" value="\${Math.round(targetMargin*100)}" class="mt-3">
      <div class="text-[11.5px] text-[var(--muted)] mt-2 leading-relaxed">Define o preço ideal e o ponto de equilíbrio calculados em cada marketplace acima.</div>
    </div>

    <div>
      <div class="section-title mb-3">Inteligência de preço <span class="ai-tag">IA</span></div>
      \${p.ai ? \`
      <div class="ai-mini">
        <div class="flex items-center gap-2.5">
          <span class="ai-orb !w-9 !h-9">\${icon('sparkles','w-4 h-4')}</span>
          <div>
            <div class="text-[13px] font-semibold">Análise de concorrência</div>
            <div class="text-[11.5px] text-[var(--muted)]">\${timeAgo(p.ai.when)} · \${p.ai.comps.length} vendedores mapeados</div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-3">
          <div class="mp-stat"><div class="l">Preço médio</div><div class="v">\${brl(p.ai.stats.avg)}</div></div>
          <div class="mp-stat"><div class="l">Menor</div><div class="v">\${brl(p.ai.stats.min)}</div></div>
          <div class="mp-stat"><div class="l">Tendência 30d</div><div class="v \${p.ai.trend >= 0 ? 't-pos' : 't-neg'}">\${p.ai.trend >= 0 ? '+' : ''}\${p.ai.trend}%</div></div>
        </div>
        <button class="btn btn-ghost w-full mt-3" data-act="ai-open">\${icon('refresh','w-4 h-4')} Reanalisar concorrentes</button>
      </div>\` : \`
      <button class="ai-cta" data-act="ai-open">
        <span class="ai-orb">\${icon('sparkles','w-5 h-5')}</span>
        <span class="flex-1">
          <span class="block text-[13.5px] font-semibold">Analise concorrentes com IA</span>
          <span class="block text-[11.5px] text-[var(--muted)] mt-0.5">Preços, vendas, avaliações e tendências dos lojistas</span>
        </span>
        \${icon('chevR','w-4 h-4 text-[var(--volt)]')}
      </button>\`}
    </div>
  </div>

  <div class="border-t border-[var(--border)] px-5 sm:px-6 py-4 flex items-center gap-2 bg-[var(--surface)]">
    \${!isNew ? \`<button class="btn btn-danger-soft" data-act="delete" id="dDeleteBtn" aria-label="Excluir produto">\${icon('trash','w-4 h-4')}<span class="hidden sm:inline">Excluir</span></button>\` : '<span></span>'}
    <div class="ml-auto flex gap-2 min-w-0">
      <button class="btn btn-ghost hidden sm:inline-flex" data-act="close">Cancelar</button>
      <button class="btn btn-primary" data-act="save">\${isNew ? 'Adicionar à loja' : 'Salvar alterações'}</button>
    </div>
  </div>\`;
}

function refreshDrawer(){
  if(!draft) return;
  const made = draft.type === 'prod';
  const c = compute(draft);
  $('#dCostMadeLabel').textContent = made ? 'Custo de produção' : 'Custo de compra';
  $('#dCostBase').textContent = brl(made ? draft.materials + draft.labor + draft.overhead : draft.buyCost);
  $('#dCostFreight').textContent = '+ ' + brl(draft.freight);
  $('#dCostPack').textContent = '+ ' + brl(draft.packaging);
  $('#dCostTotal').textContent = brl(c.cost);
  $('#dCostRate').textContent = made && draft.hours > 0
    ? \`≈ \${fmtN(draft.hours,1)}h de produção · mão de obra de \${brl(draft.hours ? draft.labor / draft.hours : 0)}/h\`
    : 'Custo unitário = base + frete + embalagem';

  state.marketplaces.forEach(m => {
    const m2 = c.mps.find(x => x.mp.id === m.id);
    const row = $(\`[data-row="\${m.id}"]\`);
    if(row){
      row.classList.toggle('on', m2.active);
      const body = row.querySelector('.mp-body');
      body.classList.toggle('off', !m2.active);
      const tog = row.querySelector('[data-mptoggle]');
      tog.checked = m2.active;
      const inp = row.querySelector('[data-price]');
      if(document.activeElement !== inp) inp.value = m2.active ? m2.price.toFixed(2) : '';
      inp.disabled = !m2.active;
    }
    const feeEl = $('#fee-' + m.id), netEl = $('#net-' + m.id), pfEl = $('#pf-' + m.id), mgEl = $('#mg-' + m.id);
    if(feeEl){
      if(m2.active){
        feeEl.textContent = '- ' + brl(m2.fee);
        netEl.textContent = brl(m2.net);
        pfEl.textContent = (m2.profit >= 0 ? '+ ' : '− ') + brl(Math.abs(m2.profit)).replace('R$','R$ ');
        pfEl.className = 'v ' + (m2.profit >= 0 ? 't-pos' : 't-neg');
        mgEl.textContent = fmtPct1(m2.margin * 100);
        mgEl.className = 'v ' + (m2.margin >= .2 ? 't-pos' : m2.margin >= 0 ? 't-warn' : 't-neg');
      } else { feeEl.textContent = netEl.textContent = pfEl.textContent = mgEl.textContent = '—'; pfEl.className = 'v'; mgEl.className = 'v'; }
    }
    const eq = isFinite(m2.eq) ? brl(m2.eq) : '—';
    const ideal = idealPrice(c.cost, m.commission, targetMargin);
    const eqEl = $('#eq-' + m.id), idEl = $('#id-' + m.id);
    if(eqEl) eqEl.textContent = 'Equilíbrio: ' + eq;
    if(idEl) idEl.textContent = 'Ideal (' + Math.round(targetMargin*100) + '%): ' + (ideal ? brl(charm(ideal)) : '—');
  });

  const n = Math.max(1, c.active.length);
  const potL = c.active.reduce((s, m2) => s + Math.max(0, m2.profit) * draft.stock / n, 0);
  const potR = c.active.reduce((s, m2) => s + m2.price * draft.stock / n, 0);
  $('#drawerStrip').innerHTML = \`
    <span>Custo <b>\${brl(c.cost)}</b></span>
    <span>Estoque <b>\${draft.stock} un.</b></span>
    <span>Receita potencial <b>\${brl(potR)}</b></span>
    <span>Lucro potencial <b class="t-pos">\${brl(potL)}</b></span>\`;
}

drawerEl.addEventListener('input', e => {
  if(!draft) return;
  const t = e.target;
  if(t.dataset.f){
    const f = t.dataset.f;
    if(f === 'name' || f === 'category' || f === 'sku') draft[f] = t.value;
    else draft[f] = t.value === '' ? 0 : Math.max(0, parseFloat(String(t.value).replace(',', '.')) || 0);
    refreshDrawer();
  }
  if(t.dataset.price){
    const mpId = t.dataset.price;
    draft.prices[mpId] = t.value === '' ? null : Math.max(0, parseFloat(String(t.value).replace(',', '.')) || 0);
    refreshDrawer();
  }
  if(t.id === 'dTarget'){
    targetMargin = (+t.value) / 100;
    state.settings.target = targetMargin;
    t.style.setProperty('--p', ((t.value - t.min) / (t.max - t.min) * 100) + '%');
    $('#dTargetVal').textContent = t.value + '%';
    persist();
    renderKPIs();
    refreshDrawer();
  }
});
drawerEl.addEventListener('change', e => {
  const t = e.target;
  if(t.dataset.mptoggle){
    const mpId = t.dataset.mptoggle;
    if(t.checked){
      if(!draft.prices[mpId] || draft.prices[mpId] <= 0){
        const m = state.marketplaces.find(x => x.id === mpId);
        const ideal = idealPrice(unitCost(draft), m.commission, targetMargin);
        draft.prices[mpId] = ideal ? charm(ideal) : charm(unitCost(draft) * 1.6);
      }
    } else draft.prices[mpId] = null;
    refreshDrawer();
  }
  if(t.dataset.f && t.type === 'number' && t.value !== ''){ t.value = (+t.value).toFixed(+t.dataset.f === 1 ? 1 : 2); }
  if(t.dataset.price && t.value !== ''){ t.value = (+t.value).toFixed(2); }
});
drawerEl.addEventListener('click', e => {
  const typeBtn = e.target.closest('[data-otype]');
  if(typeBtn){
    draft.type = typeBtn.dataset.otype;
    $$('#drawerContent [data-otype]').forEach(b => b.classList.toggle('on', b.dataset.otype === draft.type));
    const made = draft.type === 'prod';
    ['fBuyCost'].forEach(id => $('#' + id).style.display = made ? 'none' : '');
    ['fMateriais','fLabor','fOverhead','fHours'].forEach(id => $('#' + id).style.display = made ? '' : 'none');
    refreshDrawer();
    return;
  }
  const b = e.target.closest('[data-act]');
  if(!b) return;
  const act = b.dataset.act;
  if(act === 'close') closeDrawer();
  if(act === 'fees') openFees();
  if(act === 'ai-open') openAI(openId);
  if(act === 'apply-ideal'){
    const m = state.marketplaces.find(x => x.id === b.dataset.mp);
    const ideal = idealPrice(unitCost(draft), m.commission, targetMargin);
    if(ideal){ draft.prices[m.id] = charm(ideal); toast(\`Preço ideal de \${brl(charm(ideal))} definido no \${m.name}\`); refreshDrawer(); }
    else toast('Margem-alvo inviável com esta comissão — reduza a margem.', 'rose');
  }
  if(act === 'save'){
    draft.name = ($('#dName').value || '').trim();
    if(!draft.name){ $('#dName').classList.add('err'); $('#dName').focus(); toast('Informe o nome do produto.', 'rose'); return; }
    ['buyCost','materials','labor','overhead','freight','packaging','hours'].forEach(f => { const v = parseFloat(String(draft[f]).replace(',', '.')); draft[f] = isFinite(v) && v > 0 ? v : 0; });
    draft.stock = Math.max(0, Math.round(draft.stock || 0));
    if(draftIsNew){
      draft.id = 'p' + Date.now();
      delete draft.id; draft.id = 'p' + Date.now();
      state.products.unshift(clone(draft));
      toast('Produto adicionado à loja');
    } else {
      const idx = state.products.findIndex(x => x.id === draft.id);
      state.products[idx] = clone(draft);
      toast('Produto salvo com sucesso');
    }
    persist(); closeDrawer(); renderAll();
  }
  if(act === 'delete'){
    if(b.dataset.confirm){
      state.products = state.products.filter(x => x.id !== draft.id);
      persist(); closeDrawer(); renderAll();
      toast('Produto excluído');
    } else {
      b.dataset.confirm = '1';
      b.innerHTML = icon('alert','w-4 h-4') + '<span class="sm:hidden">Confirmar?</span><span class="hidden sm:inline">Confirmar exclusão?</span>';
      setTimeout(() => { if(b.isConnected){ delete b.dataset.confirm; b.innerHTML = icon('trash','w-4 h-4') + '<span class="hidden sm:inline">Excluir</span>'; } }, 2600);
    }
  }
});
$('#drawerOverlay').addEventListener('click', closeDrawer);

/* ---------- Fees modal ---------- */
function openFees(){
  $('#feesList').innerHTML = state.marketplaces.map(m => \`
    <div class="fee-row">
      <span class="mp-logo" style="--c:\${m.color}">\${m.letter}</span>
      <div class="flex-1 min-w-0">
        <div class="text-[13.5px] font-semibold">\${m.name}</div>
        <div class="text-[11.5px] text-[var(--muted)]">\${m.hint}</div>
      </div>
      <div class="flex items-center gap-1.5">
        <input class="inp !w-[92px] text-right" type="number" min="0" max="45" step="0.1" data-fee="\${m.id}" value="\${m.commission}">
        <span class="text-[var(--faint)] text-[13px] font-semibold">%</span>
      </div>
    </div>\`).join('');
  $$('#feesList [data-fee]').forEach(inp => inp.addEventListener('blur', () => { if(inp.value !== '') inp.value = (Math.round((+inp.value)*10)/10).toString(); }));
  openModal($('#feesModal'));
}
function openModal(el){ el.classList.add('open'); el.setAttribute('aria-hidden','false'); document.body.classList.add('noscroll'); }
function closeModal(el){ el.classList.remove('open'); el.setAttribute('aria-hidden','true'); document.body.classList.remove('noscroll'); }

$('#btnFeesSave').addEventListener('click', () => {
  $$('#feesList [data-fee]').forEach(inp => {
    const m = state.marketplaces.find(x => x.id === inp.dataset.fee);
    m.commission = clamp(parseFloat(String(inp.value).replace(',', '.')) || 0, 0, 45);
  });
  persist(); closeModal($('#feesModal')); renderAll();
  if(openId){ const p = state.products.find(x => x.id === openId); if(p){ draft = clone(p); $('#drawerContent').innerHTML = drawerHTML(draft, false); hydrateIcons($('#drawerContent')); refreshDrawer(); } }
  toast('Taxas dos marketplaces atualizadas');
});
// Os exemplos só entram ou saem sozinhos: produtos reais e taxas nunca são apagados por este botão.
function demoButtonLabel(){ return state.products.some(p => p.demo) ? 'Remover exemplos' : 'Carregar exemplos'; }
function updateDemoButton(){ const b = $('#btnResetDemo'); if(b && !b.dataset.confirm) b.innerHTML = icon('refresh','w-4 h-4') + demoButtonLabel(); }
$('#btnResetDemo').addEventListener('click', function(){
  if(!this.dataset.confirm){
    this.dataset.confirm = '1';
    this.innerHTML = icon('alert','w-4 h-4') + (state.products.some(p => p.demo) ? 'Confirmar remoção?' : 'Confirmar?');
    setTimeout(() => { if(this.isConnected && this.dataset.confirm){ delete this.dataset.confirm; updateDemoButton(); } }, 2800);
    return;
  }
  delete this.dataset.confirm;
  if(state.products.some(p => p.demo)){
    state.products = state.products.filter(p => !p.demo);
    toast('Produtos de exemplo removidos');
  } else {
    state.products = [...state.products, ...demoProducts().filter(d => !state.products.some(p => p.id === d.id))];
    toast('Produtos de exemplo carregados');
  }
  persist(); closeModal($('#feesModal')); closeDrawer(); renderAll();
});
$$('#feesModal [data-fclose]').forEach(el => el.addEventListener('click', () => closeModal($('#feesModal'))));
$('#btnFees').addEventListener('click', openFees);

/* ---------- AI modal ---------- */
const aiModal = $('#aiModal');
const STEP_DEFS = [
  'Buscando anúncios no Mercado Livre',
  'Analisando preços, vendas e avaliações',
  'Mapeando concorrentes e tendências de mercado',
  'Gerando faixa e recomendação de preço'
];
$('#aiChips').innerHTML = ['fone bluetooth earbuds','luminária smart wifi','caneca térmica','organizador de madeira','kit skincare vitamina c'].map(s => \`<button class="chip" data-chip="\${s}">\${s}</button>\`).join('');
$$('#aiChips .chip').forEach(c => c.addEventListener('click', () => { $('#aiInput').value = c.dataset.chip; runAnalysis(); }));

function openAI(pid){
  AI_CTX = { productId: pid || null };
  const p = pid ? state.products.find(x => x.id === pid) : null;
  $('#aiInput').value = p ? p.name : '';
  $('#aiSearchView').hidden = false;
  $('#aiLoadingView').hidden = true;
  $('#aiResultsView').hidden = true;
  openModal(aiModal);
  setTimeout(() => $('#aiInput').focus(), 250);
}
function closeAI(){ aiToken++; closeModal(aiModal); }
$$('#aiModal [data-aclose]').forEach(el => el.addEventListener('click', closeAI));

$('#aiRunBtn').addEventListener('click', runAnalysis);
$('#aiInput').addEventListener('keydown', e => { if(e.key === 'Enter') runAnalysis(); });

async function runAnalysis(){
  const q = $('#aiInput').value.trim();
  if(!q){ $('#aiInput').classList.add('err'); setTimeout(() => $('#aiInput').classList.remove('err'), 600); $('#aiInput').focus(); return; }
  const p = AI_CTX.productId ? state.products.find(x => x.id === AI_CTX.productId) : null;
  const cost = p ? unitCost(p) : 0;
  const mlCommission = state.marketplaces.find(m => m.id === 'ml')?.commission ?? 11.9;
  const token = ++aiToken;
  $('#aiSearchView').hidden = true;
  $('#aiResultsView').hidden = true;
  $('#aiLoadingView').hidden = false;
  $('#aiSteps').innerHTML = STEP_DEFS.map((s,i) => \`<div class="step" id="step-\${i}"><span class="st-ic"><span class="spin"></span></span><span>\${s}</span></div>\`).join('');
  $('#aiSkel').innerHTML = Array.from({length:6}, () => '<div class="skel h-[92px]"></div>').join('');

  STEP_DEFS.forEach((_, i) => {
    setTimeout(() => {
      if(token !== aiToken) return;
      const s = $('#step-' + i);
      if(s){ s.classList.add('show');
        setTimeout(() => { if(token !== aiToken) return; s.classList.add('done'); s.querySelector('.st-ic').innerHTML = icon('check','w-3.5 h-3.5'); }, 300);
      }
    }, i * 400);
  });
  try {
    const params = new URLSearchParams({ q, cost: String(cost), commission: String(mlCommission), target: String(Math.round(targetMargin*100)) });
    const response = await fetch('/api/market/research?' + params);
    const result = await response.json();
    if(!response.ok) throw new Error(result.error || 'Não foi possível consultar o mercado agora.');
    if(token !== aiToken) return;
    LAST_AI = result;
    LAST_AI.productId = p ? p.id : null;
    renderAIResults();
  } catch(error) {
    if(token !== aiToken) return;
    $('#aiLoadingView').hidden = true;
    $('#aiSearchView').hidden = false;
    toast(error.message, 'rose');
  }
}

function renderAIResults(){
  const r = LAST_AI;
  $('#aiLoadingView').hidden = true;
  $('#aiResultsView').hidden = false;
  const st = r.stats;
  const p = r.productId ? state.products.find(x => x.id === r.productId) : null;
  let your = null;
  if(p){ const c = compute(p); if(c.active.length){ let m = Infinity; c.active.forEach(x => { if(x.price < m) m = x.price; }); your = m; } }
  const posPct = your ? Math.round((your / st.avg - 1) * 100) : null;

  const lo = st.min * 0.75, hi = st.max * 1.18;
  const X = v => clamp(((v - lo) / (hi - lo)) * 100, 1, 99);

  const comps = r.comps.map((c, i) => {
    const h = hueOf(c.seller);
    return \`<div class="comp-card" style="animation-delay:\${i * 60}ms">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="comp-av" style="--h:\${h}">\${esc(c.seller.charAt(0).toUpperCase())}</span>
          <div class="min-w-0">
            <div class="text-[13px] font-semibold truncate" title="\${esc(c.title || c.seller)}">\${esc(c.title || c.seller)}</div>
            <div class="text-[11.5px] text-[var(--muted)] flex items-center gap-1 mt-0.5">\${esc(c.seller)}\${c.sold ? \` · \${soldFmt(c.sold)} vendidos\` : ''}</div>
          </div>
        </div>
        <div class="text-[14px] font-bold font-display flex-none" style="font-variant-numeric:tabular-nums">\${brl(c.price)}</div>
      </div>
      <div class="flex gap-1.5 mt-3 flex-wrap">
        \${c.shipFree ? \`<span class="tag tag-em">\${icon('truck')}Frete grátis</span>\` : \`<span class="tag tag-am">\${icon('truck')}Frete \${brl(c.ship)}</span>\`}
        \${c.trend ? (c.trend > 0 ? \`<span class="tag tag-em">\${icon('trendUp')}\${c.trend}%</span>\` : \`<span class="tag tag-ro">\${icon('trendDown')}\${Math.abs(c.trend)}%</span>\`) : ''}
        <span class="tag tag-bl">#\${i + 1} em busca</span>
      </div>
    </div>\`;
  }).join('');

  let why;
  if(posPct === null){
    why = \`Concorrentes vendem a partir de <b style="color:var(--text)">\${brl(st.min)}</b> com média de <b style="color:var(--text)">\${brl(st.avg)}</b> no período. Posicionar em <b class="t-pos">\${brl(r.rec.point)}</b> equilibra lucro e competitividade.\`;
  } else if(posPct > 5){
    why = \`Seu preço está <b class="t-neg">\${posPct}% acima</b> do preço médio dos concorrentes. Reajuste para <b class="t-pos">\${brl(r.rec.point)}</b> deve recuperar a taxa de conversão e aumentar o giro.\`;
  } else if(posPct < -5){
    why = \`Seu preço está <b class="t-pos">\${Math.abs(posPct)}% abaixo</b> do médio — há margem para subir até <b style="color:var(--text)">\${brl(r.rec.point)}</b> sem perder vendas.\`;
  } else {
    why = \`Seu preço está <b style="color:var(--text)">alinhado ao mercado</b>. Manter <b class="t-pos">\${brl(r.rec.point)}</b> garante boa rotação e margem consistente.\`;
  }
  if(r.trend) why += r.trend > 0
    ? \` Mercado em tendência de <b class="t-pos">alta (+\${r.trend}% em 30d)</b>.\`
    : \` Mercado em correção (<b class="t-warn">\${r.trend}% em 30d</b>).\`;

  $('#aiResultBody').innerHTML = \`
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[14px] font-display font-bold">“\${esc(r.q)}”</span>
      <span class="tag tag-em">\${icon('check')}Análise concluída</span>
      <span class="text-[11.5px] text-[var(--faint)]">\${timeAgo(r.when)} · \${r.comps.length} concorrentes analisados</span>
      \${posPct !== null ? \`<span class="tag \${posPct > 5 ? 'tag-ro' : posPct < -5 ? 'tag-em' : 'tag-am'}">Seu preço \${posPct > 0 ? '+' : ''}\${posPct}% vs. média</span>\` : ''}
    </div>

    <div class="stat-strip mt-4">
      <div class="stat-cell"><div class="l">Preço médio</div><div class="v">\${brl(st.avg)}</div></div>
      <div class="stat-cell"><div class="l">Menor preço</div><div class="v t-pos">\${brl(st.min)}</div></div>
      <div class="stat-cell"><div class="l">Maior preço</div><div class="v">\${brl(st.max)}</div></div>
      <div class="stat-cell"><div class="l">Amostra real</div><div class="v t-pos">\${r.sampleSize || r.comps.length} anúncios</div></div>
    </div>

    <div class="dist">
      <div class="dist-track">
        <div class="dist-band" style="left:\${X(r.rec.low)}%; width:\${Math.max(2, X(r.rec.high) - X(r.rec.low))}%"></div>
        <div class="dist-tick" style="left:\${X(st.min)}%"></div>
        <div class="dist-tick" style="left:\${X(st.avg)}%"></div>
        <div class="dist-tick" style="left:\${X(st.max)}%"></div>
        \${your !== null ? \`<div class="dist-you" style="left:\${X(your)}%"><span class="flag">VOCÊ \${brl(your)}</span><span class="stem"></span><span class="tip"></span></div>\` : ''}
        <span class="dist-lab" style="left:\${X(st.min)}%">\${brl(st.min)}</span>
        <span class="dist-lab" style="left:\${X(st.avg)}%">média</span>
        <span class="dist-lab" style="left:\${X(st.max)}%">\${brl(st.max)}</span>
      </div>
      <div class="h-5"></div>
    </div>

    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-2">\${comps}</div>

    <div class="rec-box mt-4">
      <div class="flex items-center gap-2 font-semibold text-[13px]" style="color:var(--volt)">\${icon('sparkles','w-4 h-4')} Preço recomendado pela IA</div>
      <div class="flex flex-wrap items-end gap-x-4 gap-y-1 mt-1.5">
        <span class="font-display text-[30px] font-bold leading-none tracking-tight">\${brl(r.rec.point)}</span>
        <span class="text-[12px] text-[var(--muted)]">Faixa segura: \${brl(r.rec.low)} – \${brl(r.rec.high)} · preço médio: \${brl(st.avg)}</span>
      </div>
      <p class="text-[12.5px] leading-relaxed text-[var(--muted)] mt-2.5">\${why}</p>
    </div>
    <p class="text-[10.5px] text-[var(--faint)] mt-3 text-center">Análise baseada em \${r.sampleSize || r.comps.length} ofertas vencedoras de produtos do catálogo · Consulte as ofertas antes de alterar preços</p>\`;

  $('#aiProductSelect').innerHTML = state.products.map(pp => \`<option value="\${esc(pp.id)}" \${p && pp.id === p.id ? 'selected' : ''}>\${esc(pp.name)} — \${esc(pp.sku)}</option>\`).join('');
}
$('#aiAgain').addEventListener('click', () => { $('#aiResultsView').hidden = true; $('#aiSearchView').hidden = false; $('#aiInput').focus(); });
$('#aiApplyBtn').addEventListener('click', () => {
  if(!LAST_AI) return;
  const p = state.products.find(x => x.id === $('#aiProductSelect').value);
  if(!p) return;
  const price = LAST_AI.rec.point;
  let any = false;
  state.marketplaces.forEach(m => { if(p.prices[m.id] !== null && p.prices[m.id] > 0){ p.prices[m.id] = price; any = true; } });
  if(!any) p.prices.ml = price;
  p.ai = LAST_AI;
  persist(); renderAll(); closeAI();
  if(openId === p.id){ draft = clone(p); $('#drawerContent').innerHTML = drawerHTML(draft, false); hydrateIcons($('#drawerContent')); refreshDrawer(); }
  toast(\`Preço de \${brl(price)} aplicado — \${p.name}\`);
});

/* ---------- Mercado Livre listings & bulk promotions ---------- */
let mlListings = [];
let mlListingsLoaded = false;
let mlListingsLoading = false;
const mlSelected = new Set();

function findLocalProduct(listing){
  const linked = state.products.find(product => product.mlItemId === listing.id);
  if(linked) return linked;
  const sku = String(listing.sku || '').trim().toLowerCase();
  if(sku){
    const bySku = state.products.find(product => String(product.sku || '').trim().toLowerCase() === sku);
    if(bySku) return bySku;
  }
  const title = String(listing.title || '').toLowerCase();
  return state.products.find(product => title.includes(String(product.name || '').toLowerCase()) || String(product.name || '').toLowerCase().includes(title)) || null;
}

function listingStatus(item){
  if(item.status === 'active') return '<span class="status-badge st-green">ATIVO</span>';
  if(item.status === 'paused') return '<span class="status-badge st-amber">PAUSADO</span>';
  return \`<span class="status-badge">\${esc(item.status || '—').toUpperCase()}</span>\`;
}

function updateMlSelection(){
  $('#mlSelectedCount').textContent = \`(\${mlSelected.size})\`;
  $('#btnBulkPromo').disabled = mlSelected.size === 0;
  const visible = filteredMlListings();
  $('#mlSelectAll').checked = visible.length > 0 && visible.every(item => mlSelected.has(item.id));
  $('#mlSelectAll').indeterminate = visible.some(item => mlSelected.has(item.id)) && !$('#mlSelectAll').checked;
}

function filteredMlListings(){
  const query = $('#mlListingSearch').value.trim().toLowerCase();
  return query ? mlListings.filter(item => \`\${item.id} \${item.title} \${item.sku}\`.toLowerCase().includes(query)) : mlListings;
}

function renderMlListings(){
  const items = filteredMlListings();
  $('#mlListingCount').textContent = \`\${mlListings.length} anúncio\${mlListings.length === 1 ? '' : 's'}\`;
  if(!items.length){
    $('#mlListingsBody').innerHTML = \`<tr><td colspan="7" class="!text-center !py-12 text-[var(--muted)]">\${mlListings.length ? 'Nenhum anúncio corresponde à busca.' : 'Nenhum anúncio ativo foi encontrado nesta conta.'}</td></tr>\`;
    updateMlSelection(); return;
  }
  $('#mlListingsBody').innerHTML = items.map(item => \`
    <tr>
      <td><input type="checkbox" data-ml-select="\${esc(item.id)}" \${mlSelected.has(item.id) ? 'checked' : ''} aria-label="Selecionar \${esc(item.title)}"></td>
      <td><div class="flex items-center gap-3 min-w-[310px]">
        \${item.thumbnail ? \`<img src="\${esc(item.thumbnail)}" alt="" class="w-11 h-11 rounded-lg object-cover bg-white">\` : '<div class="w-11 h-11 rounded-lg bg-[var(--surface-2)] grid place-items-center">—</div>'}
        <div><a href="\${esc(item.permalink || '#')}" target="_blank" rel="noopener" class="text-[12.5px] font-semibold hover:underline">\${esc(item.title)}</a><div class="text-[10.5px] text-[var(--faint)] mt-1">\${esc(item.id)}\${item.sku ? \` · SKU \${esc(item.sku)}\` : ''}</div>
          <button type="button" class="btn-volt-soft mt-1.5 inline-flex items-center gap-1" data-diagnose="\${esc(item.id)}">\${icon('target','w-3.5 h-3.5')}Diagnosticar</button></div>
      </div></td>
      <td><b>\${brl(item.price)}</b>\${item.originalPrice ? \`<div class="text-[10.5px] line-through text-[var(--faint)]">\${brl(item.originalPrice)}</div>\` : ''}</td>
      <td>\${fmtN(item.availableQuantity)}</td><td>\${fmtN(item.soldQuantity)}</td>
      <td><span class="text-[11.5px]">\${item.listingType === 'gold_pro' ? 'Premium' : item.listingType === 'gold_special' ? 'Clássico' : esc(item.listingType || '—')}</span></td>
      <td>\${listingStatus(item)}</td>
    </tr>\`).join('');
  $$('#mlListingsBody [data-diagnose]').forEach(button => button.addEventListener('click', () => openDiagnosis(button.dataset.diagnose)));
  $$('#mlListingsBody [data-ml-select]').forEach(input => input.addEventListener('change', () => {
    input.checked ? mlSelected.add(input.dataset.mlSelect) : mlSelected.delete(input.dataset.mlSelect);
    updateMlSelection();
  }));
  updateMlSelection();
}

async function loadMlListings(force = false){
  if(mlListingsLoading || (mlListingsLoaded && !force)) return;
  mlListingsLoading = true;
  $('#btnMlSync').disabled = true;
  $('#mlListingsBody').innerHTML = '<tr><td colspan="7" class="!text-center !py-12 text-[var(--muted)]">Sincronizando anúncios reais do Mercado Livre…</td></tr>';
  try{
    const response = await fetch('/api/ml/listings', { headers:{ accept:'application/json' } });
    const data = await response.json();
    if(!response.ok) throw Object.assign(new Error(data.error || 'Falha ao sincronizar anúncios.'), { code:data.code });
    mlListings = Array.isArray(data.items) ? data.items : [];
    mlListingsLoaded = true; mlSelected.clear();
    $('#mlSellerText').textContent = \`\${data.seller?.nickname || 'Conta conectada'} · \${data.paging?.total || mlListings.length} anúncio(s) ativo(s) · sincronizado agora\`;
    renderMlListings();
    toast(\`\${mlListings.length} anúncio(s) sincronizado(s) do Mercado Livre\`);
    if(data.unavailable) toast(\`\${data.unavailable} anúncio(s) não puderam ser carregados agora\`, 'err');
  }catch(error){
    $('#mlListingsBody').innerHTML = \`<tr><td colspan="7" class="!text-center !py-12"><div class="text-[var(--rose)] font-semibold">\${esc(error.message)}</div><a href="/conectar/mercadolivre" class="inline-block mt-3 text-[12px] font-bold" style="color:var(--volt)">Conectar novamente</a></td></tr>\`;
    toast(error.message, 'err');
  }finally{
    mlListingsLoading = false; $('#btnMlSync').disabled = false;
  }
}

/* ---------- Anúncios da Shopee e do TikTok Shop ---------- */
// Cada canal usa os elementos #<prefixo>ListingsBody, #<prefixo>ListingSearch, #<prefixo>ListingCount e #<prefixo>ShopText.
function marketplaceListings({ prefix, name, endpoint, connectUrl, syncButton, showSales }){
  const channel = { items: [], loaded: false, loading: false };
  const columns = showSales ? 5 : 4;
  const body = () => $(\`#\${prefix}ListingsBody\`);

  function filtered(){
    const query = $(\`#\${prefix}ListingSearch\`).value.trim().toLowerCase();
    return query ? channel.items.filter(item => \`\${item.id} \${item.title} \${item.sku}\`.toLowerCase().includes(query)) : channel.items;
  }

  channel.render = function(){
    const items = filtered();
    $(\`#\${prefix}ListingCount\`).textContent = \`\${channel.items.length} anúncio\${channel.items.length === 1 ? '' : 's'}\`;
    if(!items.length){
      body().innerHTML = \`<tr><td colspan="\${columns}" class="!text-center !py-12 text-[var(--muted)]">\${channel.items.length ? 'Nenhum anúncio corresponde à busca.' : 'Nenhum anúncio ativo foi encontrado nesta loja.'}</td></tr>\`;
      return;
    }
    body().innerHTML = items.map(item => \`
      <tr>
        <td><div class="flex items-center gap-3 min-w-[310px]">
          \${item.thumbnail ? \`<img src="\${esc(item.thumbnail)}" alt="" class="w-11 h-11 rounded-lg object-cover bg-white">\` : '<div class="w-11 h-11 rounded-lg bg-[var(--surface-2)] grid place-items-center">—</div>'}
          <div>\${item.permalink ? \`<a href="\${esc(item.permalink)}" target="_blank" rel="noopener" class="text-[12.5px] font-semibold hover:underline">\${esc(item.title)}</a>\` : \`<span class="text-[12.5px] font-semibold">\${esc(item.title)}</span>\`}<div class="text-[10.5px] text-[var(--faint)] mt-1">\${esc(item.id)}\${item.sku ? \` · SKU \${esc(item.sku)}\` : ''}</div></div>
        </div></td>
        <td>\${item.hasVariations ? '<span class="text-[10.5px] text-[var(--faint)]">a partir de</span> ' : ''}<b>\${brl(item.price)}</b>\${item.originalPrice ? \`<div class="text-[10.5px] line-through text-[var(--faint)]">\${brl(item.originalPrice)}</div>\` : ''}</td>
        <td>\${fmtN(item.availableQuantity)}</td>\${showSales ? \`<td>\${fmtN(item.soldQuantity)}</td>\` : ''}
        <td>\${listingStatus(item)}</td>
      </tr>\`).join('');
  };

  channel.load = async function(force = false){
    if(channel.loading || (channel.loaded && !force)) return;
    channel.loading = true;
    $(syncButton).disabled = true;
    body().innerHTML = \`<tr><td colspan="\${columns}" class="!text-center !py-12 text-[var(--muted)]">Sincronizando anúncios reais do \${name}…</td></tr>\`;
    try{
      const response = await fetch(endpoint, { headers:{ accept:'application/json' } });
      const data = await response.json();
      if(!response.ok) throw Object.assign(new Error(data.error || 'Falha ao sincronizar anúncios.'), { code:data.code });
      channel.items = Array.isArray(data.items) ? data.items : [];
      channel.loaded = true;
      $(\`#\${prefix}ShopText\`).textContent = \`\${data.shop?.name || 'Loja conectada'} · \${data.paging?.total || channel.items.length} anúncio(s) ativo(s) · sincronizado agora\`;
      channel.render();
      toast(\`\${channel.items.length} anúncio(s) sincronizado(s) do \${name}\`);
      if(data.unavailable) toast(\`\${data.unavailable} anúncio(s) não puderam ser carregados agora\`, 'err');
    }catch(error){
      body().innerHTML = \`<tr><td colspan="\${columns}" class="!text-center !py-12"><div class="text-[var(--rose)] font-semibold">\${esc(error.message)}</div><a href="\${connectUrl}" class="inline-block mt-3 text-[12px] font-bold" style="color:var(--volt)">Conectar \${name}</a></td></tr>\`;
      toast(error.message, 'err');
    }finally{
      channel.loading = false; $(syncButton).disabled = false;
    }
  };

  $(syncButton).addEventListener('click', () => channel.load(true));
  $(\`#\${prefix}ListingSearch\`).addEventListener('input', channel.render);
  return channel;
}

const shopeeChannel = marketplaceListings({ prefix:'shopee', name:'Shopee', endpoint:'/api/shopee/listings', connectUrl:'/conectar/shopee', syncButton:'#btnShopeeSync', showSales:true });
// A busca de produtos do TikTok Shop não informa vendas.
const tiktokChannel = marketplaceListings({ prefix:'tiktok', name:'TikTok Shop', endpoint:'/api/tiktok/listings', connectUrl:'/conectar/tiktok', syncButton:'#btnTiktokSync', showSales:false });

// Shopee, TikTok Shop e a foto com IA só aparecem depois que as credenciais estiverem configuradas no servidor.
// Telas montadas depois (ex.: assets/purchase.js) chamam revealIntegrations() de novo.
const integrations = {};
function revealIntegrations(root){
  (root || document).querySelectorAll('[data-integration]').forEach(element => { if(integrations[element.dataset.integration]) element.hidden = false; });
}
fetch('/api/health', { headers:{ accept:'application/json' } })
  .then(response => response.ok ? response.json() : null)
  .then(health => {
    Object.assign(integrations, { shopee: health?.integrations?.shopeeConfigured, tiktok: health?.integrations?.tiktokConfigured, vision: health?.integrations?.visionConfigured });
    revealIntegrations();
  })
  .catch(() => {});

/* ---------- Importar anúncios do Mercado Livre como produtos ---------- */
async function importMlProducts(){
  const button = $('#btnImportMl');
  button.disabled = true;
  try{
    await loadMlListings(true);
    if(!mlListingsLoaded) return;
    let added = 0, updated = 0;
    mlListings.forEach((item, index) => {
      const sku = String(item.sku || '').trim().toLowerCase();
      const existing = state.products.find(p => p.mlItemId === item.id)
        || (sku && state.products.find(p => !p.mlItemId && !p.demo && String(p.sku || '').trim().toLowerCase() === sku));
      if(existing){
        existing.mlItemId = item.id;
        existing.prices.ml = item.price > 0 ? item.price : existing.prices.ml;
        existing.stock = Math.max(0, Math.round(item.availableQuantity || 0));
        updated++;
        return;
      }
      state.products.unshift({
        id: 'p' + Date.now().toString(36) + index, name: item.title, category: 'Mercado Livre', sku: item.sku || item.id,
        type: 'buy', buyCost: 0, materials: 0, labor: 0, overhead: 0, hours: 0, freight: 0, packaging: 0,
        stock: Math.max(0, Math.round(item.availableQuantity || 0)),
        prices: { ml: item.price > 0 ? item.price : null, shopee: null, tiktok: null, amazon: null },
        ai: null, mlItemId: item.id
      });
      added++;
    });
    persist(); renderAll();
    toast(added ? \`\${added} produto(s) importado(s)\${updated ? \`, \${updated} atualizado(s)\` : ''} — informe o custo de cada um\` : \`\${updated} produto(s) atualizado(s) com preço e estoque do Mercado Livre\`);
    $('#productsSec').scrollIntoView({ behavior: 'smooth' });
  }finally{
    button.disabled = false;
  }
}
$('#btnImportMl').addEventListener('click', importMlProducts);

function isoLocal(date){
  const shifted = new Date(date.getTime() - date.getTimezoneOffset()*60000);
  return shifted.toISOString().slice(0,10);
}

function selectedMlItems(){ return mlListings.filter(item => mlSelected.has(item.id)); }

function renderPromoPreview(){
  const discount = clamp(Number($('#promoDiscount').value) || 0, 0, 100);
  const commission = state.marketplaces.find(marketplace => marketplace.id === 'ml')?.commission || 11.9;
  $('#promoPreview').innerHTML = selectedMlItems().map(item => {
    const promoPrice = Math.round(item.price * (1 - discount/100) * 100) / 100;
    const local = findLocalProduct(item);
    const cost = local ? unitCost(local) : null;
    const profit = cost === null ? null : promoPrice * (1 - commission/100) - cost;
    const margin = profit === null || promoPrice <= 0 ? null : profit / promoPrice * 100;
    return \`<div class="px-4 py-3 border-b border-[var(--border)] last:border-0 flex flex-wrap items-center gap-3">
      <div class="flex-1 min-w-[220px]"><div class="text-[12px] font-semibold truncate">\${esc(item.title)}</div><div class="text-[10.5px] text-[var(--faint)] mt-1">\${esc(item.id)}</div></div>
      <div class="text-right"><div class="text-[10px] text-[var(--faint)]">PREÇO</div><div class="text-[12px]"><span class="line-through text-[var(--faint)]">\${brl(item.price)}</span> → <b style="color:var(--volt)">\${brl(promoPrice)}</b></div></div>
      <div class="text-right min-w-[90px]"><div class="text-[10px] text-[var(--faint)]">MARGEM</div><div class="text-[12px] font-bold \${margin !== null && margin < 0 ? 't-neg' : margin !== null ? 't-pos' : 'text-[var(--muted)]'}">\${margin === null ? 'custo ausente' : fmtPct1(margin)}</div></div>
    </div>\`;
  }).join('');
}

function openPromoModal(){
  if(!mlSelected.size) return;
  const today = new Date(); const finish = new Date(today); finish.setDate(finish.getDate()+6);
  $('#promoStart').value = isoLocal(today); $('#promoFinish').value = isoLocal(finish);
  $('#promoStart').min = isoLocal(today); $('#promoFinish').min = isoLocal(today);
  $('#promoSelectionText').textContent = \`\${mlSelected.size} anúncio(s) selecionado(s) · desconto individual em lote\`;
  renderPromoPreview(); openModal($('#promoModal'));
}

function closePromoModal(){ closeModal($('#promoModal')); }
$$('#promoModal [data-pclose]').forEach(element => element.addEventListener('click', closePromoModal));
['promoDiscount','promoStart','promoFinish'].forEach(id => $('#'+id).addEventListener('input', renderPromoPreview));
$('#btnBulkPromo').addEventListener('click', openPromoModal);
$('#btnMlSync').addEventListener('click', () => loadMlListings(true));
$('#mlListingSearch').addEventListener('input', renderMlListings);
$('#mlSelectAll').addEventListener('change', event => {
  filteredMlListings().slice(0,50).forEach(item => event.target.checked ? mlSelected.add(item.id) : mlSelected.delete(item.id));
  renderMlListings();
});
$('#btnConfirmPromo').addEventListener('click', async () => {
  const button = $('#btnConfirmPromo');
  const payload = { itemIds:[...mlSelected], discount:Number($('#promoDiscount').value), startDate:$('#promoStart').value, finishDate:$('#promoFinish').value };
  if(payload.discount < 5 || payload.discount > 80){ toast('Informe um desconto entre 5% e 80%.','err'); return; }
  button.disabled = true; button.innerHTML = \`\${icon('refresh','w-4 h-4 animate-spin')} Aplicando…\`;
  try{
    const response = await fetch('/api/ml/promotions/apply', { method:'POST', headers:{'content-type':'application/json','accept':'application/json'}, body:JSON.stringify(payload) });
    const data = await response.json();
    if(!response.ok) throw new Error(data.error || 'Não foi possível aplicar a promoção.');
    (data.results || []).filter(result => result.ok).forEach(result => mlSelected.delete(result.itemId));
    if(data.applied) toast(\`Promoção aplicada em \${data.applied} anúncio(s)\`);
    if(data.failed) toast(\`\${data.failed} anúncio(s) foram recusados pelo Mercado Livre\`, 'err');
    closePromoModal(); await loadMlListings(true);
  }catch(error){ toast(error.message, 'err'); }
  finally{ button.disabled=false; button.innerHTML=\`\${icon('check','w-4 h-4')} Aplicar promoção no Mercado Livre\`; }
});

/* ---------- Header / nav events ---------- */
$('#globalSearch').addEventListener('input', e => { ui.query = e.target.value; renderTable(); });
$('#btnMenu').addEventListener('click', () => { $('#sidebar').classList.remove('-translate-x-full'); $('#sideOverlay').hidden = false; });
$('#sideOverlay').addEventListener('click', () => { $('#sidebar').classList.add('-translate-x-full'); $('#sideOverlay').hidden = true; });

/* ---------- Views ---------- */
// Telas extras registram um \`open\` (ver assets/strategy.js); o painel é a tela padrão.
const VIEWS = {
  radar: { el: 'viewRadar', kicker: 'Inteligência', title: 'Radar de oportunidades' },
  analysis: { el: 'viewAnalysis', kicker: 'Inteligência', title: 'Análise estratégica de anúncio' },
  suppliers: { el: 'viewSuppliers', kicker: 'Compras', title: 'Catálogo de fornecedores' },
  compra: { el: 'viewPurchase', kicker: 'Compra', title: 'Vale a pena comprar?' },
  vendas: { el: 'viewSales', kicker: 'Mercado Livre', title: 'Minhas vendas' }
};
function showView(name){
  const view = VIEWS[name];
  $('#viewDashboard').hidden = Boolean(view);
  Object.values(VIEWS).forEach(v => { $('#' + v.el).hidden = v !== view; });
  $('#pageKicker').textContent = view ? view.kicker : 'Dashboard';
  $('#pageTitle').textContent = view ? view.title : 'Visão geral da loja';
  $('#headerSearch').classList.toggle('max-sm:hidden', Boolean(view));
  history.replaceState(null, '', view ? '#' + name : location.pathname + location.search);
  if(view && typeof view.open === 'function') view.open();
  if(view) window.scrollTo({ top: 0 });
}

$$('#mainNav .nav-item').forEach(item => item.addEventListener('click', () => {
  $$('#mainNav .nav-item').forEach(x => x.classList.remove('active'));
  item.classList.add('active');
  $('#sidebar').classList.add('-translate-x-full'); $('#sideOverlay').hidden = true;
  const nav = item.dataset.nav;
  if(nav !== 'ai' && nav !== 'fees') showView(VIEWS[nav] ? nav : 'dashboard');
  if(nav === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
  if(nav === 'products') $('#productsSec').scrollIntoView({ behavior: 'smooth' });
  if(nav === 'listings'){ $('#mlListingsSec').scrollIntoView({ behavior: 'smooth' }); loadMlListings(); }
  if(nav === 'shopee'){ $('#shopeeListingsSec').scrollIntoView({ behavior: 'smooth' }); shopeeChannel.load(); }
  if(nav === 'tiktok'){ $('#tiktokListingsSec').scrollIntoView({ behavior: 'smooth' }); tiktokChannel.load(); }
  if(nav === 'reports') $('#chartsSec').scrollIntoView({ behavior: 'smooth' });
  if(nav === 'ai') openAI();
  if(nav === 'fees') openFees();
}));
$('#btnNew').addEventListener('click', openNewProduct);
$('#btnNew2').addEventListener('click', openNewProduct);
$('#btnAITop').addEventListener('click', () => openAI());
$('#btnInsightAI').addEventListener('click', () => openAI());

$('#bellBtn').addEventListener('click', e => {
  e.stopPropagation();
  const p = $('#bellPanel');
  p.hidden = !p.hidden;
});
document.addEventListener('click', e => { if(!e.target.closest('#bellWrap')) $('#bellPanel').hidden = true; });

$('#btnExport').addEventListener('click', () => {
  const head = ['SKU','Produto','Categoria','Tipo','Estoque','Custo unitário','Frete','Embalagem', ...state.marketplaces.map(m => m.name + ' (preço)'), 'Melhor margem (%)'];
  const n2 = v => v.toFixed(2).replace('.', ',');
  const csvCell = value => {
    let text = String(value ?? '');
    if (/^[=+\\-@]/.test(text)) text = "'" + text;
    return \`"\${text.replace(/"/g, '""')}"\`;
  };
  const lines = [head.map(csvCell).join(';')];
  state.products.forEach(p => {
    const c = compute(p);
    lines.push([p.sku, p.name, p.category, p.type === 'buy' ? 'Comprado' : 'Produção', p.stock, n2(c.cost), n2(p.freight), n2(p.packaging),
      ...state.marketplaces.map(m => (p.prices[m.id] > 0 ? n2(p.prices[m.id]) : '')),
      c.best ? n2(c.best.margin * 100) : ''].map(csvCell).join(';'));
  });
  const blob = new Blob(['\\uFEFF' + lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'margemIQ_produtos.csv';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Arquivo CSV exportado');
});

document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  if(aiModal.classList.contains('open')) closeAI();
  else if($('#feesModal').classList.contains('open')) closeModal($('#feesModal'));
  else if(drawerEl.classList.contains('open')) closeDrawer();
});

/* ---------- Boot ---------- */
(function boot(){
  hydrateIcons();
  const d = new Date();
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  $('#topDate').textContent = \`\${dias[d.getDay()]}, \${d.getDate()} \${MESES[d.getMonth()]} \${d.getFullYear()}\`;
  initCharts();
  renderAll();
})();
</script>
<script src="/assets/purchase.js"></script>
<script src="/assets/sales.js"></script>
<script src="/assets/diagnosis.js"></script>
<script src="/assets/strategy.js"></script>
<script src="/assets/quotes.js"></script>
<script src="/assets/suppliers.js"></script>
<script src="/assets/account.js"></script>
</body>
</html>
`;
