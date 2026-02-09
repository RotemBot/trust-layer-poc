let canvasScale = 1, canvasPanX = 0, canvasPanY = 0, isDragging = false, dragStartX, dragStartY;
const expandedNodes = new Set();

function renderFlowCanvas() {
  const canvas = document.getElementById('flowCanvas');
  const svg = document.getElementById('flowSvg');
  if (!canvas || !svg) return;

  let html = '';

  function renderNode(n, animated) {
    const animStyle = animated ? ';opacity:0;animation:fadeNodeIn .3s ease forwards' : '';

    if (n.type === 'group') {
      html += '<div class="fn-group" id="' + n.id + '" style="left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.w + 'px;height:' + n.h + 'px">'
        + '<div class="fn-group-title">' + n.label + '</div></div>';
      return;
    }

    if (n.type === 'flow-title') {
      html += '<div class="fn fn-flow-title" id="' + n.id + '" style="left:' + n.x + 'px;top:' + n.y + 'px' + animStyle + '">'
        + '<div class="fn-label">' + n.label + '</div></div>';
      return;
    }

    if (n.type === 'condition') {
      html += '<div class="fn fn-diamond" id="' + n.id + '" style="left:' + n.x + 'px;top:' + n.y + 'px' + animStyle + '">'
        + '<div class="fn-diamond-text">' + n.label + '</div>'
        + '<div class="fn-tooltip"><div class="fn-tooltip-file">' + (n.file||'') + '</div><div class="fn-tooltip-editor">Last edit: <span>' + (n.editor||'') + '</span></div></div>'
        + '</div>';
      return;
    }

    const isClickable = (n.type === 'page' || n.type === 'widget');
    const hasChildren = n.children && n.children.length > 0;
    const isExpanded = expandedNodes.has(n.id);
    const menuClick = isClickable ? ' onclick="if(!event.target.closest(\'.fn-expand\')) openNodeMenu(\'' + n.id + '\', event)"' : '';
    const expandClick = hasChildren ? ' ondblclick="event.stopPropagation(); toggleCanvasNode(\'' + n.id + '\')"' : '';

    const typeClass = n.type === 'widget' ? 'fn fn-widget' : 'fn fn-page';
    const colorClass = n.color ? ' ' + n.color : '';
    const expandedClass = isExpanded ? ' expanded' : '';
    const cls = typeClass + colorClass + expandedClass;

    html += '<div class="' + cls + '" id="' + n.id + '" style="left:' + n.x + 'px;top:' + n.y + 'px;' + (n.w ? 'min-width:' + n.w + 'px' : '') + animStyle + '"' + menuClick + expandClick + '>';
    if (n.icon) html += '<div class="fn-icon">' + n.icon + '</div>';
    html += '<div class="fn-label">' + n.label + '</div>';
    if (hasChildren) html += '<div class="fn-expand">' + (isExpanded ? '▼' : '▶') + '</div>';
    html += '<div class="fn-tooltip"><div class="fn-tooltip-file">' + (n.file||'') + '</div><div class="fn-tooltip-editor">Last edit: <span>' + (n.editor||'') + '</span></div></div>';
    html += '<span class="fn-diff-link" onclick="event.stopPropagation();openVisualDiff(currentVersionIdx,0)">👁 View change</span>';
    html += '</div>';

    if (hasChildren && isExpanded) {
      n.children.forEach(c => renderNode(c, true));
    }
  }

  FLOW_NODES.forEach(n => renderNode(n, false));

  canvas.innerHTML = html;

  requestAnimationFrame(function() {
    drawFlowEdges();
    applyCanvasVCS();
  });
}

function drawFlowEdges() {
  const svg = document.getElementById('flowSvg');
  if (!svg) return;
  svg.querySelectorAll('path,line,text,rect.edge-label-bg').forEach(el => el.remove());

  FLOW_EDGES.forEach(([fromId, toId, type, actionLabel]) => {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    if (!fromEl || !toEl) return;

    let fx, fy, tx, ty;

    const fromIsDiamond = fromEl.classList.contains('fn-diamond');
    const toIsDiamond = toEl.classList.contains('fn-diamond');

    const fromCx = fromEl.offsetLeft + fromEl.offsetWidth / 2;
    const fromCy = fromEl.offsetTop + fromEl.offsetHeight / 2;
    const toCx = toEl.offsetLeft + toEl.offsetWidth / 2;
    const toCy = toEl.offsetTop + toEl.offsetHeight / 2;

    if (fromIsDiamond) {
      if (type === 'no' || toCx > fromCx + 60) {
        fx = fromEl.offsetLeft + fromEl.offsetWidth;
        fy = fromCy;
      } else if (toCx < fromCx - 60) {
        fx = fromEl.offsetLeft;
        fy = fromCy;
      } else {
        fx = fromCx;
        fy = fromEl.offsetTop + fromEl.offsetHeight;
      }
    } else {
      if (Math.abs(toCx - fromCx) > 200 && Math.abs(toCy - fromCy) < 60) {
        fx = toCx > fromCx ? fromEl.offsetLeft + fromEl.offsetWidth : fromEl.offsetLeft;
        fy = fromCy;
      } else {
        fx = fromCx;
        fy = fromEl.offsetTop + fromEl.offsetHeight;
      }
    }

    if (toIsDiamond) {
      tx = toCx;
      ty = toEl.offsetTop;
    } else {
      if (Math.abs(toCx - fromCx) > 200 && Math.abs(toCy - fromCy) < 60) {
        tx = toCx > fromCx ? toEl.offsetLeft : toEl.offsetLeft + toEl.offsetWidth;
        ty = toCy;
      } else {
        tx = toCx;
        ty = toEl.offsetTop;
      }
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dx = tx - fx;
    const dy = ty - fy;
    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;

    let d;
    if (isHorizontal) {
      const midX = (fx + tx) / 2;
      d = 'M ' + fx + ' ' + fy + ' C ' + midX + ' ' + fy + ', ' + midX + ' ' + ty + ', ' + tx + ' ' + ty;
    } else {
      const midY = (fy + ty) / 2;
      d = 'M ' + fx + ' ' + fy + ' C ' + fx + ' ' + midY + ', ' + tx + ' ' + midY + ', ' + tx + ' ' + ty;
    }

    path.setAttribute('d', d);
    path.setAttribute('marker-end', 'url(#arrowM)');
    path.style.stroke = type === 'no' ? 'rgba(239,68,68,.5)' : type === 'yes' ? 'rgba(34,197,94,.5)' : '#4a4a6a';
    path.style.strokeWidth = '2';
    path.style.fill = 'none';
    svg.appendChild(path);

    const labelText = actionLabel || (type === 'yes' ? 'Yes' : type === 'no' ? 'No' : '');
    if (labelText) {
      const midPt = path.getPointAtLength(path.getTotalLength() * 0.5);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midPt.x);
      text.setAttribute('y', midPt.y - 8);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'edge-label');
      text.textContent = labelText;
      svg.appendChild(text);

      const bbox = text.getBBox();
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('class', 'edge-label-bg');
      bg.setAttribute('x', bbox.x - 6);
      bg.setAttribute('y', bbox.y - 2);
      bg.setAttribute('width', bbox.width + 12);
      bg.setAttribute('height', bbox.height + 4);
      bg.setAttribute('rx', '4');
      svg.insertBefore(bg, text);
    }
  });
}

function toggleCanvasNode(nodeId) {
  if (expandedNodes.has(nodeId)) {
    expandedNodes.delete(nodeId);
  } else {
    expandedNodes.add(nodeId);
  }
  renderFlowCanvas();
}

/* Pan & zoom */
function canvasZoom(delta) {
  canvasScale = Math.max(0.4, Math.min(2, canvasScale + delta));
  applyCanvasTransform();
}
function canvasReset() {
  canvasScale = 1; canvasPanX = 0; canvasPanY = 0;
  applyCanvasTransform();
}
function applyCanvasTransform() {
  const c = document.getElementById('flowCanvas');
  const s = document.getElementById('flowSvg');
  const t = 'translate(' + canvasPanX + 'px,' + canvasPanY + 'px) scale(' + canvasScale + ')';
  if (c) c.style.transform = t;
  if (s) s.style.transform = t;
  const lbl = document.getElementById('canvasZoomLabel');
  if (lbl) lbl.textContent = Math.round(canvasScale * 100) + '%';
}

function initCanvasPanZoom() {
  const wrap = document.getElementById('flowCanvasWrap');
  if (!wrap) return;

  let touchStartDistance = 0;
  let touchStartScale = canvasScale;
  let touchStartPanX = canvasPanX;
  let touchStartPanY = canvasPanY;
  let lastTouchCenter = { x: 0, y: 0 };

  wrap.addEventListener('mousedown', function(e) {
    if (e.target.closest('.fn') || e.target.closest('.canvas-ctrl')) return;
    isDragging = true;
    dragStartX = e.clientX - canvasPanX;
    dragStartY = e.clientY - canvasPanY;
    wrap.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    canvasPanX = e.clientX - dragStartX;
    canvasPanY = e.clientY - dragStartY;
    applyCanvasTransform();
  });
  document.addEventListener('mouseup', function() {
    isDragging = false;
    const wrap = document.getElementById('flowCanvasWrap');
    if (wrap) wrap.style.cursor = 'grab';
  });
  wrap.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      canvasZoom(e.deltaY < 0 ? 0.08 : -0.08);
    } else {
      canvasPanX -= e.deltaX;
      canvasPanY -= e.deltaY;
      applyCanvasTransform();
    }
  }, { passive: false });

  wrap.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      touchStartDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      touchStartScale = canvasScale;
      touchStartPanX = canvasPanX;
      touchStartPanY = canvasPanY;
      lastTouchCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (!e.target.closest('.fn') && !e.target.closest('.canvas-ctrl')) {
        isDragging = true;
        dragStartX = touch.clientX - canvasPanX;
        dragStartY = touch.clientY - canvasPanY;
      }
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const scaleChange = currentDistance / touchStartDistance;
      canvasScale = Math.max(0.4, Math.min(2, touchStartScale * scaleChange));

      const currentCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
      canvasPanX = touchStartPanX + (currentCenter.x - lastTouchCenter.x);
      canvasPanY = touchStartPanY + (currentCenter.y - lastTouchCenter.y);
      lastTouchCenter = currentCenter;
      applyCanvasTransform();
    } else if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      const touch = e.touches[0];
      canvasPanX = touch.clientX - dragStartX;
      canvasPanY = touch.clientY - dragStartY;
      applyCanvasTransform();
    }
  }, { passive: false });

  wrap.addEventListener('touchend', function(e) {
    if (e.touches.length === 0) {
      isDragging = false;
    }
  });
}

function buildFlowCardHTML(flow, idx, st) {
  const statusClass = st.result || (st.status === 'running' ? 'running' : '');
  const durationText = st.duration ? `${st.duration}ms` : '';
  const resultBadge = st.result ? `<span class="flow-result-badge ${st.result}">${st.result === 'passed' ? '✓ Passed' : '✗ Failed'}</span>` : '';
  const runLabel = st.status === 'running' ? '⟳ Running...' : '▶ Run';
  const runClass = st.status === 'running' ? 'run running' : 'run';

  const storyHtml = flow.story ? `
      <div class="story-block">
        ${flow.story.map(s => `<div class="story-step"><span class="story-keyword story-kw-${s.keyword.toLowerCase()}">${s.keyword}</span> ${s.text}</div>`).join('')}
      </div>` : `<div class="flow-desc">${flow.desc}</div>`;

  return `
    <div class="flow-card fade-in" id="flowCard${idx}">
      <div class="flow-card-top">
        <div class="flow-status ${statusClass}"></div>
        <div class="flow-title">${flow.title}</div>
        <span class="flow-duration">${durationText}</span>
        ${resultBadge}
      </div>
      ${storyHtml}
      <div class="flow-tags">
        ${flow.tags.map(t => `<span class="flow-tag">${t}</span>`).join('')}
      </div>
      <div class="flow-card-actions">
        <button class="flow-action-btn ${runClass}" onclick="runFlow(${idx})" ${st.status === 'running' ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><polygon points="5,3 19,12 5,21"/></svg>
          ${runLabel}
        </button>
        <button class="flow-action-btn visualize" onclick="openVisualize(${idx})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          Visualize
        </button>
        <button class="flow-action-btn code" onclick="openCode(${idx})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          View Test Code
        </button>
      </div>
    </div>
  `;
}

