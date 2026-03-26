class FilterPanel {
  constructor(initialData, missingGpsCount, config) {
    this.config = config;
    this.missingGpsCount = missingGpsCount;

    this.typeSelector = document.querySelector('#sr-type-selector');
    this.colorBySelector = document.querySelector('#color-by-selector');
    this.mapStyleToggle = document.querySelector('#map-style-toggle');
    this.filterSummary = document.querySelector('#filter-summary');
    this.selectedPointPanel = document.querySelector('.selected-point-panel');
    this.selectedPointDetails = document.querySelector('#selected-point-details');
    this.clearSelectionButton = document.querySelector('#clear-selection');
    this.colorLegend = document.querySelector('#color-legend');

    this.missingGpsEl = document.querySelector('#missing-gps');

    this.renderTypeSelector(initialData);
    this.renderMissingGps();
    this.bindEvents();
  }

  bindEvents() {
    this.typeSelector.addEventListener('change', event => {
      this.config.onFilterChange({ selectedType: event.target.value });
    });

    this.colorBySelector.addEventListener('change', event => {
      this.config.onFilterChange({ colorBy: event.target.value });
    });

    this.mapStyleToggle.addEventListener('click', () => {
      const currentStyle = this.mapStyleToggle.textContent.includes('Aerial') ? 'aerial' : 'streets';
      const nextStyle = currentStyle === 'aerial' ? 'streets' : 'aerial';
      this.config.onFilterChange({ mapStyle: nextStyle });
    });

    this.clearSelectionButton.addEventListener('click', () => {
      if (this.config.onClearSelection) {
        this.config.onClearSelection();
      }
    });
  }

  renderMissingGps() {
    if (!this.missingGpsEl) return;
    if (this.missingGpsCount === 0) {
      this.missingGpsEl.textContent = '';
      return;
    }
    this.missingGpsEl.innerHTML =
      `⚠ <strong>${this.missingGpsCount}</strong> call${this.missingGpsCount !== 1 ? 's' : ''} missing GPS coordinates (excluded from map).`;
  }

  renderColorLegend(globalState, filteredData) {
    if (!this.colorLegend) return;
    this.colorLegend.innerHTML = '';

    if (globalState.colorBy === 'timeGap') {
      // Build gradient stops from d3.interpolateYlOrRd
      const stops = d3.range(11).map(i => d3.interpolateYlOrRd(i / 10));

      // Mirror the domain logic from leafletMap.js
      const values = filteredData.map(d => {
        const req = new Date(d.DATE_CREATED || d.DATE_TIME_RECEIVED || d.TIME_RECEIVED || '');
        const upd = new Date(d.DATE_LAST_UPDATE || d.DATE_STATUS_CHANGE || d.DATE_CLOSED || '');
        if (!isFinite(req) || !isFinite(upd)) return null;
        return Math.max(0, (upd - req) / 86400000);
      }).filter(v => v !== null);

      const [minDays, maxDays] = values.length > 0 ? d3.extent(values) : [0, 1];

      this.colorLegend.innerHTML = `
        <div class="legend-gradient-bar" style="background: linear-gradient(to right, ${stops.join(',')})"></div>
        <div class="legend-gradient-labels">
          <span>${Math.round(minDays)} days</span>
          <span>${Math.round(maxDays)} days</span>
        </div>`;
    } else {
      // Ordinal scale — mirror domain logic from leafletMap.js
      const accessor = {
        neighborhood: d => d.NEIGHBORHOOD || 'Unknown',
        priority:     d => d.PRIORITY     || 'Unknown',
        agency:       d => d.DEPT_NAME    || 'Unknown',
      }[globalState.colorBy];

      const categories = [...new Set(filteredData.map(accessor))].sort(d3.ascending);
      const scale = d3.scaleOrdinal(d3.schemeTableau10).domain(categories);

      const items = categories.map(cat => `
        <div class="legend-swatch-item">
          <span class="legend-swatch" style="background:${scale(cat)}"></span>
          <span class="legend-swatch-label">${cat}</span>
        </div>`).join('');

      this.colorLegend.innerHTML = `<div class="legend-swatch-list">${items}</div>`;
    }
  }

  renderTypeSelector(data) {
    const countsByType = d3.rollups(
      data,
      values => values.length,
      d => d.srType
    ).sort((a, b) => d3.ascending(a[0], b[0]));

    this.typeSelector.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = `All Types (${data.length})`;
    this.typeSelector.appendChild(allOption);

    countsByType.forEach(([srType, count]) => {
      const option = document.createElement('option');
      option.value = srType;
      option.textContent = `${srType} (${count})`;
      this.typeSelector.appendChild(option);
    });
  }

  // Called by main.js whenever global state changes
  updateUI(globalState, visibleCount, totalCount, filteredData, colorBaseData) {
    // 1. Sync Map Style Button Text
    this.mapStyleToggle.textContent = globalState.mapStyle === 'aerial'
      ? 'Basemap: Aerial'
      : 'Basemap: Roads/Boundaries';

    // 2. Sync Selectors (in case state was changed externally)
    this.typeSelector.value = globalState.selectedType;
    this.colorBySelector.value = globalState.colorBy;

    // 3. Update Summary Text
    const totalTypes = this.typeSelector.options.length - 1; // minus "ALL"
    this.filterSummary.textContent = `${visibleCount} points visible across ${totalTypes} request types.`;

    // 4. Update Color Legend (use colorBaseData so legend stays stable during cross-chart filtering)
    this.renderColorLegend(globalState, colorBaseData || filteredData || []);

    // 5. Show clear button whenever any chart selection is active
    const hasAnySelection = globalState.selectedPoint !== null
      || (globalState.selectedSrTypes || []).length > 0
      || (globalState.selectedNeighborhoods || []).length > 0
      || (globalState.selectedPriorities || []).length > 0
      || (globalState.selectedAgencies || []).length > 0
      || (globalState.selectedMethods || []).length > 0;
    this.clearSelectionButton.style.display = hasAnySelection ? 'block' : 'none';

    // 6. Update Selected Point Panel
    if (!globalState.selectedPoint) {
      this.selectedPointPanel.style.display = 'none';
      this.selectedPointDetails.innerHTML = '';
    } else {
      this.selectedPointPanel.style.display = 'block';
      const rows = Object.entries(globalState.selectedPoint).map(([key, value]) => {
        const safeValue = value === null || value === undefined || value === '' ? 'N/A' : value;
        return `<div class="detail-row"><span class="detail-key">${key}:</span> ${safeValue}</div>`;
      });
      this.selectedPointDetails.innerHTML = rows.join('');
    }
  }
}