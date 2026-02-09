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

  return `
    <div class="flow-card fade-in" id="flowCard${idx}">
      <div class="flow-card-top">
        <div class="flow-status ${statusClass}"></div>
        <div class="flow-title">${flow.title}</div>
        <span class="flow-duration">${durationText}</span>
        ${resultBadge}
      </div>
      <div class="flow-desc">${flow.desc}</div>
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
          View Source Code
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

function renderVisStep() {
  const flow = FLOWS[visFlowIdx];
  const step = flow.steps[visStepIdx];

  document.getElementById('visUrl').textContent = step.url;

  const viewport = document.getElementById('visStepContent');
  const isLast = visStepIdx === flow.steps.length - 1;

  viewport.innerHTML = `
    <div class="vis-step-num">Step ${visStepIdx + 1} of ${flow.steps.length}</div>
    <div class="vis-step-action">${step.action}</div>
    <div class="vis-step-detail">${step.detail}</div>
    ${!isLast ? '<div class="vis-click-indicator"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2"><path d="M6 3l14 9-14 9V3z"/></svg></div>' : '<div style="margin-top:16px;font-size:24px">✅</div>'}
  `;
  viewport.parentElement.style.background = isLast ? '#F0FFF4' : '#FAF8F5';

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

// ─── CODE MODAL ───
function openCode(idx) {
  const flow = FLOWS[idx];
  document.getElementById('codeFilePath').textContent = `tests/flows/${flow.id}.spec.ts`;
  document.getElementById('codeBody').innerHTML = `<div class="code-block">${highlightTS(flow.code)}</div>`;
  document.getElementById('codeModal').classList.add('active');
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
function switchEditorTab(tab) {
  const tabs = document.querySelectorAll('.tab-group .tab-item');
  tabs.forEach(t => {
    t.classList.remove('active');
    if (t.textContent.trim().toLowerCase() === tab) t.classList.add('active');
  });

  const chatPanel = document.getElementById('chatPanel');
  const previewArea = document.querySelector('.preview-area');
  const codeView = document.getElementById('codeEditorView');
  const flowsPage = document.getElementById('flowsPage');
  const sitePreview = document.getElementById('sitePreview');
  const pageBar = document.getElementById('pageBar');

  const codeContent = document.getElementById('codeContent');
  const flowsCode = document.getElementById('flowsPageCode');

  if (tab === 'code') {
    chatPanel.style.display = 'none';
    previewArea.style.display = 'none';
    codeView.classList.add('active');
    // Reset code view to show code (not flows)
    codeContent.style.display = 'flex';
    flowsCode.style.display = 'none';
    if (!document.getElementById('codeEditArea').innerHTML) renderCodeContent();
    initVersionTimeline();
  } else {
    chatPanel.style.display = '';
    previewArea.style.display = '';
    codeView.classList.remove('active');
    // Restore correct page view
    flowsPage.classList.remove('active');
    sitePreview.style.display = 'block';
    // Show the right page based on currentPage
    const siteHome = document.getElementById('siteHome');
    const siteCatalog = document.getElementById('siteCatalog');
    if (currentPage === 'Catalog') {
      siteHome.style.display = 'none';
      siteCatalog.classList.add('active');
    } else {
      siteHome.style.display = 'block';
      siteCatalog.classList.remove('active');
    }
  }
}

// ─── FLOWS TAB SWITCHING ───
function switchFlowsTab(tab, btn) {
  // Update tab buttons
  const menu = btn.closest('.flows-tab-menu');
  menu.querySelectorAll('.flows-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  // Update tab content
  const container = btn.closest('.flows-page, #flowsPageCode, [id^="flowsPage"]') || btn.closest('[style*="overflow"]');
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

  // Update diff count
  const dc = document.getElementById('vcDiffCount');
  if (v.changes.length > 0) {
    dc.style.display = '';
    const totalDiffs = v.diffs ? v.diffs.length : 0;
    dc.textContent = totalDiffs + ' change' + (totalDiffs !== 1 ? 's' : '');
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

  // Apply diffs to user flows tree if visible
  applyDiffsToTree();
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
      <span>View Related Test Cases</span>
    </div>
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
window.closeModal = closeModal;
window.goToVersion = goToVersion;
window.vcPrev = vcPrev;
window.vcNext = vcNext;
window.openVisualDiff = openVisualDiff;
window.toggleTreeNode = toggleTreeNode;
window.openNodeMenu = openNodeMenu;
window.closeNodeMenu = closeNodeMenu;
window.viewNodePage = viewNodePage;
window.viewNodeSource = viewNodeSource;
window.viewNodeTests = viewNodeTests;
window.selectVersionForCompare = selectVersionForCompare;
window.openCodeDiff = openCodeDiff;