function updateStats() {
  const totalPassed = flowStates.filter(s => s.result === 'passed').length;
  const totalFailed = flowStates.filter(s => s.result === 'failed').length;
  const totalNotRun = flowStates.filter(s => s.status === 'idle').length;
  const el = (id) => document.getElementById(id);
  if (el('statPassed')) el('statPassed').textContent = totalPassed;
  if (el('statFailed')) el('statFailed').textContent = totalFailed;
  if (el('statPending')) el('statPending').textContent = totalNotRun;
}

// ─── RUN FLOW ───
function runFlow(idx) {
  if (flowStates[idx].status === 'running') return;
  flowStates[idx] = { status: 'running', duration: null, result: null };
  updateFlowCard(idx);
  updateStats();

  const duration = 1200 + Math.random() * 2200;
  setTimeout(() => {
    const passed = idx !== 5; // Make one fail for demo
    flowStates[idx] = {
      status: 'done',
      duration: Math.round(duration),
      result: passed ? 'passed' : 'failed'
    };
    updateFlowCard(idx);
    updateStats();
  }, duration);
}

function runAllFlows() {
  FLOWS.forEach((_, idx) => {
    setTimeout(() => runFlow(idx), idx * 400);
  });
}

function updateFlowCard(idx) {
  const card = document.getElementById(`flowCard${idx}`);
  if (card) {
    card.outerHTML = buildFlowCardHTML(FLOWS[idx], idx, flowStates[idx]);
  }
}

// ─── VISUALIZE MODAL ───
function openVisualize(idx) {
  visFlowIdx = idx;
  visStepIdx = 0;
  document.getElementById('visFlowName').textContent = FLOWS[idx].title;
  renderVisStep();
  document.getElementById('visModal').classList.add('active');
}

function getStepMockup(step) {
  const url = step.url || '';
  // Catalog page with filters
  if (url.includes('/catalog') && url.includes('cat=')) {
    const cat = (url.match(/cat=([^&]+)/) || [])[1] || 'all';
    return `
      <div style="font-family:system-ui;padding:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div style="flex:1;background:#f5f5f5;border:2px solid #4F46E5;border-radius:6px;padding:8px 12px;font-size:12px;color:#666">🔍 ${url.includes('q=') ? (url.match(/q=([^&]+)/) || [])[1] || '' : 'Search tools...'}</div>
          <div style="background:#4F46E5;color:#fff;padding:8px 12px;border-radius:6px;font-size:11px;font-weight:700">${cat.replace(/-/g,' ').toUpperCase()}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center"><div style="font-size:24px;margin-bottom:4px">🔩</div><div style="font-size:11px;font-weight:600">Cordless Drill</div><span style="font-size:9px;color:#22c55e;font-weight:700">Available</span></div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center"><div style="font-size:24px;margin-bottom:4px">🪚</div><div style="font-size:11px;font-weight:600">Circular Saw</div><span style="font-size:9px;color:#ef4444;font-weight:700">High Risk</span></div>
        </div>
      </div>`;
  }
  // Tool detail page
  if (url.includes('/catalog/')) {
    const toolName = (url.split('/catalog/')[1] || 'tool').replace(/-/g, ' ');
    return `
      <div style="font-family:system-ui;padding:12px">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:100px;height:100px;background:#f5f5f5;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0">🔩</div>
          <div>
            <div style="font-size:16px;font-weight:800;text-transform:capitalize;margin-bottom:4px">${toolName}</div>
            <span style="font-size:10px;font-weight:700;color:#f97316;letter-spacing:1px">POWER TOOLS</span>
            <div style="font-size:11px;color:#666;margin-top:6px;line-height:1.4">20V MAX cordless drill driver with brushless motor, 2-speed gearbox.</div>
            <span style="display:inline-block;margin-top:8px;background:#22c55e;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px">✓ Available</span>
          </div>
        </div>
        <button style="margin-top:14px;width:100%;background:#4F46E5;color:#fff;border:none;padding:10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📅 Book This Tool</button>
      </div>`;
  }
  // Booking / request pages
  if (url.includes('/book') || url.includes('/request') || url.includes('borrow')) {
    return `
      <div style="font-family:system-ui;padding:12px">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">📅 Book Tool</div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px">
          <div style="font-size:11px;color:#888;margin-bottom:8px">Select pickup date</div>
          <div style="display:flex;gap:6px">
            <span style="padding:6px 10px;border-radius:6px;font-size:11px;background:#e5e7eb;color:#333">Today</span>
            <span style="padding:6px 10px;border-radius:6px;font-size:11px;background:#4F46E5;color:#fff;font-weight:700">Tomorrow</span>
            <span style="padding:6px 10px;border-radius:6px;font-size:11px;background:#e5e7eb;color:#333">Feb 12</span>
          </div>
        </div>
        <button style="width:100%;background:#4F46E5;color:#fff;border:none;padding:10px;border-radius:8px;font-size:12px;font-weight:700">Confirm Request</button>
      </div>`;
  }
  // Dashboard / loans
  if (url.includes('/dashboard') || url.includes('/loans')) {
    return `
      <div style="font-family:system-ui;padding:12px">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">My Active Loans</div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">🔩</span>
          <div style="flex:1"><div style="font-size:12px;font-weight:600">Cordless Drill</div><div style="font-size:10px;color:#888">Due: Feb 15, 2026</div></div>
          <button style="background:#7c3aed;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:10px;font-weight:700">Return</button>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">🔨</span>
          <div style="flex:1"><div style="font-size:12px;font-weight:600">Claw Hammer</div><div style="font-size:10px;color:#888">Due: Feb 20, 2026</div></div>
          <button style="background:#7c3aed;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:10px;font-weight:700">Return</button>
        </div>
      </div>`;
  }
  // Admin pages
  if (url.includes('/admin')) {
    return `
      <div style="font-family:system-ui;padding:12px">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">🛡️ Admin Dashboard</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:900;color:#16a34a">12</div><div style="font-size:10px;color:#888">Pending</div></div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:900;color:#dc2626">3</div><div style="font-size:10px;color:#888">Overdue</div></div>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;font-size:11px;color:#666">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:600;color:#333">Recent Request</span><span style="color:#f97316">Pending</span></div>
          <div>John D. → Cordless Drill · Feb 10</div>
        </div>
      </div>`;
  }
  // Catalog main page
  if (url.includes('/catalog')) {
    return `
      <div style="font-family:system-ui;padding:12px">
        <div style="text-align:center;margin-bottom:12px"><div style="font-size:16px;font-weight:800">Tool Catalog</div><div style="font-size:11px;color:#888">Browse our complete collection</div></div>
        <div style="background:#f5f5f5;border-radius:6px;padding:8px 12px;font-size:12px;color:#999;margin-bottom:10px">🔍 Search tools...</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:8px;text-align:center"><div style="font-size:18px">🔩</div><div style="font-size:9px;font-weight:600;margin-top:2px">Drill</div></div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:8px;text-align:center"><div style="font-size:18px">🪚</div><div style="font-size:9px;font-weight:600;margin-top:2px">Saw</div></div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:8px;text-align:center"><div style="font-size:18px">🔧</div><div style="font-size:9px;font-weight:600;margin-top:2px">Sander</div></div>
        </div>
      </div>`;
  }
  // Home / registration / generic
  if (url.includes('/register') || url.includes('/signup')) {
    return `
      <div style="font-family:system-ui;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px">Create Account</div>
        <div style="text-align:left;display:flex;flex-direction:column;gap:8px">
          <div><div style="font-size:10px;color:#888;margin-bottom:2px">Name</div><div style="background:#f5f5f5;border:1px solid #e5e7eb;border-radius:6px;padding:8px;font-size:11px;color:#333">John Doe</div></div>
          <div><div style="font-size:10px;color:#888;margin-bottom:2px">Email</div><div style="background:#f5f5f5;border:1px solid #e5e7eb;border-radius:6px;padding:8px;font-size:11px;color:#333">john@example.com</div></div>
        </div>
        <button style="margin-top:12px;width:100%;background:#4F46E5;color:#fff;border:none;padding:10px;border-radius:8px;font-size:12px;font-weight:700">Sign Up</button>
      </div>`;
  }
  // Default: home page
  return `
    <div style="font-family:system-ui;padding:12px;text-align:center">
      <div style="font-size:10px;letter-spacing:2px;color:#f97316;font-weight:700;margin-bottom:8px">TOOLSHARE</div>
      <div style="font-size:16px;font-weight:800;margin-bottom:6px">SHARE TOOLS.<br>BUILD FUTURE.</div>
      <div style="font-size:11px;color:#888;margin-bottom:12px">Access professional-grade equipment</div>
      <button style="background:#f97316;color:#000;border:none;padding:8px 20px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">BROWSE CATALOG →</button>
    </div>`;
}

