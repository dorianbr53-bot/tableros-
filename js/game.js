
// =============================================================
// Conquista de la Chakana — Juego de aristas y casillas (Dots & Boxes 7×7)
// -------------------------------------------------------------
// Cambios aplicados:
// - Clasificación de color por "distancia al color de referencia" (RGB) calibrado
//   con tus imágenes: verde (235,244,228), amarillo (255,230,153), marrón (191,143,0).
// - Pintado de casillas con esos tonos exactos para replicar el patrón.
// =============================================================

(function() {
  /** Configuración básica */
  const GRID = 7; // 7x7 casillas
  const players = [
    { id: 0, nombre: 'Jugador 1', color: '#1e88e5' }, // azul
    { id: 1, nombre: 'Jugador 2', color: '#e53935' }, // rojo
  ];
  let turno = 0; // índice de jugador activo
  let puntos = [0, 0];

  /** Canvas y medidas */
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  let W = canvas.width, H = canvas.height;
  let padding = 40; // margen alrededor del tablero
  let cell = (Math.min(W, H) - padding * 2) / GRID; // tamaño de casilla
  let dotR = 4; // radio de los puntos
  const pickTolerance = 10; // tolerancia de clic cerca de arista (px)

  /** Estado de aristas y casillas */
  const HEdges = Array.from({ length: GRID + 1 }, () => Array(GRID).fill(null)); // null | ownerId
  const VEdges = Array.from({ length: GRID }, () => Array(GRID + 1).fill(null)); // null | ownerId

  const boxes = Array.from({ length: GRID }, () => Array(GRID).fill(null)).map(row => row.map(() => ({
    tipo: 'verde', // 'verde' | 'amarillo' | 'marron'
    owner: null,
  })));

  // Puntos por color
  const puntosPorColor = { verde: 1, amarillo: 2, marron: 4 };

  /** Elementos UI */
  const patternSelect = document.getElementById('patternSelect');
  const resetBtn = document.getElementById('resetBtn');
  const p1ScoreEl = document.getElementById('p1Score');
  const p2ScoreEl = document.getElementById('p2Score');
  const turnLabel = document.getElementById('turnLabel');

  // Colores de referencia (calibrados)
  const REF = {
    verde:   [235, 244, 228],
    amarillo:[255, 230, 153],
    marron:  [191, 143,   0],
  };

  // -------------------------------------------------------------
  // Utilidades de posición y mouse
  // -------------------------------------------------------------
  function gridToXY(r, c) {
    const x = padding + c * cell;
    const y = padding + r * cell;
    return { x, y };
  }

  function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
  }

  function distPointToSegment(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1; const wx = px - x1, wy = py - y1;
    const c1 = vx * wx + vy * wy; if (c1 <= 0) return Math.hypot(px - x1, py - y1);
    const c2 = vx * vx + vy * vy; if (c2 <= c1) return Math.hypot(px - x2, py - y2);
    const b = c1 / c2; const bx = x1 + b * vx, by = y1 + b * vy; return Math.hypot(px - bx, py - by);
  }

  // -------------------------------------------------------------
  // Pick de arista
  // -------------------------------------------------------------
  function pickEdge(mx, my) {
    let best = null; let bestDist = pickTolerance;
    // Horizontales
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const { x, y } = gridToXY(r, c); const x2 = x + cell; const y2 = y;
        const d = distPointToSegment(mx, my, x, y, x2, y2);
        if (d < bestDist && HEdges[r][c] === null) { bestDist = d; best = { kind: 'H', r, c }; }
      }
    }
    // Verticales
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        const { x, y } = gridToXY(r, c); const x2 = x; const y2 = y + cell;
        const d = distPointToSegment(mx, my, x, y, x2, y2);
        if (d < bestDist && VEdges[r][c] === null) { bestDist = d; best = { kind: 'V', r, c }; }
      }
    }
    return best;
  }

  // -------------------------------------------------------------
  // Colocar arista y verificar cierre
  // -------------------------------------------------------------
  function placeEdge(edge) {
    let cerroAlguna = false;
    if (edge.kind === 'H') {
      HEdges[edge.r][edge.c] = turno;
      if (edge.r > 0) cerroAlguna = checkAndCloseBox(edge.r - 1, edge.c) || cerroAlguna;
      if (edge.r < GRID) cerroAlguna = checkAndCloseBox(edge.r, edge.c) || cerroAlguna;
    } else {
      VEdges[edge.r][edge.c] = turno;
      if (edge.c > 0) cerroAlguna = checkAndCloseBox(edge.r, edge.c - 1) || cerroAlguna;
      if (edge.c < GRID) cerroAlguna = checkAndCloseBox(edge.r, edge.c) || cerroAlguna;
    }
    if (!cerroAlguna) turno = (turno + 1) % players.length;
    updateTurnLabel(); draw();
  }

  function checkAndCloseBox(r, c) {
    const top = HEdges[r][c] !== null;
    const bottom = HEdges[r + 1][c] !== null;
    const left = VEdges[r][c] !== null;
    const right = VEdges[r][c + 1] !== null;
    if (top && bottom && left && right && boxes[r][c].owner === null) {
      boxes[r][c].owner = turno;
      const tipo = boxes[r][c].tipo; puntos[turno] += (puntosPorColor[tipo] || 0);
      updateScores(); return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Fondo tablero
    ctx.fillStyle = '#081221'; roundRect(ctx, 8, 8, W - 16, H - 16, 16); ctx.fill();

    // Casillas por tipo
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const { x, y } = gridToXY(r, c);
        ctx.fillStyle = tipoToFill(boxes[r][c].tipo);
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }

    // Aristas
    ctx.lineWidth = 4;
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const { x, y } = gridToXY(r, c);
        const owner = HEdges[r][c];
        ctx.strokeStyle = owner === null ? 'rgba(255,255,255,0.18)' : players[owner].color;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cell, y); ctx.stroke();
      }
    }
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        const { x, y } = gridToXY(r, c);
        const owner = VEdges[r][c];
        ctx.strokeStyle = owner === null ? 'rgba(255,255,255,0.18)' : players[owner].color;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cell); ctx.stroke();
      }
    }

    // Soles
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const b = boxes[r][c];
        if (b.owner !== null) {
          const cx = padding + c * cell + cell / 2;
          const cy = padding + r * cell + cell / 2;
          drawSun(cx, cy, cell * 0.28, players[b.owner].color);
        }
      }
    }

    // Puntos (nodos)
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        const { x, y } = gridToXY(r, c);
        ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Usar EXACTOS tonos RGB para replicar el patrón
  function tipoToFill(tipo) {
    switch (tipo) {
      case 'verde':   return 'rgb(235, 244, 228)';
      case 'amarillo':return 'rgb(255, 230, 153)';
      case 'marron':  return 'rgb(191, 143,   0)';
      default:        return 'rgba(255,255,255,0.12)';
    }
  }

  function drawSun(cx, cy, radius, color) {
    ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2); ctx.fill();
    const rays = 12; for (let i = 0; i < rays; i++) { const a = (i / rays) * Math.PI * 2; const r1 = radius * 0.65; const r2 = radius * 1.05; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke(); }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // Carga del patrón desde JPG y clasificación de colores
  // -------------------------------------------------------------
  function loadPattern(index) {
    const img = new Image(); img.src = `assets/img/patterns/${index}_7x7.jpg`;
    img.onload = () => {
      const off = document.createElement('canvas'); off.width = img.naturalWidth; off.height = img.naturalHeight;
      const octx = off.getContext('2d'); octx.drawImage(img, 0, 0);
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const sx = Math.floor(((c + 0.5) / GRID) * off.width);
          const sy = Math.floor(((r + 0.5) / GRID) * off.height);
          const data = octx.getImageData(sx, sy, 1, 1).data;
          const [R, G, B] = [data[0], data[1], data[2]];
          boxes[r][c].tipo = classifyColor(R, G, B);
          boxes[r][c].owner = null;
        }
      }
      // Reset al cambiar patrón
      for (let rr = 0; rr <= GRID; rr++) for (let cc = 0; cc < GRID; cc++) HEdges[rr][cc] = null;
      for (let rr = 0; rr < GRID; rr++) for (let cc = 0; cc <= GRID; cc++) VEdges[rr][cc] = null;
      puntos = [0, 0]; turno = 0; updateScores(); updateTurnLabel(); draw();
    };
    img.onerror = () => console.warn('No se pudo cargar el patrón', index, '— revisa la ruta assets/img/patterns');
  }

  // Clasificación: color más cercano a REF (distancia euclidiana)
  function classifyColor(R, G, B) {
    const v = [R, G, B]; let bestName = 'verde'; let bestDist = Infinity;
    for (const [name, ref] of Object.entries(REF)) {
      const d = Math.pow(v[0]-ref[0], 2) + Math.pow(v[1]-ref[1], 2) + Math.pow(v[2]-ref[2], 2);
      if (d < bestDist) { bestDist = d; bestName = name; }
    }
    return bestName;
  }

  // -------------------------------------------------------------
  // UI y eventos
  // -------------------------------------------------------------
  canvas.addEventListener('click', (evt) => { const { x, y } = getMousePos(evt); const edge = pickEdge(x, y); if (edge) placeEdge(edge); });

  resetBtn.addEventListener('click', () => {
    for (let rr = 0; rr <= GRID; rr++) for (let cc = 0; cc < GRID; cc++) HEdges[rr][cc] = null;
    for (let rr = 0; rr < GRID; rr++) for (let cc = 0; cc <= GRID; cc++) VEdges[rr][cc] = null;
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) boxes[r][c].owner = null;
    puntos = [0, 0]; turno = 0; updateScores(); updateTurnLabel(); draw();
  });

  patternSelect.addEventListener('change', (e) => loadPattern(e.target.value));

  function updateScores() { p1ScoreEl.textContent = String(puntos[0]); p2ScoreEl.textContent = String(puntos[1]); }

  function updateTurnLabel() {
    turnLabel.textContent = players[turno].nombre;
    document.getElementById('p1Badge').style.outline = turno === 0 ? '2px solid #1e88e5' : 'none';
    document.getElementById('p2Badge').style.outline = turno === 1 ? '2px solid #e53935' : 'none';
  }

  function resizeMeasurements() { W = canvas.width; H = canvas.height; padding = 40; cell = (Math.min(W, H) - padding * 2) / GRID; }

  window.addEventListener('resize', () => {
    const rect = canvas.getBoundingClientRect(); const size = Math.floor(Math.min(rect.width, rect.height));
    if (size > 0) { canvas.width = size; canvas.height = size; resizeMeasurements(); draw(); }
  });

  // Inicialización
  resizeMeasurements(); updateScores(); updateTurnLabel(); draw(); loadPattern(1);
})();
