class FilterPanel {
  constructor(data, onFilterChange, onClearSelection) {
    this.data = data;
    this.onFilterChange = onFilterChange;
    this.onClearSelection = onClearSelection;
    this.selectedType = 'ALL';
    this.selectedColorBy = 'timeGap';
    this.selectedMapStyle = 'aerial';

    this.typeSelector = document.querySelector('#sr-type-selector');
    this.colorBySelector = document.querySelector('#color-by-selector');
    this.mapStyleToggle = document.querySelector('#map-style-toggle');
    this.filterSummary = document.querySelector('#filter-summary');
    this.selectedPointPanel = document.querySelector('.selected-point-panel');
    this.selectedPointDetails = document.querySelector('#selected-point-details');
    this.clearSelectionButton = document.querySelector('#clear-selection');

    this.bindEvents();
    this.renderTypeSelector();
    this.setSelectedPoint(null);
    this.notifyChange();
  }

  bindEvents() {
    this.typeSelector.addEventListener('change', event => {
      this.selectedType = event.target.value;
      this.notifyChange();
    });

    this.colorBySelector.addEventListener('change', event => {
      this.selectedColorBy = event.target.value;
      this.notifyChange();
    });

    this.mapStyleToggle.addEventListener('click', () => {
      this.selectedMapStyle = this.selectedMapStyle === 'aerial' ? 'streets' : 'aerial';
      this.mapStyleToggle.textContent = this.selectedMapStyle === 'aerial'
        ? 'Basemap: Aerial'
        : 'Basemap: Roads/Boundaries';
      this.notifyChange();
    });

    this.clearSelectionButton.addEventListener('click', () => {
      if (this.onClearSelection) {
        this.onClearSelection();
      }
    });
  }

  renderTypeSelector() {
    const countsByType = d3.rollups(
      this.data,
      values => values.length,
      d => d.srType
    ).sort((a, b) => d3.ascending(a[0], b[0]));

    this.typeSelector.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = `All Types (${this.data.length})`;
    this.typeSelector.appendChild(allOption);

    countsByType.forEach(([srType, count]) => {
      const option = document.createElement('option');
      option.value = srType;
      option.textContent = `${srType} (${count})`;
      this.typeSelector.appendChild(option);
    });

    this.typeSelector.value = this.selectedType;
    this.updateFilterSummary();
  }

  updateFilterSummary() {
    const totalTypes = new Set(this.data.map(d => d.srType)).size;
    const visibleRequests = this.selectedType === 'ALL'
      ? this.data.length
      : this.data.filter(d => d.srType === this.selectedType).length;
    this.filterSummary.textContent = `${visibleRequests} points visible across ${totalTypes} request types.`;
  }

  notifyChange() {
    const filteredData = this.selectedType === 'ALL'
      ? this.data
      : this.data.filter(d => d.srType === this.selectedType);
    this.updateFilterSummary();
    this.onFilterChange({
      filteredData,
      colorBy: this.selectedColorBy,
      mapStyle: this.selectedMapStyle
    });
  }

  setSelectedPoint(point) {
    if (!point) {
      this.selectedPointPanel.style.display = 'none';
      this.selectedPointDetails.textContent = '';
      return;
    }

    this.selectedPointPanel.style.display = 'block';

    const rows = Object.entries(point).map(([key, value]) => {
      const safeValue = value === null || value === undefined || value === '' ? 'N/A' : value;
      return `<div class="detail-row"><span class="detail-key">${key}:</span> ${safeValue}</div>`;
    });

    this.selectedPointDetails.innerHTML = rows.join('');
  }
}