function renderVisStep() {
  const flow = FLOWS[visFlowIdx];
  const step = flow.steps[visStepIdx];

  document.getElementById('visUrl').textContent = step.url;

  const viewport = document.getElementById('visStepContent');
  const isLast = visStepIdx === flow.steps.length - 1;

  const mockupHtml = getStepMockup(step);

  viewport.innerHTML = `
    <div class="vis-mockup">${mockupHtml}</div>
    <div class="vis-step-overlay">
      <div class="vis-step-num">Step ${visStepIdx + 1} of ${flow.steps.length}</div>
      <div class="vis-step-action">${step.action}</div>
      <div class="vis-step-detail">${step.detail}</div>
      ${isLast ? '<div style="margin-top:10px;font-size:20px">✅</div>' : ''}
    </div>
  `;
  viewport.parentElement.style.background = '#FAF8F5';

  // Dots
  const dotsContainer = document.getElementById('visStepDots');
  dotsContainer.innerHTML = flow.steps.map((_, i) => {
    let cls = 'vis-dot';
    if (i < visStepIdx) cls += ' done';
    else if (i === visStepIdx) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function visNext() {
  const flow = FLOWS[visFlowIdx];
  if (visStepIdx < flow.steps.length - 1) {
    visStepIdx++;
    renderVisStep();
  }
}

function visPrev() {
  if (visStepIdx > 0) {
    visStepIdx--;
    renderVisStep();
  }
}

// ─── CODE MODAL (Split View + Version Control + Diff) ───
let codeModalFlowIdx = null;
let codeModalVersionIdx = currentVersionIdx;
let codeModalDiffActive = false;

function getFlowCodeForVersion(flowId, versionIdx) {
  const history = FLOW_CODE_HISTORY[flowId];
  if (history) {
    for (const entry of history) {
      if (versionIdx <= entry.upToVersion) return entry.code;
    }
  }
  const flow = FLOWS.find(f => f.id === flowId);
  return flow ? flow.code : '';
}

function hasCodeChangedAtVersion(flowId, versionIdx) {
  if (versionIdx === 0) return false;
  return getFlowCodeForVersion(flowId, versionIdx) !== getFlowCodeForVersion(flowId, versionIdx - 1);
}

function openCode(idx) {
  codeModalFlowIdx = idx;
  codeModalVersionIdx = currentVersionIdx;
  codeModalDiffActive = false;

  const flow = FLOWS[idx];
  document.getElementById('codeFilePath').textContent = `tests/flows/${flow.id}.spec.ts`;

  renderCodeModalContent();
  updateCodeModalVcUI();

  // Footer context
  const contextEl = document.getElementById('codeRegenContext');
  if (flow.story) {
    contextEl.innerHTML = `<span class="regen-context-label">Source:</span> BDD story (${flow.story.length} steps) + current implementation`;
  } else {
    contextEl.innerHTML = `<span class="regen-context-label">Source:</span> Flow definition + current implementation`;
  }

  // Reset regenerate button
  const btn = document.getElementById('codeRegenBtn');
  btn.classList.remove('regenerating', 'done');
  btn.disabled = false;
  btn.querySelector('.regen-label').textContent = 'Regenerate Test Code';

  document.getElementById('codeModal').classList.add('active');
}

function renderCodeModalContent() {
  const flow = FLOWS[codeModalFlowIdx];
  const storyPane = document.getElementById('codeStoryPane');
  const rightPane = document.getElementById('codeRightPane');

  // Resolve flow change metadata for highlighting
  let flowChange = null;
  if (codeModalDiffActive && hasCodeChangedAtVersion(flow.id, codeModalVersionIdx)) {
    const v = VERSIONS[codeModalVersionIdx];
    flowChange = (v.flowChanges || []).find(fc => fc.flowId === flow.id);
  }
  const changedStorySet = new Set(flowChange?.changedStoryIndices || []);
  const changedStepSet = new Set(flowChange?.changedStepIndices || []);

  let storyHtml = '';

  // ── Change info block (above User Story when diff is active) ──
  if (flowChange) {
    const v = VERSIONS[codeModalVersionIdx];
    storyHtml += `<div class="code-change-info">
      <h4>Changes in this version</h4>
      <div class="code-change-desc">${flowChange.desc}</div>
      <div class="code-change-version">${v.label} · ${v.date}</div>
    </div>`;
  }

  // ── BDD Story ──
  storyHtml += '<div class="code-story-header"><h4>User Story</h4></div>';
  if (flow.story) {
    storyHtml += '<div class="story-block" style="margin-bottom:20px">';
    storyHtml += flow.story.map((s, i) => {
      const hl = changedStorySet.has(i) ? ' story-step-changed' : '';
      return `<div class="story-step${hl}"><span class="story-keyword story-kw-${s.keyword.toLowerCase()}">${s.keyword}</span> ${s.text}</div>`;
    }).join('');
    storyHtml += '</div>';
  }

  // ── Test Steps ──
  storyHtml += '<div class="code-story-header"><h4>Test Steps</h4></div>';
  storyHtml += '<div class="code-test-steps">';
  flow.steps.forEach((step, i) => {
    const hl = changedStepSet.has(i) ? ' code-test-step-changed' : '';
    storyHtml += `<div class="code-test-step${hl}">
      <span class="code-step-num">${i + 1}</span>
      <div>
        <div class="code-step-action">${step.action}</div>
        <div class="code-step-detail">${step.detail}</div>
      </div>
    </div>`;
  });
  storyHtml += '</div>';

  storyPane.innerHTML = storyHtml;

  // ── Right pane: Code or Diff ──
  if (codeModalDiffActive && codeModalVersionIdx > 0) {
    const oldCode = getFlowCodeForVersion(flow.id, codeModalVersionIdx - 1);
    const newCode = getFlowCodeForVersion(flow.id, codeModalVersionIdx);
    const diff = computeLineDiff(oldCode, newCode);
    rightPane.innerHTML = renderDiffView(diff);
  } else {
    const code = getFlowCodeForVersion(flow.id, codeModalVersionIdx);
    rightPane.innerHTML = `<div class="code-block">${highlightTS(code)}</div>`;
  }
}

function updateCodeModalVcUI() {
  const v = VERSIONS[codeModalVersionIdx];
  document.getElementById('codeVcHash').textContent = v.hash;
  document.getElementById('codeVcDate').textContent =
    codeModalVersionIdx === VERSIONS.length - 1 ? '· latest' : '· ' + v.date;
  document.getElementById('codeVcPrev').disabled = codeModalVersionIdx === 0;
  document.getElementById('codeVcNext').disabled = codeModalVersionIdx === VERSIONS.length - 1;

  // Show/hide diff toggle based on whether code actually changed at this version
  const flow = FLOWS[codeModalFlowIdx];
  const hasChanges = hasCodeChangedAtVersion(flow.id, codeModalVersionIdx);
  const diffToggle = document.getElementById('codeDiffToggle');
  diffToggle.style.display = hasChanges ? '' : 'none';
  diffToggle.classList.toggle('active', codeModalDiffActive && hasChanges);
  document.getElementById('codeDiffLabel').textContent =
    codeModalDiffActive && hasChanges ? 'Showing Changes' : 'Show Changes';
}

function codeModalVcPrev() {
  if (codeModalVersionIdx > 0) {
    codeModalVersionIdx--;
    codeModalDiffActive = false;
    renderCodeModalContent();
    updateCodeModalVcUI();
  }
}

function codeModalVcNext() {
  if (codeModalVersionIdx < VERSIONS.length - 1) {
    codeModalVersionIdx++;
    codeModalDiffActive = false;
    renderCodeModalContent();
    updateCodeModalVcUI();
  }
}

function toggleCodeDiff() {
  codeModalDiffActive = !codeModalDiffActive;
  renderCodeModalContent();
  updateCodeModalVcUI();
}

// ─── LINE DIFF (LCS-based) ───
function computeLineDiff(oldCode, newCode) {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const n = oldLines.length;
  const m = newLines.length;

  // Build LCS table
  const dp = [];
  for (let i = 0; i <= n; i++) {
    dp[i] = new Array(m + 1).fill(0);
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff entries
  const result = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'context', content: oldLines[i - 1], oldNum: i, newNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', content: newLines[j - 1], newNum: j });
      j--;
    } else {
      result.unshift({ type: 'removed', content: oldLines[i - 1], oldNum: i });
      i--;
    }
  }

  return result;
}

function renderDiffView(diff) {
  const addedCount = diff.filter(d => d.type === 'added').length;
  const removedCount = diff.filter(d => d.type === 'removed').length;

  let html = `<div class="diff-summary">
    <span class="diff-stat-added">+${addedCount} added</span>
    <span class="diff-stat-removed">\u2212${removedCount} removed</span>
  </div>`;

  html += '<div class="diff-view">';
  diff.forEach(entry => {
    const cls = entry.type === 'added' ? 'diff-added' : entry.type === 'removed' ? 'diff-removed' : '';
    const marker = entry.type === 'added' ? '+' : entry.type === 'removed' ? '\u2212' : ' ';
    const oldNum = entry.oldNum != null ? entry.oldNum : '';
    const newNum = entry.newNum != null ? entry.newNum : '';
    const highlighted = highlightTSLine(entry.content);

    html += `<div class="diff-line ${cls}">`;
    html += `<span class="diff-num">${oldNum}</span>`;
    html += `<span class="diff-num">${newNum}</span>`;
    html += `<span class="diff-marker">${marker}</span>`;
    html += `<span class="diff-content">${highlighted}</span>`;
    html += '</div>';
  });
  html += '</div>';

  return html;
}

// Highlight a single TS line (for diff view, without wrapping in .code-line)
function highlightTSLine(line) {
  let hl = escapeHtml(line);
  hl = hl.replace(/\b(import|from|export|const|let|var|async|await|function|return|if|else|for|of|new|test|expect)\b/g, '<span class="hl-kw">$1</span>');
  hl = hl.replace(/(&#x27;[^&#]*?&#x27;|'[^']*?')/g, '<span class="hl-str">$1</span>');
  hl = hl.replace(/(`[^`]*?`)/g, '<span class="hl-str">$1</span>');
  hl = hl.replace(/(\/\/.*)/g, '<span class="hl-cm">$1</span>');
  hl = hl.replace(/\b(\d+)\b/g, '<span class="hl-num">$1</span>');
  hl = hl.replace(/\.(\w+)\(/g, '.<span class="hl-fn">$1</span>(');
  hl = hl.replace(/test\.describe/g, '<span class="hl-kw">test</span>.<span class="hl-fn">describe</span>');
  return hl;
}

function regenerateCode() {
  if (codeModalFlowIdx === null) return;
  const btn = document.getElementById('codeRegenBtn');
  if (btn.classList.contains('regenerating')) return;

  // Switch to latest version, turn off diff
  codeModalVersionIdx = VERSIONS.length - 1;
  codeModalDiffActive = false;
  updateCodeModalVcUI();
  renderCodeModalContent();

  btn.classList.add('regenerating');
  btn.disabled = true;
  btn.querySelector('.regen-label').textContent = 'Analyzing BDD story...';

  const rightPane = document.getElementById('codeRightPane');

  // Phase 1
  setTimeout(() => {
    btn.querySelector('.regen-label').textContent = 'Mapping to implementation...';
  }, 800);

  // Phase 2: shimmer
  setTimeout(() => {
    btn.querySelector('.regen-label').textContent = 'Generating Playwright code...';
    rightPane.querySelectorAll('.code-line').forEach((line, i) => {
      setTimeout(() => line.classList.add('code-line-regen'), i * 30);
    });
  }, 1600);

  // Phase 3: done
  setTimeout(() => {
    const flow = FLOWS[codeModalFlowIdx];
    rightPane.innerHTML = `<div class="code-block code-block-fresh">${highlightTS(flow.code)}</div>`;

    btn.classList.remove('regenerating');
    btn.classList.add('done');
    btn.querySelector('.regen-label').textContent = 'Code regenerated';

    setTimeout(() => {
      btn.classList.remove('done');
      btn.disabled = false;
      btn.querySelector('.regen-label').textContent = 'Regenerate Test Code';
    }, 2000);
  }, 2800);
}

function highlightTS(code) {
  const lines = code.split('\n');
  return lines.map((line, i) => {
    let highlighted = escapeHtml(line);
    // Keywords
    highlighted = highlighted.replace(/\b(import|from|export|const|let|var|async|await|function|return|if|else|for|of|new|test|expect)\b/g, '<span class="hl-kw">$1</span>');
    // Strings
    highlighted = highlighted.replace(/(&#x27;[^&#]*?&#x27;|'[^']*?')/g, '<span class="hl-str">$1</span>');
    highlighted = highlighted.replace(/(`[^`]*?`)/g, '<span class="hl-str">$1</span>');
    // Comments
    highlighted = highlighted.replace(/(\/\/.*)/g, '<span class="hl-cm">$1</span>');
    // Numbers
    highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="hl-num">$1</span>');
    // Method calls
    highlighted = highlighted.replace(/\.(\w+)\(/g, '.<span class="hl-fn">$1</span>(');
    // test.describe / test
    highlighted = highlighted.replace(/test\.describe/g, '<span class="hl-kw">test</span>.<span class="hl-fn">describe</span>');

    return `<div class="code-line"><span class="code-line-num">${i + 1}</span><span class="code-line-content">${highlighted}</span></div>`;
  }).join('');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ─── MODAL CONTROLS ───
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal('visModal');
    closeModal('codeModal');
    closeModal('vdiffModal');
    closeModal('codeDiffModal');
    closeNodeMenu();
  }
});

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#pageSelector') && !e.target.closest('#pageDropdown')) {
    document.getElementById('pageDropdown').style.display = 'none';
  }
});

// ─── EDITOR TAB SWITCHING ───
let currentAdvancedSubTab = 'flows';

