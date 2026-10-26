import { PANNELLUM_CSS, PANNELLUM_JS } from "@/components/vista360/pannellum-fuente";
import { TipoVista360 } from "@/lib/vista360-reglas";

/* ---------------------------------------------------------------------------
 * Página HTML del visor 360 (se carga en un WebView)
 * Pannellum va embebido, sin CDN. Mensajes hacia React Native:
 *   { tipo: "listo" }            panorama cargado y visible
 *   { tipo: "interaccion" }      primer toque del usuario
 *   { tipo: "error", mensaje }   no se pudo cargar o componer
 * ------------------------------------------------------------------------- */

export type ConfigHtmlVisor = {
  tipo: TipoVista360;
  // URLs https o data URI, ya en orden
  fuentes: string[];
  // Color de fondo (hex del tema)
  fondo: string;
  // Solo panorámica: campo de visión horizontal y vertical en grados
  campo?: { haov: number; vaov: number };
  giroAutomatico: boolean;
};

// El JSON va dentro de <script>: se escapa "<" para que no cierre la etiqueta
function jsonSeguro(valor: unknown) {
  return JSON.stringify(valor).replace(/</g, "\\u003c");
}

export function crearHtmlVisor(config: ConfigHtmlVisor) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>${PANNELLUM_CSS}</style>
<style>
  html, body, #panorama { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  body { background: ${config.fondo}; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  #panorama { background: ${config.fondo}; }
  /* La carga, los errores y los controles los dibuja React Native */
  .pnlm-load-box, .pnlm-error-msg, .pnlm-about-msg, .pnlm-controls-container { display: none !important; }
