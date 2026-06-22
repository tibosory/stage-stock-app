const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

/** HTML inline pour afficher un PDF local dans une WebView (embed natif indisponible sur Android). */
export function buildLocalPdfPreviewHtml(base64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes" />
  <script src="${PDFJS_CDN}/pdf.min.js"></script>
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%; background: #525659; }
    #status {
      color: #f1f5f9;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      text-align: center;
      padding: 24px 16px;
    }
    #pages {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px 8px 24px;
    }
    canvas {
      max-width: 100%;
      height: auto;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }
    .err { color: #fecaca; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="status">Chargement du PDF…</div>
  <div id="pages"></div>
  <script type="application/octet-stream" id="pdf-b64">${base64}</script>
  <script>
    (function () {
      var statusEl = document.getElementById('status');
      var pagesEl = document.getElementById('pages');
      function fail(msg) {
        statusEl.className = 'err';
        statusEl.textContent = msg;
      }
      if (typeof pdfjsLib === 'undefined') {
        fail('Lecteur PDF indisponible (connexion requise pour le premier affichage).');
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_CDN}/pdf.worker.min.js';
      var b64El = document.getElementById('pdf-b64');
      var b64 = b64El ? b64El.textContent.trim() : '';
      if (!b64) {
        fail('PDF vide ou illisible.');
        return;
      }
      try {
        var raw = atob(b64);
        var len = raw.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) bytes[i] = raw.charCodeAt(i);
        pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
          statusEl.textContent = '';
          var chain = Promise.resolve();
          for (var p = 1; p <= pdf.numPages; p++) {
            (function (pageNum) {
              chain = chain.then(function () {
                return pdf.getPage(pageNum).then(function (page) {
                  var baseViewport = page.getViewport({ scale: 1 });
                  var scale = Math.min(2.5, (window.innerWidth - 16) / baseViewport.width);
                  var viewport = page.getViewport({ scale: scale });
                  var canvas = document.createElement('canvas');
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  pagesEl.appendChild(canvas);
                  return page.render({
                    canvasContext: canvas.getContext('2d'),
                    viewport: viewport,
                  }).promise;
                });
              });
            })(p);
          }
          return chain;
        }).catch(function (e) {
          fail(e && e.message ? e.message : 'Impossible d\\u2019afficher ce PDF.');
        });
      } catch (e) {
        fail(e && e.message ? e.message : 'Impossible de lire ce PDF.');
      }
    })();
  </script>
</body>
</html>`;
}