function switchEditorTab(tab, e) {
  // Update top-bar tab buttons
  document.querySelectorAll('.tab-group .tab-item').forEach(t => t.classList.remove('active'));
  if (e && e.target) e.target.classList.add('active');

  const chatPanel = document.getElementById('chatPanel');
  const previewArea = document.querySelector('.preview-area');
  const advancedView = document.getElementById('advancedView');

  // Hide all panels first
  previewArea.style.display = 'none';
  advancedView.classList.remove('active');

  // Chat panel always visible
  chatPanel.style.display = '';

  if (tab === 'advanced') {
    advancedView.classList.add('active');
    switchAdvancedSubTab(currentAdvancedSubTab);
    initVersionTimeline();
  } else {
    // Site or Dashboard — show preview area
    previewArea.style.display = '';
    // Restore correct page based on currentPage
    const siteHome = document.getElementById('siteHome');
    const siteCatalog = document.getElementById('siteCatalog');
    const sitePreview = document.getElementById('sitePreview');
    sitePreview.style.display = 'block';
    if (currentPage === 'Catalog') {
      siteHome.style.display = 'none';
      siteCatalog.classList.add('active');
    } else {
      siteHome.style.display = 'block';
      siteCatalog.classList.remove('active');
    }
  }
}

// ─── ADVANCED SUB-TAB SWITCHING ───
function switchAdvancedSubTab(subTab, e) {
  currentAdvancedSubTab = subTab;

  // Update sub-tab buttons
  document.querySelectorAll('.adv-tab').forEach(t => t.classList.remove('active'));
  if (e && e.target) {
    e.target.closest('.adv-tab').classList.add('active');
  } else {
    // Programmatic call — first tab is flows/insights, second is code
    const tabs = document.querySelectorAll('.adv-tab');
    const targetIdx = subTab === 'flows' ? 0 : 1;
    if (tabs[targetIdx]) tabs[targetIdx].classList.add('active');
  }

  const flowsPage = document.getElementById('flowsPage');
  const codeView = document.getElementById('codeEditorView');

  if (subTab === 'flows') {
    flowsPage.classList.add('active');
    codeView.classList.remove('active');
    if (!flowsPage._rendered) {
      renderFlowsPage('flowsPage');
      flowsPage._rendered = true;
    }
  } else {
    flowsPage.classList.remove('active');
    codeView.classList.add('active');
    const codeArea = document.getElementById('codeEditArea');
    if (codeArea && !codeArea._rendered) {
      renderCodeContent();
      codeArea._rendered = true;
    }
  }
}

// ─── RENDER FLOWS PAGE ───
function renderFlowsPage(targetId) {
  const container = document.getElementById(targetId || 'flowsPage');
  const totalPassed = flowStates.filter(s => s.result === 'passed').length;
  const totalFailed = flowStates.filter(s => s.result === 'failed').length;
  const totalNotRun = flowStates.filter(s => s.status === 'idle').length;

  let html = `
    <div class="flows-header fade-in">
      <div>
        <div class="flows-title">Product Flows</div>
        <div class="flows-subtitle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          Auto-detected from your prompt and code architecture
        </div>
      </div>
    </div>

    <!-- Tab Menu -->
    <div class="flows-tab-menu fade-in">
      <button class="flows-tab active" onclick="switchFlowsTab('testcases', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        User Stories
        <span class="tab-count">${FLOWS.length}</span>
      </button>
      <button class="flows-tab" onclick="switchFlowsTab('userflows', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        Flows
        <span class="tab-count">3</span>
      </button>
      <button class="flows-tab" onclick="switchFlowsTab('widgets', this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Widget Library
        <span class="tab-count">${WIDGETS.length}</span>
      </button>
    </div>

    <!-- Test Cases Tab -->
    <div class="flows-tab-content active" id="tab-testcases">
      <div class="flows-stats fade-in" id="flowStats" style="display:flex;gap:16px;margin-bottom:24px">
        <div class="stat-card"><div class="stat-value">${FLOWS.length}</div><div class="stat-label">Total Flows</div></div>
        <div class="stat-card passed"><div class="stat-value" id="statPassed">${totalPassed}</div><div class="stat-label">Passed</div></div>
        <div class="stat-card failed"><div class="stat-value" id="statFailed">${totalFailed}</div><div class="stat-label">Failed</div></div>
        <div class="stat-card"><div class="stat-value" id="statPending">${totalNotRun}</div><div class="stat-label">Not Run</div></div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn-run-all" onclick="runAllFlows()">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          Run All
        </button>
      </div>
  `;

  FLOWS.forEach((flow, idx) => {
    const st = flowStates[idx];
    html += buildFlowCardHTML(flow, idx, st);
  });

  html += `</div><!-- /tab-testcases -->`;

  // User Flows Tab
  html += buildUserFlowsTab();

  // Widget Library Tab
  html += buildWidgetLibraryTab();

  container.innerHTML = html;
}

// ─── USER FLOWS TAB ───
function buildUserFlowsTab() {
  return `
    <div class="flows-tab-content" id="tab-userflows">
      <div class="uf-intro">
        <strong>Interactive Site Map</strong> — auto-generated from your code architecture. Click any page node to drill down into its components and CTAs. Drag to pan, scroll to zoom.
      </div>

      <div class="flow-canvas-wrap" id="flowCanvasWrap">
        <div class="canvas-grid"></div>
        <svg class="flow-svg" id="flowSvg">
          <defs>
            <marker id="arrowM" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" class="arrow-head"/>
            </marker>
          </defs>
        </svg>
        <div class="flow-canvas" id="flowCanvas">
          <!-- Nodes are rendered by JS -->
        </div>
        <div class="canvas-controls">
          <button class="canvas-ctrl" onclick="canvasZoom(-.15)" title="Zoom out">−</button>
          <div class="canvas-zoom-label" id="canvasZoomLabel">100%</div>
          <button class="canvas-ctrl" onclick="canvasZoom(.15)" title="Zoom in">+</button>
          <button class="canvas-ctrl" onclick="canvasReset()" title="Reset view">⌂</button>
        </div>
      </div>
    </div><!-- /tab-userflows -->
  `;
}

// ─── WIDGET LIBRARY TAB ───
function buildWidgetLibraryTab() {
  const categories = [...new Set(WIDGETS.map(w => w.category))];
  let html = `
    <div class="flows-tab-content" id="tab-widgets">
      <div class="widget-lib-intro">
        <strong>Component Library</strong> — all UI widgets detected in your generated site. Click any widget to inspect its props and interact with a live preview.
      </div>

      <div class="widget-categories">
        <button class="widget-cat-btn active" onclick="filterWidgets('all', this)">All <span class="tab-count">${WIDGETS.length}</span></button>
        ${categories.map(cat => {
          const count = WIDGETS.filter(w => w.category === cat).length;
          return `<button class="widget-cat-btn" onclick="filterWidgets('${cat}', this)">${cat} <span class="tab-count">${count}</span></button>`;
        }).join('')}
      </div>

      <div class="widget-grid" id="widgetGrid">
  `;

  WIDGETS.forEach((widget, idx) => {
    // Generate default preview using render()
    const defaultProps = {};
    widget.props.forEach(p => { defaultProps[p.name] = p.default; });
    const previewHtml = widget.render ? widget.render(defaultProps) : '';

    html += `
        <div class="widget-card fade-in" data-category="${widget.category}" id="widgetCard${idx}" onclick="expandWidget(${idx})">
          <div class="widget-card-preview">
            ${previewHtml}
          </div>
          <div class="widget-card-info">
            <span class="widget-icon">${widget.icon}</span>
            <div class="widget-card-meta">
              <div class="widget-card-name">${widget.name}</div>
              <span class="widget-card-cat">${widget.category}</span>
            </div>
          </div>
        </div>
    `;
  });

  html += `
      </div><!-- /widget-grid -->

      <!-- Expanded widget detail: Storybook-style two-column layout -->
      <div class="widget-detail sb-layout" id="widgetDetail" style="display:none">
        <div class="sb-preview-pane">
          <button class="widget-detail-back" onclick="closeWidgetDetail()">← Back to Library</button>
          <div class="widget-detail-header">
            <span class="widget-detail-icon" id="wdIcon"></span>
            <div>
              <h3 class="widget-detail-name" id="wdName"></h3>
              <span class="widget-detail-cat" id="wdCat"></span>
            </div>
          </div>
          <p class="widget-detail-desc" id="wdDesc"></p>
          <div class="widget-detail-section">
            <h4>Live Preview</h4>
            <div class="widget-detail-preview" id="wdPreview"></div>
          </div>
        </div>
        <div class="sb-controls-pane">
          <h4 class="sb-controls-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            Controls
          </h4>
          <div class="widget-detail-props sb-controls" id="wdProps"></div>
        </div>
      </div>
    </div><!-- /tab-widgets -->
  `;
  return html;
}

// ─── FLOWS TAB SWITCHING ───
function switchFlowsTab(tab, btn) {
  // Update tab buttons
  const menu = btn.closest('.flows-tab-menu');
  menu.querySelectorAll('.flows-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  // Update tab content
  const container = btn.closest('.flows-page, [id^="flowsPage"]') || btn.closest('[style*="overflow"]');
  let parent = btn.parentElement.parentElement;
  parent.querySelectorAll('.flows-tab-content').forEach(c => c.classList.remove('active'));
  const target = parent.querySelector('#tab-' + tab);
  if (target) target.classList.add('active');

  // Initialize canvas when User Flows tab is shown
  if (tab === 'userflows') {
    setTimeout(function() {
      renderFlowCanvas();
      initCanvasPanZoom();
    }, 50);
  }
}

// ─── TREE TOGGLE (legacy, kept for compat) ───
function toggleTreeNode(id) {
  const node = document.getElementById(id);
  if (node) node.classList.toggle('open');
}

// ─── VERSION CONTROL ───
function initVersionTimeline() {
  const tl = document.getElementById('vcTimeline');
  if (!tl) return;
  tl.innerHTML = VERSIONS.map((v, i) => {
    const isActive = i === currentVersionIdx;
    const isCompare = compareMode && i === compareVersionIdx;
    const hasChanges = v.changes.length > 0;
    return `<div class="vc-dot ${isActive ? 'active' : ''} ${isCompare ? 'compare' : ''} ${hasChanges ? 'has-changes' : ''}" onclick="selectVersionForCompare(${i})">
      <div class="vc-dot-tooltip">${v.label}<br><span style="color:var(--text-muted)">${v.date}</span></div>
    </div>`;
  }).join('');
  updateVcUI();
}

function updateVcUI() {
  const v = VERSIONS[currentVersionIdx];
  document.getElementById('vcHashText').textContent = v.hash;
  document.getElementById('vcDateText').textContent = currentVersionIdx === VERSIONS.length - 1 ? '· latest' : '· ' + v.date;
  document.getElementById('vcPrevBtn').disabled = currentVersionIdx === 0;
  document.getElementById('vcNextBtn').disabled = currentVersionIdx === VERSIONS.length - 1;

  // Update diff count — include all pillar changes
  const dc = document.getElementById('vcDiffCount');
  const canvasChanges = (v.changes || []).length;
  const widgetChanges = (v.widgetChanges || []).length;
  const flowChanges = (v.flowChanges || []).length;
  const totalChanges = canvasChanges + widgetChanges + flowChanges;
  if (totalChanges > 0) {
    dc.style.display = '';
    dc.textContent = totalChanges + ' change' + (totalChanges !== 1 ? 's' : '');
  } else {
    dc.style.display = 'none';
  }

  // Update timeline dots
  document.querySelectorAll('.vc-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentVersionIdx);
    dot.classList.toggle('compare', compareMode && i === compareVersionIdx);
  });

  // Show/hide compare button
  if (compareMode && compareVersionIdx !== null) {
    let compareBtn = document.getElementById('vcCompareBtn');
    if (!compareBtn) {
      const btn = document.createElement('button');
      btn.id = 'vcCompareBtn';
      btn.className = 'vc-compare-btn';
      btn.innerHTML = 'View Code Diff';
      btn.onclick = openCodeDiff;
      const vcBar = document.getElementById('vcBar');
      if (vcBar) vcBar.appendChild(btn);
    } else {
      compareBtn.style.display = '';
    }
  } else {
    const compareBtn = document.getElementById('vcCompareBtn');
    if (compareBtn) compareBtn.style.display = 'none';
  }

  // Apply diffs across all pillars
  applyDiffsToTree();
  applyWidgetDiffs();
  applyFlowDiffs();
}