</style>
<script>${PANNELLUM_JS}</script>
</head>
<body>
<div id="panorama"></div>
<script>
(function () {
  var C = ${jsonSeguro(config)};
  var ANCHO = 4096, ALTO = 2048;

  function enviar(mensaje) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(mensaje));
  }
  function fallar(error) {
    var div = document.createElement("div");
    div.innerHTML = String((error && error.message) || error || "Error desconocido");
    enviar({ tipo: "error", mensaje: div.textContent });
  }
  window.onerror = function (mensaje) { fallar(mensaje); };

  var tocado = false;
  function alInteractuar() {
    if (tocado) return;
    tocado = true;
    enviar({ tipo: "interaccion" });
  }
  document.addEventListener("touchstart", alInteractuar, { passive: true });
  document.addEventListener("mousedown", alInteractuar);

  function colorRGB(hex) {
    var n = parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // data URI -> blob: Pannellum pide la imagen por XHR y así no depende de data:
  function aUrlBlob(fuente) {
    if (fuente.indexOf("data:") !== 0) return fuente;
    var partes = fuente.split(",");
    var tipo = partes[0].split(":")[1].split(";")[0];
    var binario = atob(partes[1]);
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: tipo }));
  }

  function cargarImagen(fuente) {
    return new Promise(function (resolver, rechazar) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolver(img); };
      img.onerror = function () { rechazar(new Error("No se pudo cargar una de las fotos.")); };
      img.src = fuente;
    });
  }

  // ---- Collage: N fotos en anillo sobre un equirectangular de 4096x2048 ----

  // Color medio de todas las fotos (lanza SecurityError si alguna viene sin CORS)
  function colorMedio(imagenes) {
    var lienzo = document.createElement("canvas");
    lienzo.width = 8; lienzo.height = 8;
    var ctx = lienzo.getContext("2d");
    var suma = [0, 0, 0], cuenta = 0;
    imagenes.forEach(function (img) {
      ctx.clearRect(0, 0, 8, 8);
      ctx.drawImage(img, 0, 0, 8, 8);
      var datos = ctx.getImageData(0, 0, 8, 8).data;
      for (var i = 0; i < datos.length; i += 4) {
        suma[0] += datos[i]; suma[1] += datos[i + 1]; suma[2] += datos[i + 2];
        cuenta++;
      }
    });
    return suma.map(function (v) { return Math.round(v / cuenta); });
  }

  function rgb(c, factor) {
    return "rgb(" + c.map(function (v) { return Math.round(v * factor); }).join(",") + ")";
  }

  // Recorte tipo cover de la foto, con los bordes de arriba y abajo difuminados
  function recorte(img, ancho, alto, difuminado) {
    var lienzo = document.createElement("canvas");
    lienzo.width = ancho; lienzo.height = alto;
    var ctx = lienzo.getContext("2d");
    var escala = Math.max(ancho / img.naturalWidth, alto / img.naturalHeight);
    var sw = ancho / escala, sh = alto / escala;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, ancho, alto);
    ctx.globalCompositeOperation = "destination-in";
    var g = ctx.createLinearGradient(0, 0, 0, alto);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(difuminado / alto, "rgba(0,0,0,1)");
    g.addColorStop(1 - difuminado / alto, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ancho, alto);
    return lienzo;
  }

  // Dibuja en x y en sus copias a ±360° para que el anillo cierre
  function dibujarEnvuelto(ctx, fuente, sx, sw, dx, dy, alto) {
    [dx, dx - ANCHO, dx + ANCHO].forEach(function (x) {
      if (x + sw > 0 && x < ANCHO) ctx.drawImage(fuente, sx, 0, sw, alto, x, dy, sw, alto);
    });
  }

  function componerCollage(imagenes) {
    var n = imagenes.length;
    var lienzo = document.createElement("canvas");
    lienzo.width = ANCHO; lienzo.height = ALTO;
    var ctx = lienzo.getContext("2d");

    // Alto de la banda: proporción 3:4 por foto, entre 45° y 80°
    var grados = Math.min(80, Math.max(45, (360 / n) * 4 / 3));
    var alto = Math.round((grados / 180) * ALTO);
    var difuminado = Math.round(alto * 0.12);
    var altoTotal = alto + 2 * difuminado;
    var y = Math.round((ALTO - altoTotal) / 2);

    // Arriba y abajo: degradado del color medio (sin ctx.filter, que iOS no soporta)
    var medio = colorMedio(imagenes);
    var fondo = ctx.createLinearGradient(0, 0, 0, ALTO);
    fondo.addColorStop(0, rgb(medio, 0.45));
    fondo.addColorStop((y + difuminado) / ALTO, rgb(medio, 1));
    fondo.addColorStop((y + altoTotal - difuminado) / ALTO, rgb(medio, 1));
    fondo.addColorStop(1, rgb(medio, 0.35));
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);

    var bordes = [];
    for (var i = 0; i <= n; i++) bordes.push(Math.round((i * ANCHO) / n));
    var solape = Math.round((ANCHO / n) * 0.12);

    // Cada foto cubre [inicio - solape, fin + solape]
    var recortes = imagenes.map(function (img, i) {
      return recorte(img, bordes[i + 1] - bordes[i] + 2 * solape, altoTotal, difuminado);
    });

    // 1) Base sin solapes: la foto i ocupa [inicio - solape, fin - solape]
    recortes.forEach(function (r, i) {
      var ancho = bordes[i + 1] - bordes[i];
      dibujarEnvuelto(ctx, r, 0, ancho, bordes[i] - solape, y, altoTotal);
    });

    // 2) Fundido: el borde derecho de cada foto se desvanece sobre la siguiente
    recortes.forEach(function (r, i) {
      var ancho = bordes[i + 1] - bordes[i];
      var franja = document.createElement("canvas");
      franja.width = 2 * solape; franja.height = altoTotal;
      var fctx = franja.getContext("2d");
      fctx.drawImage(r, ancho, 0, 2 * solape, altoTotal, 0, 0, 2 * solape, altoTotal);
      fctx.globalCompositeOperation = "destination-in";
      var g = fctx.createLinearGradient(0, 0, 2 * solape, 0);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      fctx.fillStyle = g;
      fctx.fillRect(0, 0, 2 * solape, altoTotal);
      dibujarEnvuelto(ctx, franja, 0, 2 * solape, bordes[i + 1] - solape, y, altoTotal);
    });

    return new Promise(function (resolver) {
      if (lienzo.toBlob) {
        lienzo.toBlob(function (blob) {
          resolver(blob ? URL.createObjectURL(blob) : lienzo.toDataURL("image/jpeg", 0.9));
        }, "image/jpeg", 0.9);
      } else {
        resolver(lienzo.toDataURL("image/jpeg", 0.9));
      }
    });
  }

  // ---- Pannellum ----

  function iniciar(panorama, extra) {
    var fondo = colorRGB(C.fondo);
    var opciones = {
      type: "equirectangular",
      panorama: panorama,
      autoLoad: true,
      showControls: false,
      compass: false,
      crossOrigin: "anonymous",
      backgroundColor: fondo.map(function (v) { return v / 255; }),
      hfov: 100,
      minHfov: 30,
      maxHfov: 120,
      autoRotate: C.giroAutomatico ? -2 : false,
    };
    for (var clave in extra) opciones[clave] = extra[clave];

    var visor = pannellum.viewer("panorama", opciones);
    visor.on("load", function () { enviar({ tipo: "listo" }); });
    visor.on("error", fallar);
  }

  try {
    if (C.tipo === "collage") {
      Promise.all(C.fuentes.map(cargarImagen))
        .then(componerCollage)
        .then(function (url) { iniciar(url, { minPitch: -75, maxPitch: 75 }); })
        .catch(fallar);
    } else if (C.tipo === "panoramica") {
      var haov = C.campo ? C.campo.haov : 360;
      var vaov = C.campo ? C.campo.vaov : 60;
      var extra = {
        haov: haov,
        vaov: vaov,
        minPitch: -vaov / 2,
        maxPitch: vaov / 2,
        minHfov: 20,
        hfov: 90,
        avoidShowingBackground: true,
      };
      if (haov < 360) {
        extra.minYaw = -haov / 2;
        extra.maxYaw = haov / 2;
      }
      iniciar(aUrlBlob(C.fuentes[0]), extra);
    } else {
      iniciar(aUrlBlob(C.fuentes[0]), {});
    }
  } catch (e) {
    fallar(e);
  }
})();
</script>
</body>
</html>`;
}
