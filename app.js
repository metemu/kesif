(function() {

// ── Harita başlat ────────────────────────────────────────────
var map = L.map("map", {zoomControl: false}).setView([40.72, 29.75], 10);
L.control.zoom({position:"bottomright"}).addTo(map);
L.control.scale({imperial:false, position:"bottomleft"}).addTo(map);

// Tile katmanları — sırayla dene
var TILE_PROVIDERS = [
  {url:"https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png", opts:{maxZoom:20, attribution:"Stadia Maps, OSM"}},
  {url:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",               opts:{maxZoom:19, attribution:"OpenStreetMap"}},
  {url:"https://tile.openstreetmap.de/{z}/{x}/{y}.png",                    opts:{maxZoom:18, attribution:"OpenStreetMap DE"}}
];
var tileIdx = 0;
var tileLayer = null;

function loadTile(idx) {
  if (idx >= TILE_PROVIDERS.length) return;
  if (tileLayer) map.removeLayer(tileLayer);
  var tp = TILE_PROVIDERS[idx];
  var errCount = 0;
  tileLayer = L.tileLayer(tp.url, tp.opts);
  tileLayer.on("tileerror", function() {
    errCount++;
    if (errCount >= 3 && idx < TILE_PROVIDERS.length - 1) {
      tileIdx = idx + 1;
      loadTile(tileIdx);
    }
  });
  tileLayer.addTo(map);
  tileLayer.bringToBack();
}
loadTile(0);

// ── Rota çizgisi ─────────────────────────────────────────────
var routeCoords = PTS.map(function(p) { return [p.lat, p.lon]; });
var routeBg   = L.polyline(routeCoords, {color:"#fff",    weight:7, opacity:0.8}).addTo(map);
var routeLine = L.polyline(routeCoords, {color:"#f59e0b", weight:3, opacity:0.95, dashArray:"8,5"}).addTo(map);
routeBg.bringToBack();

// ── Marker ikonları ───────────────────────────────────────────
function makeIcon(p) {
  var isCon = CONSTRAINED[p.step] || false;
  var special = p.is_start || p.is_return;
  var sz = special ? 34 : (p.stay_min === 15 ? 28 : 20);
  var fs = special ? 13 : (p.stay_min === 15 ? 10 : 8);
  var lbl = p.is_start ? "S" : (p.is_return ? "R" : String(p.step));
  var extraCls = isCon ? " cm-con" : "";
  var html = '<div class="cm' + extraCls + '" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + fs + 'px;background:' + p.color + '">' + lbl + '</div>';
  return L.divIcon({className:"", html:html, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-sz/2-4]});
}

// ── Popup HTML ────────────────────────────────────────────────
function makePopup(p) {
  var isCon = CONSTRAINED[p.step] || false;
  var loc = p.is_start || p.is_return
    ? "Kocaeli Idare Mahkemesi"
    : [p.ilce, p.mahalle].filter(Boolean).join(" / ");
  var badge = p.is_start ? "S" : (p.is_return ? "R" : String(p.step));
  var sub = p.is_start ? "BASLANGIC"
    : p.is_return ? "DONUS"
    : p.step + ". Durak" + (p.stay_min === 0 ? " (Grup ici)" : "") + (isCon ? " - Kisitli" : "");

  var rows = "";
  if (!p.is_start && !p.is_return) {
    if (p.esas_no)                          rows += pr("Esas No",   p.esas_no);
    if (p.ilce)                             rows += pr("Ilce",      p.ilce);
    if (p.mahalle)                          rows += pr("Mahalle",   p.mahalle);
    if (p.ada && p.ada !== "nan" && p.ada)  rows += pr("Ada/Pars.", p.ada + (p.parsel && p.parsel !== "-" ? " / " + p.parsel : ""));
                                            rows += pr("Varis",     p.varis);
    if (p.cikis)                            rows += pr("Cikis",     p.cikis);
                                            rows += pr("Bekleme",   p.stay_min === 0 ? "Grup ici" : p.stay_min + " dk");
    if (p.yol_km)                           rows += pr("Mesafe",    p.yol_km + " km");
  } else {
    rows += pr("Adres", "Dogan Baris Cd. No:2, Izmit");
    rows += pr(p.is_start ? "Cikis" : "Varis", p.is_start ? "09:00" : "17:26");
  }

  var btn = (p.gmaps && p.gmaps.length > 10)
    ? '<a class="gb" href="' + p.gmaps + '" target="_blank">Google Maps</a>'
    : '<a class="gb off">Harita linki yok</a>';

  return '<div class="ph" style="background:' + p.color + '18;border-bottom:2px solid ' + p.color + '44">'
    + '<div class="pbadge" style="background:' + p.color + '">' + badge + '</div>'
    + '<div><div class="ptitle">' + xe(loc) + '</div><div class="psub">' + sub + '</div></div></div>'
    + '<div class="pb">' + rows + '</div>'
    + '<div class="pf">' + btn + '</div>';
}

function pr(k, v) {
  return '<div class="pr"><span class="pk">' + k + '</span><span class="pv">' + xe(String(v)) + '</span></div>';
}
function xe(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Markerlar ─────────────────────────────────────────────────
var markers = [];
var activeItem = null;

PTS.forEach(function(p, i) {
  var m = L.marker([p.lat, p.lon], {icon: makeIcon(p)}).addTo(map);
  m.bindPopup(makePopup(p), {className:"lpop", maxWidth:280, minWidth:240});
  m.on("click", function() { hlItem(i); });
  markers.push(m);
});

function hlItem(i) {
  if (activeItem) activeItem.classList.remove("on");
  var li = document.getElementById("ri" + i);
  if (li) { li.classList.add("on"); li.scrollIntoView({block:"nearest", behavior:"smooth"}); activeItem = li; }
}

// ── Sidebar listesi ───────────────────────────────────────────
var listEl = document.getElementById("list");
PTS.forEach(function(p, i) {
  var isCon = CONSTRAINED[p.step] || false;
  var loc = p.is_start ? "Kocaeli Idare Mahkemesi"
    : p.is_return ? "Kocaeli Idare Mahkemesi (Donus)"
    : [p.ilce, p.mahalle].filter(Boolean).join(" / ");
  var ap = (!p.is_start && !p.is_return && p.ada && p.ada !== "nan" && p.ada !== "")
    ? "Ada:" + p.ada + (p.parsel && p.parsel !== "-" && p.parsel !== "" ? " Par:" + p.parsel : "") : "";
  var isGrp = !p.is_start && !p.is_return && p.stay_min === 0;
  var lbl = p.is_start ? "S" : (p.is_return ? "R" : p.step);

  var d = document.createElement("div");
  d.className = "ri" + (isGrp ? " grp" : "") + (isCon ? " con" : "");
  d.id = "ri" + i;

  var meta = "";
  if (p.esas_no) meta += '<span class="chip">' + p.esas_no + '</span>';
  if (ap)        meta += '<span class="chip">' + ap + '</span>';

  var b2 = isCon ? '<span class="conb">kisitli</span>'
    : isGrp ? '<span class="grpb">grup ici</span>'
    : (p.yol_km ? '<span class="idk">+' + p.yol_km + 'km</span>' : "");

  d.innerHTML =
    '<div class="sc"><div class="sb2" style="background:' + p.color + '">' + lbl + '</div><div class="sl2"></div></div>' +
    '<div class="ib">' +
      '<div class="it"><span class="itm">' + p.varis + (p.cikis ? " > " + p.cikis : "") + '</span>' + b2 + '</div>' +
      '<div class="il">' + xe(loc) + '</div>' +
      '<div class="im">' + meta + '</div>' +
    '</div>';

  d.addEventListener("click", function() {
    map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), 14), {duration:0.5});
    setTimeout(function() { markers[i].openPopup(); hlItem(i); }, 300);
  });
  listEl.appendChild(d);
});

// ── Kontroller ────────────────────────────────────────────────
var rotaVisible = true;
window.togRota = function() {
  rotaVisible = !rotaVisible;
  if (rotaVisible) { routeLine.addTo(map); routeBg.addTo(map); routeBg.bringToBack(); }
  else             { map.removeLayer(routeLine); map.removeLayer(routeBg); }
  document.getElementById("br").classList.toggle("on", rotaVisible);
};

window.fitAll = function() {
  var lats = PTS.map(function(p){return p.lat;});
  var lons = PTS.map(function(p){return p.lon;});
  map.fitBounds([
    [Math.min.apply(null,lats)-0.03, Math.min.apply(null,lons)-0.03],
    [Math.max.apply(null,lats)+0.03, Math.max.apply(null,lons)+0.03]
  ]);
};

window.swTab = function(tab, el) {
  document.querySelectorAll(".tab").forEach(function(t){ t.classList.remove("on"); });
  el.classList.add("on");
  document.getElementById("list").style.display = tab === "list" ? "block" : "none";
  document.getElementById("leg").style.display  = tab === "leg"  ? "block" : "none";
};

})();