function goToVersion(idx) {
  currentVersionIdx = idx;
  if (compareMode && compareVersionIdx === idx) {
    compareVersionIdx = null;
    compareMode = false;
  }
  updateVcUI();
}

function vcPrev() {
  if (currentVersionIdx > 0) { currentVersionIdx--; updateVcUI(); }
}
function vcNext() {
  if (currentVersionIdx < VERSIONS.length - 1) { currentVersionIdx++; updateVcUI(); }
}

function applyDiffsToTree() {
  // Clear all diff classes (legacy tree + canvas nodes)
  document.querySelectorAll('.diff-added,.diff-removed,.diff-modified,.diff-moved,.vcs-added,.vcs-removed,.vcs-modified,.vcs-moved').forEach(el => {
    el.classList.remove('diff-added','diff-removed','diff-modified','diff-moved','vcs-added','vcs-removed','vcs-modified','vcs-moved');
    const hint = el.querySelector('.diff-click-hint');
    if (hint) hint.remove();
  });

  const v = VERSIONS[currentVersionIdx];
  if (!v.changes || v.changes.length === 0) {
    if (compareMode && compareVersionIdx !== null) {
      applyComparisonDiffs();
    }
    return;
  }

  v.changes.forEach(change => {
    const node = document.getElementById(change.nodeId);
    if (!node) return;
    // Support both old tree and new canvas classes
    node.classList.add('diff-' + change.type);
    node.classList.add('vcs-' + change.type);

    if (v.diffs && v.diffs.length > 0) {
      const header = node.querySelector('.tree-node-header') || node;
      if (!header.querySelector('.diff-click-hint')) {
        const hint = document.createElement('span');
        hint.className = 'diff-click-hint';
        hint.innerHTML = '👁 View change';
        hint.onclick = function(e) {
          e.stopPropagation();
          openVisualDiff(currentVersionIdx, 0);
        };
        header.style.position = 'relative';
        header.appendChild(hint);
      }
    }
  });

  if (compareMode && compareVersionIdx !== null) {
    applyComparisonDiffs();
  }
}

function applyComparisonDiffs() {
  const v1 = VERSIONS[currentVersionIdx];
  const v2 = VERSIONS[compareVersionIdx];
  
  const v1Changes = v1.changes || [];
  const v2Changes = v2.changes || [];
  
  // Mark removed items (in v1 but not in v2)
  v1Changes.forEach(change => {
    const inV2 = v2Changes.find(c => c.nodeId === change.nodeId);
    if (!inV2) {
      const node = document.getElementById(change.nodeId);
      if (node) {
        node.classList.add('vcs-removed');
        node.style.opacity = '0.5';
        node.style.textDecoration = 'line-through';
      }
    }
  });
  
  // Mark added items (in v2 but not in v1)
  v2Changes.forEach(change => {
    const inV1 = v1Changes.find(c => c.nodeId === change.nodeId);
    if (!inV1) {
      const node = document.getElementById(change.nodeId);
      if (node) {
        node.classList.add('vcs-added');
        node.style.boxShadow = '0 0 16px rgba(34,197,94,.3)';
      }
    } else if (inV1.type === 'moved' || change.type === 'moved') {
      // Mark moved items
      const node = document.getElementById(change.nodeId);
      if (node) {
        node.classList.add('vcs-moved');
        node.style.boxShadow = '0 0 16px rgba(59,130,246,.3)';
      }
    }
  });
}

function applyCanvasVCS() {
  const v = VERSIONS[currentVersionIdx];
  if (!v || !v.changes) return;
  v.changes.forEach(change => {
    const node = document.getElementById(change.nodeId);
    if (node) node.classList.add('vcs-' + change.type);
  });
}

// ─── WIDGET DIFFS ───
function applyWidgetDiffs() {
  // Clear all widget diff highlights
  document.querySelectorAll('.widget-card').forEach(card => {
    card.classList.remove('diff-added', 'diff-removed', 'diff-modified');
    const badge = card.querySelector('.widget-diff-badge');
    if (badge) badge.remove();
  });

  const v = VERSIONS[currentVersionIdx];
  if (!v.widgetChanges || v.widgetChanges.length === 0) return;

  v.widgetChanges.forEach(change => {
    // Find widget card by matching widget id
    const widgetIdx = WIDGETS.findIndex(w => w.id === change.widgetId);
    if (widgetIdx === -1) return;
    const card = document.getElementById(`widgetCard${widgetIdx}`);
    if (!card) return;

    card.classList.add('diff-' + change.type);

    // Add diff badge
    const badge = document.createElement('div');
    badge.className = `widget-diff-badge diff-badge-${change.type}`;
    badge.textContent = change.type.charAt(0).toUpperCase() + change.type.slice(1);
    badge.title = change.desc;
    card.querySelector('.widget-card-info').appendChild(badge);
  });
}

// ─── FLOW / TEST CASE DIFFS ───
function applyFlowDiffs() {
  // Clear all flow diff highlights
  document.querySelectorAll('.flow-card').forEach(card => {
    card.classList.remove('diff-added', 'diff-removed', 'diff-modified');
    const badge = card.querySelector('.flow-diff-badge');
    if (badge) badge.remove();
  });

  const v = VERSIONS[currentVersionIdx];
  if (!v.flowChanges || v.flowChanges.length === 0) return;

  v.flowChanges.forEach(change => {
    // Find flow card by matching flow id
    const flowIdx = FLOWS.findIndex(f => f.id === change.flowId);
    if (flowIdx === -1) return;
    const card = document.getElementById(`flowCard${flowIdx}`);
    if (!card) return;

    card.classList.add('diff-' + change.type);

    // Add diff badge
    const badge = document.createElement('div');
    badge.className = `flow-diff-badge diff-badge-${change.type}`;
    badge.textContent = change.type.charAt(0).toUpperCase() + change.type.slice(1);
    badge.title = change.desc;
    const top = card.querySelector('.flow-card-top');
    if (top) top.appendChild(badge);
  });
}

function openVisualDiff(verIdx, diffIdx) {
  const v = VERSIONS[verIdx];
  if (!v.diffs || !v.diffs[diffIdx]) return;
  const diff = v.diffs[diffIdx];
  const prevV = verIdx > 0 ? VERSIONS[verIdx - 1] : VERSIONS[0];

  document.getElementById('vdiffTitle').textContent = diff.title;
  document.getElementById('vdiffOldVer').textContent = prevV.hash;
  document.getElementById('vdiffNewVer').textContent = v.hash;

  let body = `<div class="vdiff-description">${diff.description}</div>`;

  // Build visual mockup
  body += buildVisualDiffMockup(diff.mockup, diff);

  // If multiple diffs in this version, add nav
  if (v.diffs.length > 1) {
    body += `<div style="display:flex;justify-content:center;gap:8px;margin-top:16px">`;
    v.diffs.forEach((d, i) => {
      const isActive = i === diffIdx;
      body += `<button onclick="openVisualDiff(${verIdx},${i})" style="padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:.15s;
        background:${isActive ? 'var(--vibe-purple)' : 'var(--dark-surface)'};
        color:${isActive ? '#fff' : 'var(--text-secondary)'};">${i + 1}. ${d.title.substring(0, 30)}…</button>`;
    });
    body += `</div>`;
  }

  document.getElementById('vdiffBody').innerHTML = body;
  document.getElementById('vdiffModal').classList.add('active');
}

function buildVisualDiffMockup(mockupId, diff) {
  const browser = (url, content) => `
    <div class="vdiff-browser">
      <div class="vdiff-browser-chrome">
        <div class="vdiff-browser-dots"><span></span><span></span><span></span></div>
        <div class="vdiff-browser-url">${url}</div>
      </div>
      <div class="vdiff-viewport">${content}</div>
    </div>`;

  switch (mockupId) {

    case 'nav-signup-removed':
      return browser('https://tooldonate.com/', `
        <div class="mock-nav">
          <div class="mock-nav-logo">Tool Library</div>
          <div class="mock-nav-links">
            <span class="mock-nav-link" style="font-weight:700">Home</span>
            <span class="mock-nav-link">Catalog</span>
            <span class="mock-nav-link">My Loans</span>
            <span class="vd-deleted" style="display:inline-block">
              <span class="mock-btn primary" style="padding:6px 16px;font-size:12px">Sign Up Free</span>
            </span>
          </div>
        </div>
        <div class="mock-hero">
          <h2 style="font-size:28px">COMMUNITY<br><em>TOOL LIBRARY</em></h2>
          <p>Why buy when you can borrow? Access shared tools from your neighbors.</p>
          <div class="mock-btns">
            <span class="mock-btn primary">Browse Catalog →</span>
            <span class="vd-added" style="display:inline-block">
              <span class="mock-btn secondary">Get Started</span>
            </span>
          </div>
        </div>
      `);

    case 'search-moved':
      return browser('https://tooldonate.com/', `
        <div class="mock-nav" style="flex-wrap:wrap;gap:8px">
          <div class="mock-nav-logo">Tool Library</div>
          <div class="vd-moved-new" style="display:inline-flex;flex:1;max-width:260px;margin:0 16px">
            <div style="width:100%;padding:7px 12px;background:#f3ede4;border-radius:6px;font-size:12px;color:#8B7A69;display:flex;align-items:center;gap:6px">
              🔍 Search tools across all categories…
            </div>
          </div>
          <div class="mock-nav-links">
            <span class="mock-nav-link" style="font-weight:700">Home</span>
            <span class="mock-nav-link">Catalog</span>
            <span class="mock-nav-link">My Loans</span>
          </div>
        </div>
        <div class="mock-hero">
          <h2 style="font-size:28px">COMMUNITY<br><em>TOOL LIBRARY</em></h2>
          <p>Why buy when you can borrow?</p>
        </div>
        <div style="padding:0 28px 16px;text-align:center">
          <div class="vd-moved-old" style="display:inline-flex;width:280px;margin:0 auto">
            <div style="width:100%;padding:8px 14px;background:#f3ede4;border-radius:6px;font-size:12px;color:#8B7A69;opacity:.5">
              🔍 Search tools…
            </div>
          </div>
          <div style="font-size:11px;color:#999;margin-top:8px">↑ Previously located here on catalog page</div>
        </div>
      `);

    case 'quick-borrow-added':
      return browser('https://tooldonate.com/', `
        <div class="mock-nav">
          <div class="mock-nav-logo">Tool Library</div>
          <div class="mock-nav-links">
            <span class="mock-nav-link" style="font-weight:700">Home</span>
            <span class="mock-nav-link">Catalog</span>
            <span class="mock-nav-link">My Loans</span>
          </div>
        </div>
        <div class="mock-hero" style="padding-bottom:16px">
          <h2 style="font-size:28px">COMMUNITY<br><em>TOOL LIBRARY</em></h2>
          <p style="margin-bottom:16px">Why buy when you can borrow?</p>
          <div class="mock-btns"><span class="mock-btn primary">Browse Catalog →</span></div>
        </div>
        <div style="padding:0 28px 24px">
          <div class="vd-added" style="padding:20px;background:#fff;border-radius:12px;border:1px solid #e8e0d8;display:flex;align-items:center;gap:20px">
            <div style="width:56px;height:56px;border-radius:10px;background:#f3ede4;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">🔧</div>
            <div style="flex:1;text-align:left">
              <div style="font-size:15px;font-weight:700;color:#3B2710;margin-bottom:2px">Quick Borrow: Cordless Drill</div>
              <div style="font-size:12px;color:#8B7A69">Most popular this week · Available now</div>
            </div>
            <span class="mock-btn primary" style="font-size:12px;padding:8px 18px;white-space:nowrap">Borrow Now →</span>
          </div>
        </div>
      `);

    case 'overdue-banner':
      return browser('https://tooldonate.com/my-loans', `
        <div class="mock-nav">
          <div class="mock-nav-logo">Tool Library</div>
          <div class="mock-nav-links">
            <span class="mock-nav-link">Home</span>
            <span class="mock-nav-link">Catalog</span>
            <span class="mock-nav-link" style="font-weight:700">My Loans</span>
          </div>
        </div>
        <div class="vd-added" style="margin:16px 28px;padding:14px 20px;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;display:flex;align-items:center;gap:12px">
          <span style="font-size:22px">⚠️</span>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:#991B1B">You have 1 overdue item</div>
            <div style="font-size:12px;color:#B91C1C">Circular Saw — 3 days overdue. Please return ASAP to avoid fees.</div>
          </div>
          <span class="mock-btn" style="background:#DC2626;color:#fff;font-size:12px;padding:7px 16px">Return Now</span>
        </div>
        <div style="padding:4px 28px">
          <div style="font-size:16px;font-weight:700;color:#3B2710;margin-bottom:12px">Active Loans</div>
          <div class="mock-card" style="margin-bottom:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div class="mock-card-title">Cordless Drill</div>
                <div class="mock-card-desc">Borrowed Feb 2 · Due Feb 9</div>
              </div>
              <span class="mock-badge" style="background:#DCFCE7;color:#16A34A">On Time</span>
            </div>
          </div>
        </div>
      `);

    case 'admin-moved':
      return browser('https://tooldonate.com/', `
        <div class="mock-nav">
          <div class="mock-nav-logo">Tool Library</div>
          <div class="mock-nav-links">
            <span class="mock-nav-link" style="font-weight:700">Home</span>
            <span class="mock-nav-link">Catalog</span>
            <span class="mock-nav-link">My Loans</span>
          </div>
          <div class="vd-moved-new" style="display:inline-flex;position:relative">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;cursor:pointer">O</div>
            <div style="position:absolute;top:40px;right:0;background:#fff;border:1px solid #e8e0d8;border-radius:8px;padding:6px;width:160px;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:5">
              <div style="padding:6px 10px;font-size:12px;color:#6B5A49;border-radius:4px;cursor:pointer">My Profile</div>
              <div style="padding:6px 10px;font-size:12px;color:#6B5A49;border-radius:4px;cursor:pointer">My Loans</div>
              <div style="padding:6px 10px;font-size:12px;color:#4F46E5;font-weight:600;border-radius:4px;background:#EEF2FF;cursor:pointer">⚙ Admin Dashboard</div>
              <div style="border-top:1px solid #e8e0d8;margin-top:4px;padding-top:4px">
                <div style="padding:6px 10px;font-size:12px;color:#EF4444;border-radius:4px;cursor:pointer">Log out</div>
              </div>
            </div>
          </div>
        </div>
        <div class="mock-hero">
          <h2 style="font-size:28px">COMMUNITY<br><em>TOOL LIBRARY</em></h2>
          <p>Why buy when you can borrow?</p>
          <div class="mock-btns">
            <span class="mock-btn primary">Browse Catalog →</span>
            <span class="vd-moved-old" style="display:inline-block">
              <span class="mock-btn secondary" style="opacity:.5">Admin Access</span>
            </span>
          </div>
        </div>
      `);

    default:
      return '<div style="padding:40px;text-align:center;color:var(--text-muted)">No visual preview available</div>';
  }
}

function renderCodeContent() {
  const codeStr = `// HPI 1.7-G
import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  AnimatePresence
} from 'framer-motion';
import {
  Wrench,
  Search,
  Calendar,
  Shield,
  ArrowRight,
  Terminal,
  Cpu,
  Activity,
  ChevronRight,
  Box,
  Layers,
  Zap
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Image } from '@/components/ui/image';
import useMember from '@/integrations';

// --- Types & Interfaces ---
interface Feature {
  icon: React.ComponentType;
  title: string;
  description: string;
  color: string;
}

interface HeroStats {
  label: string;
  value: string;
  suffix?: string;
}

// --- Constants ---
const HERO_STATS: HeroStats[] = [
  { label: 'Tools Available', value: '500', suffix: '+' },
  { label: 'Active Members', value: '2.4K' },
  { label: 'Monthly Loans', value: '890' },
];

const FEATURES: Feature[] = [
  {
    icon: Search,
    title: 'Smart Catalog',
    description: 'Browse and search tools with real-time filtering',
    color: '#4F46E5',
  },
  {
    icon: Calendar,
    title: 'Easy Scheduling',
    description: 'Book pickup times that work for you',
    color: '#22C55E',
  },
  {
    icon: Shield,
    title: 'Trusted Community',
    description: 'Verified members and damage protection',
    color: '#F59E0B',
  },
  {
    icon: Activity,
    title: 'Loan Tracking',
    description: 'Real-time status on all your borrows',
    color: '#3B82F6',
  },
];

// --- Component ---
export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const { data: member } = useMember();

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <Header />
      <motion.section
        ref={heroRef}
        style={{ y, opacity }}
        className="relative pt-32 pb-20 px-6 text-center"
      >
        {/* Hero content */}
      </motion.section>
      <Footer />
    </div>
  );
}`;

  const area = document.getElementById('codeEditArea');
  const lines = codeStr.split('\\n');
  area.innerHTML = lines.map((line, i) => {
    let hl = escapeHtml(line);
    // Keywords
    hl = hl.replace(/\\b(import|from|export|const|let|var|async|await|function|return|if|else|for|of|new|interface|default|type)\\b/g, '<span class="hl-kw">$1</span>');
    // Strings
    hl = hl.replace(/(&#x27;[^&#]*?&#x27;)/g, '<span class="hl-str">$1</span>');
    hl = hl.replace(/(&quot;[^&]*?&quot;)/g, '<span class="hl-str">$1</span>');
    // Comments
    hl = hl.replace(/(\/\/.*)/g, '<span class="hl-cm">$1</span>');
    // Numbers
    hl = hl.replace(/\\b(\\d+\\.?\\d*)\\b/g, '<span class="hl-num">$1</span>');
    // Types
    hl = hl.replace(/\\b(React|HTMLDivElement|Feature|HeroStats|ComponentType)\\b/g, '<span class="hl-type">$1</span>');
    return '<div class="ce-line"><span class="ce-num">' + (i + 1) + '</span><span class="ce-content">' + hl + '</span></div>';
  }).join('');
}

// ─── WIDGET LIBRARY ───
let currentWidgetIdx = null;

function expandWidget(idx) {
  const widget = WIDGETS[idx];
  if (!widget) return;
  currentWidgetIdx = idx;

  const grid = document.getElementById('widgetGrid');
  const detail = document.getElementById('widgetDetail');
  const cats = document.querySelector('.widget-categories');
  if (!grid || !detail) return;

  grid.style.display = 'none';
  if (cats) cats.style.display = 'none';
  detail.style.display = 'flex';

  document.getElementById('wdIcon').textContent = widget.icon;
  document.getElementById('wdName').textContent = widget.name;
  document.getElementById('wdCat').textContent = widget.category;
  document.getElementById('wdDesc').textContent = widget.description;

  // Build controls panel
  const propsEl = document.getElementById('wdProps');
  propsEl.innerHTML = widget.props.map((p, pi) => {
    if (p.type === 'color') {
      return `<div class="sb-control">
        <label class="sb-label">${p.name}</label>
        <div class="sb-color-row">
          <input type="color" class="sb-color" value="${p.default}" data-prop="${pi}" oninput="updateWidgetPreview()">
          <span class="sb-color-hex">${p.default}</span>
        </div>
      </div>`;
    }
    if (p.type === 'select') {
      return `<div class="sb-control">
        <label class="sb-label">${p.name}</label>
        <select class="sb-select" data-prop="${pi}" onchange="updateWidgetPreview()">
          ${(p.options || []).map(o => `<option value="${o}" ${o === p.default ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>`;
    }
    if (p.type === 'boolean') {
      return `<div class="sb-control sb-control-row">
        <label class="sb-label">${p.name}</label>
        <input type="checkbox" class="sb-toggle" data-prop="${pi}" ${p.default ? 'checked' : ''} onchange="updateWidgetPreview()">
      </div>`;
    }
    // Default: text
    return `<div class="sb-control">
      <label class="sb-label">${p.name}</label>
      <input type="text" class="sb-input" value="${p.default}" data-prop="${pi}" oninput="updateWidgetPreview()">
    </div>`;
  }).join('') + `<button class="sb-reset" onclick="resetWidgetProps()">Reset to Defaults</button>`;

  // Render initial preview
  updateWidgetPreview();
}

function updateWidgetPreview() {
  const widget = WIDGETS[currentWidgetIdx];
  if (!widget || !widget.render) return;

  // Collect current prop values from inputs
  const props = {};
  widget.props.forEach((p, pi) => {
    const input = document.querySelector(`[data-prop="${pi}"]`);
    if (!input) { props[p.name] = p.default; return; }
    if (p.type === 'boolean') {
      props[p.name] = input.checked;
    } else {
      props[p.name] = input.value;
    }
    // Update color hex display
    if (p.type === 'color') {
      const hex = input.parentElement.querySelector('.sb-color-hex');
      if (hex) hex.textContent = input.value;
    }
  });

  document.getElementById('wdPreview').innerHTML = widget.render(props);
}

function resetWidgetProps() {
  const widget = WIDGETS[currentWidgetIdx];
  if (!widget) return;
  widget.props.forEach((p, pi) => {
    const input = document.querySelector(`[data-prop="${pi}"]`);
    if (!input) return;
    if (p.type === 'boolean') { input.checked = !!p.default; }
    else { input.value = p.default; }
  });
  updateWidgetPreview();
}

function closeWidgetDetail() {
  currentWidgetIdx = null;
  const grid = document.getElementById('widgetGrid');
  const detail = document.getElementById('widgetDetail');
  const cats = document.querySelector('.widget-categories');
  if (grid) grid.style.display = '';
  if (cats) cats.style.display = '';
  if (detail) detail.style.display = 'none';
}

function wizardGoToStep(stepValue) {
  const widget = WIDGETS[currentWidgetIdx];
  if (!widget) return;
  const stepPropIdx = widget.props.findIndex(pr => pr.name === 'step');
  if (stepPropIdx < 0) return;
  const sel = document.querySelector(`[data-prop="${stepPropIdx}"]`);
  if (sel) { sel.value = stepValue; updateWidgetPreview(); }
}

function filterWidgets(category, btn) {
  // Update active state
  document.querySelectorAll('.widget-cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const cards = document.querySelectorAll('.widget-card');
  cards.forEach(card => {
    if (category === 'all' || card.dataset.category === category) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// ─── NODE CONTEXT MENU ───
let selectedNodeId = null;

function openNodeMenu(nodeId, event) {
  event.stopPropagation();
  selectedNodeId = nodeId;
  const node = document.getElementById(nodeId);
  if (!node) return;

  const rect = node.getBoundingClientRect();
  const canvasWrap = document.getElementById('flowCanvasWrap');
  if (!canvasWrap) return;
  
  let menu = document.getElementById('nodeContextMenu');
  if (!menu) {
    const menuEl = document.createElement('div');
    menuEl.id = 'nodeContextMenu';
    menuEl.className = 'node-context-menu';
    document.body.appendChild(menuEl);
    menu = menuEl;
  }

  const flowNode = findFlowNode(nodeId);
  const isWidget = flowNode && flowNode.type === 'widget';
  menu.innerHTML = `
    <div class="node-menu-item" onclick="viewNodePage()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <span>${isWidget ? 'View Widget' : 'View Page'}</span>
    </div>
    <div class="node-menu-item" onclick="viewNodeSource()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      <span>View Source Code</span>
    </div>
    <div class="node-menu-item" onclick="viewNodeTests()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
      <span>View Related User Stories</span>
    </div>
    ${isWidget ? `<div class="node-menu-item" onclick="viewNodeInWidgetLibrary()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      <span>View in Widget Library</span>
    </div>` : ''}
  `;

  const wrapRect = canvasWrap.getBoundingClientRect();
  
  let left = rect.left + rect.width / 2 - 140;
  let top = rect.top + rect.height / 2 - 60;
  
  if (left < wrapRect.left) left = wrapRect.left + 10;
  if (left + 280 > wrapRect.right) left = wrapRect.right - 290;
  if (top < wrapRect.top) top = wrapRect.top + 10;
  if (top + 120 > wrapRect.bottom) top = rect.top - 130;

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.classList.add('active');
}

function closeNodeMenu() {
  const menu = document.getElementById('nodeContextMenu');
  if (menu) menu.classList.remove('active');
}

function findFlowNode(nodeId) {
  for (const n of FLOW_NODES) {
    if (n.id === nodeId) return n;
    if (n.children) {
      const child = n.children.find(c => c.id === nodeId);
      if (child) return child;
    }
  }
  return null;
}

function findParentFlowNode(nodeId) {
  for (const n of FLOW_NODES) {
    if (n.id === nodeId) return n;
    if (n.children && n.children.some(c => c.id === nodeId)) return n;
  }
  return null;
}

function navigateToSiteTab() {
  const codeView = document.getElementById('codeEditorView');
  if (codeView && codeView.classList.contains('active')) {
    switchEditorTab('site');
  }
}

function resolvePageForNode(node) {
  const label = node.label.toLowerCase();
  const parent = findParentFlowNode(node.id || selectedNodeId);
  const parentLabel = parent ? parent.label.toLowerCase() : '';
  const context = label + ' ' + parentLabel;

  if (context.includes('catalog') || context.includes('product') || context.includes('search') || context.includes('filter') || context.includes('cart') || context.includes('waitlist')) {
    return 'Catalog';
  } else if (context.includes('admin') || context.includes('api dashboard')) {
    return 'Admin';
  }
  return 'Home';
}

function viewNodePage() {
  const node = findFlowNode(selectedNodeId);
  closeNodeMenu();
  if (!node) return;

  navigateToSiteTab();
  const page = resolvePageForNode(node);
  selectPage(page);
}

function navigateToCodeTab() {
  const codeView = document.getElementById('codeEditorView');
  if (!codeView || !codeView.classList.contains('active')) {
    switchEditorTab('code');
  }
}

function viewNodeSource() {
  const node = findFlowNode(selectedNodeId);
  closeNodeMenu();
  if (!node || !node.file) return;

  navigateToCodeTab();

  setTimeout(() => {
    const area = document.getElementById('codeEditArea');
    if (!area) return;

    const filePath = node.file;
    const fileName = filePath.split('/').pop() || filePath;
    const mockCode = generateCodeForNode(node);
    const lines = mockCode.split('\n');
    area.innerHTML = lines.map((line, i) => {
      let hl = escapeHtml(line);
      hl = hl.replace(/\b(import|from|export|const|let|var|async|await|function|return|if|else|for|of|new|interface|default|type|class|extends|implements)\b/g, '<span class="hl-kw">$1</span>');
      hl = hl.replace(/(&#x27;[^&#]*?&#x27;)/g, '<span class="hl-str">$1</span>');
      hl = hl.replace(/(&quot;[^&]*?&quot;)/g, '<span class="hl-str">$1</span>');
      hl = hl.replace(/(\/\/.*)/g, '<span class="hl-cm">$1</span>');
      hl = hl.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-num">$1</span>');
      return '<div class="ce-line"><span class="ce-num">' + (i + 1) + '</span><span class="ce-content">' + hl + '</span></div>';
    }).join('');

    const codeTab = document.querySelector('.code-tab-bar .code-tab.active');
    if (codeTab) codeTab.innerHTML = '<span style="color:#4EC9B0">✦</span> ' + fileName + ' <span class="close-x">×</span>';

    const breadcrumb = document.querySelector('.code-breadcrumb');
    if (breadcrumb) {
      const parts = filePath.split('/');
      breadcrumb.innerHTML = parts.map((p, i) =>
        i < parts.length - 1
          ? p + ' <span>›</span> '
          : '<span style="color:var(--text-primary)">' + p + '</span>'
      ).join('');
    }

    const treeFiles = document.querySelectorAll('.code-tree .tree-file');
    treeFiles.forEach(f => {
      f.classList.remove('active');
      if (f.textContent.trim() === fileName) f.classList.add('active');
    });
  }, 100);
}

function viewNodeTests() {
  const node = findFlowNode(selectedNodeId);
  closeNodeMenu();
  if (!node) return;

  selectPage('Product Flows');
  setTimeout(() => {
    const cards = document.querySelectorAll('.flow-card');
    for (const card of cards) {
      if (card.textContent.includes(node.label)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--vibe-purple)';
        setTimeout(() => card.style.outline = '', 2000);
        return;
      }
    }
  }, 200);
}

function viewNodeInWidgetLibrary() {
  const node = findFlowNode(selectedNodeId);
  closeNodeMenu();
  if (!node) return;

  // Navigate to the Insights sub-tab (which contains the Widget Library)
  switchAdvancedSubTab('flows');

  setTimeout(() => {
    // Find and click the Widget Library tab button
    const tabBtns = document.querySelectorAll('.flows-tab-menu .flows-tab');
    const widgetsBtn = Array.from(tabBtns).find(b => b.textContent.includes('Widget Library'));
    if (widgetsBtn) switchFlowsTab('widgets', widgetsBtn);

    // Try to find and expand the matching widget
    setTimeout(() => {
      const matchIdx = findMatchingWidgetIndex(node.label);
      if (matchIdx >= 0) {
        expandWidget(matchIdx);
      }
    }, 100);
  }, 100);
}

function findMatchingWidgetIndex(nodeLabel) {
  const words = nodeLabel.toLowerCase().split(/\s+/);
  let bestIdx = -1;
  let bestScore = 0;

  WIDGETS.forEach((w, idx) => {
    const wWords = w.name.toLowerCase().split(/\s+/);
    let score = 0;
    for (const word of words) {
      if (wWords.some(ww => ww.includes(word) || word.includes(ww))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  return bestScore > 0 ? bestIdx : -1;
}

function generateCodeForNode(node) {
  const name = (node.label || 'Component').replace(/[^a-zA-Z0-9]/g, '');
  const file = node.file || 'Unknown';
  const editor = node.editor || 'Unknown';

  const codeTemplates = {
    'pg-login': `import React, { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Input, Card } from '@/components/ui';
import { useNavigate } from 'react-router-dom';

// File: ${file}
// Last edit: ${editor}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login({ email, password });
    if (result.success) {
      navigate('/');  // → Home Page on success
    }
    // On failure → Auth Error Page is shown by AuthGuard
  };

  return (
    <Card className="max-w-md mx-auto mt-20 p-8">
      <h1 className="text-2xl font-bold mb-6">Welcome back</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <form onSubmit={handleSubmit}>
        <Input label="Email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={isLoading}>Sign In</Button>
      </form>
    </Card>
  );
}`,
    'pg-auth-error': `import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

// File: ${file}
// Last edit: ${editor}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Authentication Failed</h1>
        <p className="text-gray-600 mb-6">
          Your credentials could not be verified. Please try again.
        </p>
        <Link to="/login" className="btn-primary">
          Back to Login
        </Link>
      </div>
    </div>
  );
}`,
    'pg-home': `import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import FeaturesGrid from '@/components/FeaturesGrid';
import CommunityStats from '@/components/CommunityStats';

// File: ${file}
// Last edit: ${editor}

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <Header />
      <motion.section ref={heroRef}>
        <HeroSection />
      </motion.section>

      {/* Navigation cards → Catalog Page, Admin Panel */}
      <section className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 gap-6">
        <Link to="/catalog" className="nav-card">
          Browse Catalog →
        </Link>
        <Link to="/admin" className="nav-card">
          Admin Panel →
        </Link>
      </section>

      <FeaturesGrid />
      <CommunityStats />
      <Footer />
    </div>
  );
}`,
    'wg-hero': `import React from 'react';
import { motion } from 'framer-motion';

// File: ${file}
// Last edit: ${editor}

export default function HeroSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative pt-32 pb-20 px-6 text-center"
    >
      <h1 className="text-5xl font-bold tracking-tight">
        Share Tools, Build Community
      </h1>
      <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
        Borrow and lend tools in your neighborhood.
      </p>
      <div className="mt-8 flex gap-4 justify-center">
        <a href="/catalog" className="btn-primary">Browse Catalog</a>
        <a href="/about" className="btn-secondary">Learn More</a>
      </div>
    </motion.section>
  );
}`,
    'wg-features': `import React from 'react';
import { Search, Calendar, Shield, Activity } from 'lucide-react';

// File: ${file}
// Last edit: ${editor}

const FEATURES = [
  { icon: Search, title: 'Smart Catalog', desc: 'Browse with real-time filtering', color: '#4F46E5' },
  { icon: Calendar, title: 'Easy Scheduling', desc: 'Book pickup times', color: '#22C55E' },
  { icon: Shield, title: 'Trusted Community', desc: 'Verified members', color: '#F59E0B' },
  { icon: Activity, title: 'Loan Tracking', desc: 'Real-time borrow status', color: '#3B82F6' },
];

export default function FeaturesGrid() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {FEATURES.map((f) => (
          <div key={f.title} className="text-center">
            <f.icon className="w-10 h-10 mx-auto mb-3" style={{ color: f.color }} />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
    'wg-stats': `import React from 'react';
import { useInView } from 'framer-motion';
import CountUp from 'react-countup';

// File: ${file}
// Last edit: ${editor}

const STATS = [
  { label: 'Tools Available', value: 500, suffix: '+' },
  { label: 'Active Members', value: 2400, suffix: '' },
  { label: 'Monthly Loans', value: 890, suffix: '' },
];

export default function CommunityStats() {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="bg-gray-50 py-16">
      <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
        {STATS.map((s) => (
          <div key={s.label}>
            <div className="text-4xl font-bold">
              {isInView ? <CountUp end={s.value} duration={2} /> : 0}{s.suffix}
            </div>
            <div className="text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}`,
    'pg-catalog': `import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import CategoryFilter from '@/components/CategoryFilter';
import { fetchTools } from '@/api/tools';

// File: ${file}
// Last edit: ${editor}

export default function CatalogPage() {
  const [searchParams] = useSearchParams();
  const [tools, setTools] = useState([]);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    fetchTools({ query, category }).then(setTools);
  }, [query, category]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <SearchBar value={query} onChange={setQuery} />
        <CategoryFilter selected={category} onChange={setCategory} />
        <div className="grid grid-cols-3 gap-6 mt-8">
          {tools.map((tool) => (
            <Link key={tool.id} to={\`/product/\${tool.id}\`}
              className="product-card hover:shadow-lg transition">
              <img src={tool.image} alt={tool.name} />
              <h3 className="font-semibold mt-2">{tool.name}</h3>
              <p className="text-gray-500 text-sm">{tool.category}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}`,
    'wg-search': `import React from 'react';
import { Search } from 'lucide-react';

// File: ${file}
// Last edit: ${editor}

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative max-w-xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tools..."
        className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2"
      />
    </div>
  );
}`,
    'wg-filter': `import React from 'react';

// File: ${file}
// Last edit: ${editor}

const CATEGORIES = ['All', 'Power Tools', 'Hand Tools', 'Garden', 'Automotive', 'Electronics'];

interface CategoryFilterProps {
  selected: string;
  onChange: (cat: string) => void;
}

export default function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 mt-4 flex-wrap">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat.toLowerCase())}
          className={\`px-4 py-2 rounded-full text-sm font-medium transition
            \${selected === cat.toLowerCase()
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}\`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}`,
    'pg-admin': `import React from 'react';
import { AdminGuard } from '@/auth/AdminGuard';
import AdminCatalog from '@/pages/AdminCatalog';
import APIDashboard from '@/components/APIDashboard';
import { Tabs, TabPanel } from '@/components/ui';

// File: ${file}
// Last edit: ${editor}

// Accessed from: Home Page → Click "Admin Panel"

export default function AdminPanel() {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
          <Tabs defaultTab="catalog">
            <TabPanel id="catalog" label="Catalog Manager">
              <AdminCatalog />
            </TabPanel>
            <TabPanel id="api" label="API Dashboard">
              <APIDashboard />
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </AdminGuard>
  );
}`,
    'wg-admin-list': `import React, { useState, useEffect } from 'react';
import { fetchAllTools, deleteTool, updateTool } from '@/api/admin';

// File: ${file}
// Last edit: ${editor}

export default function AdminCatalog() {
  const [tools, setTools] = useState([]);

  useEffect(() => {
    fetchAllTools().then(setTools);
  }, []);

  const handleDelete = async (id: string) => {
    await deleteTool(id);
    setTools((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-4">Tool</th>
            <th className="text-left p-4">Category</th>
            <th className="text-left p-4">Status</th>
            <th className="text-right p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.id} className="border-b hover:bg-gray-50">
              <td className="p-4 font-medium">{tool.name}</td>
              <td className="p-4 text-gray-500">{tool.category}</td>
              <td className="p-4">
                <span className={\`badge \${tool.available ? 'badge-green' : 'badge-red'}\`}>
                  {tool.available ? 'Available' : 'On Loan'}
                </span>
              </td>
              <td className="p-4 text-right">
                <button onClick={() => handleDelete(tool.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`,
    'wg-admin-api': `import React, { useState, useEffect } from 'react';

// File: ${file}
// Last edit: ${editor}

// Fetches data from: GET /api/admin/panel

interface DashboardData {
  totalUsers: number;
  activeLoans: number;
  overdueItems: number;
  apiLatency: number;
}

export default function APIDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/admin/panel')
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) return <div>Loading dashboard...</div>;

  return (
    <div className="grid grid-cols-4 gap-6">
      <StatCard label="Total Users" value={data.totalUsers} />
      <StatCard label="Active Loans" value={data.activeLoans} />
      <StatCard label="Overdue" value={data.overdueItems} color="red" />
      <StatCard label="API Latency" value={\`\${data.apiLatency}ms\`} />
    </div>
  );
}`,
    'pg-product': `import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProduct, checkStock } from '@/api/products';
import AddToCart from '@/components/AddToCart';
import WaitlistButton from '@/components/WaitlistButton';

// File: ${file}
// Last edit: ${editor}

// Accessed from: Catalog Page → Click product card

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [inStock, setInStock] = useState(false);

  useEffect(() => {
    fetchProduct(id).then(setProduct);
    checkStock(id).then(setInStock);
  }, [id]);

  if (!product) return <div className="animate-pulse">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link to="/catalog" className="text-indigo-600 mb-4 inline-block">
        ← Back to Catalog
      </Link>
      <div className="grid grid-cols-2 gap-12 mt-4">
        <img src={product.image} alt={product.name} className="rounded-lg" />
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-gray-600 mt-2">{product.description}</p>
          <div className="mt-6">
            {inStock ? (
              <AddToCart productId={id} />
            ) : (
              <WaitlistButton productId={id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}`,
    'wg-add-cart': `import React, { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { addToCart } from '@/api/cart';

// File: ${file}
// Last edit: ${editor}

interface AddToCartProps {
  productId: string;
}

export default function AddToCart({ productId }: AddToCartProps) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    setLoading(true);
    await addToCart(productId);
    setAdded(true);
    setLoading(false);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <button
      onClick={handleAdd}
      disabled={loading || added}
      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
    >
      <ShoppingCart className="w-5 h-5" />
      {added ? 'Added!' : loading ? 'Adding...' : 'Add to Cart'}
    </button>
  );
}`,
    'pg-waitlist': `import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { joinWaitlist } from '@/api/waitlist';

// File: ${file}
// Last edit: ${editor}

export default function WaitlistPage() {
  const { id } = useParams();
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
    await joinWaitlist(id, email);
    setJoined(true);
  };

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Out of Stock</h1>
      <p className="text-gray-600 mb-6">
        This tool is currently on loan. Join the waitlist to be notified.
      </p>
      {joined ? (
        <div className="text-green-600 font-semibold">You're on the list!</div>
      ) : (
        <div className="flex gap-2">
          <input type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 px-4 py-2 border rounded-lg" />
          <button onClick={handleJoin}
            className="px-6 py-2 bg-amber-500 text-white rounded-lg">
            Notify Me
          </button>
        </div>
      )}
    </div>
  );
}`
  };

  return codeTemplates[node.id] || `import React from 'react';

// File: ${file}
// Last edit: ${editor}

export default function ${name}() {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">${node.label}</h2>
      {/* Component implementation */}
    </div>
  );
}`;
}

function openCodeFromNode(node) {
  document.getElementById('codeFilePath').textContent = node.file || 'Unknown file';
  const mockCode = generateCodeForNode(node);
  document.getElementById('codeBody').innerHTML = `<div class="code-block">${highlightTS(mockCode)}</div>`;
  document.getElementById('codeModal').classList.add('active');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.node-context-menu') && !e.target.closest('.fn')) {
    closeNodeMenu();
  }
});

// ─── VERSION COMPARISON ───
let compareMode = false;
let compareVersionIdx = null;

function selectVersionForCompare(idx) {
  if (compareMode && compareVersionIdx === idx) {
    compareMode = false;
    compareVersionIdx = null;
  } else if (compareMode) {
    compareVersionIdx = idx;
  } else {
    compareMode = true;
    compareVersionIdx = idx;
  }
  updateVcUI();
  renderVersionComparison();
}

function renderVersionComparison() {
  if (!compareMode || compareVersionIdx === null) return;
  
  const v1 = VERSIONS[currentVersionIdx];
  const v2 = VERSIONS[compareVersionIdx];
  
  applyDiffsToTree();
}

function openCodeDiff() {
  if (!compareMode || compareVersionIdx === null) return;
  
  const v1 = VERSIONS[currentVersionIdx];
  const v2 = VERSIONS[compareVersionIdx];
  
  let modal = document.getElementById('codeDiffModal');
  if (!modal) {
    const modalEl = document.createElement('div');
    modalEl.id = 'codeDiffModal';
    modalEl.className = 'modal-overlay';
    modalEl.innerHTML = `
      <div class="code-diff-modal">
        <div class="code-diff-header">
          <div class="code-diff-versions">
            <span class="code-diff-ver">v${currentVersionIdx + 1} (${v1.hash})</span>
            <span style="color:var(--text-muted)">vs</span>
            <span class="code-diff-ver">v${compareVersionIdx + 1} (${v2.hash})</span>
          </div>
          <button class="vis-close" onclick="closeModal('codeDiffModal')">✕</button>
        </div>
        <div class="code-diff-body" id="codeDiffBody"></div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modal = modalEl;
  }
  
  const oldCode = getVersionCode(v1);
  const newCode = getVersionCode(v2);
  const diff = generateCodeDiff(oldCode, newCode);
  
  document.getElementById('codeDiffBody').innerHTML = diff;
  document.getElementById('codeDiffModal').classList.add('active');
}

function getVersionCode(version) {
  return `// Version ${version.hash}\n// ${version.label}\n// ${version.description || ''}\n\n${version.diffs && version.diffs.length > 0 ? version.diffs.map(d => d.description).join('\\n') : 'No code changes in this version'}`;
}

function generateCodeDiff(oldCode, newCode) {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  let html = '<div class="code-diff-container"><div class="code-diff-left"><div class="code-diff-header-row">Old Version</div>';
  
  oldLines.forEach((line, i) => {
    const newIdx = newLines.indexOf(line);
    let cls = 'code-diff-line';
    if (newIdx === -1) {
      cls += ' deleted';
    } else if (newIdx !== i) {
      cls += ' moved';
    }
    html += `<div class="${cls}"><span class="code-diff-num">${i + 1}</span><span class="code-diff-content">${escapeHtml(line)}</span></div>`;
  });
  
  html += '</div><div class="code-diff-right"><div class="code-diff-header-row">New Version</div>';
  
  newLines.forEach((line, i) => {
    const oldIdx = oldLines.indexOf(line);
    let cls = 'code-diff-line';
    if (oldIdx === -1) {
      cls += ' added';
    } else if (oldIdx !== i) {
      cls += ' moved-new';
    }
    html += `<div class="${cls}"><span class="code-diff-num">${i + 1}</span><span class="code-diff-content">${escapeHtml(line)}</span></div>`;
  });
  
  html += '</div></div>';
  return html;
}

// Expose functions used by inline onclick handlers
window.showScreen = showScreen;
window.startGeneration = startGeneration;
window.togglePageDropdown = togglePageDropdown;
window.selectPage = selectPage;
window.switchEditorTab = switchEditorTab;
window.switchAdvancedSubTab = switchAdvancedSubTab;
window.switchFlowsTab = switchFlowsTab;
window.runAllFlows = runAllFlows;
window.runFlow = runFlow;
window.canvasZoom = canvasZoom;
window.canvasReset = canvasReset;
window.toggleCanvasNode = toggleCanvasNode;
window.openVisualize = openVisualize;
window.visNext = visNext;
window.visPrev = visPrev;
window.openCode = openCode;
window.regenerateCode = regenerateCode;
window.codeModalVcPrev = codeModalVcPrev;
window.codeModalVcNext = codeModalVcNext;
window.toggleCodeDiff = toggleCodeDiff;
window.closeModal = closeModal;
window.goToVersion = goToVersion;
window.vcPrev = vcPrev;
window.vcNext = vcNext;
window.openVisualDiff = openVisualDiff;
window.toggleTreeNode = toggleTreeNode;
window.expandWidget = expandWidget;
window.closeWidgetDetail = closeWidgetDetail;
window.filterWidgets = filterWidgets;
window.updateWidgetPreview = updateWidgetPreview;
window.resetWidgetProps = resetWidgetProps;
window.openNodeMenu = openNodeMenu;
window.closeNodeMenu = closeNodeMenu;
window.viewNodePage = viewNodePage;
window.viewNodeSource = viewNodeSource;
window.viewNodeTests = viewNodeTests;
window.viewNodeInWidgetLibrary = viewNodeInWidgetLibrary;
window.selectVersionForCompare = selectVersionForCompare;
window.openCodeDiff = openCodeDiff;
