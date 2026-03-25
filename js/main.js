
let leafletMap;
let filterPanel;
let neighborhoodHeatmap;
let priorityPieChart;
let allData = [];

// Establish the Global State Object
const globalState = {
  selectedType: 'ALL',
  selectedNeighborhood: 'ALL',
  selectedPriority: 'ALL',
  colorBy: 'timeGap',
  mapStyle: 'aerial',
  selectedPoint: null,
  brushedPoints: [] // Placeholder for future brushing
};

// Central State Updater
function setGlobalState(newState) {
  Object.assign(globalState, newState);
  updateApp();
}

// Central Application Controller
function updateApp() {
  const typeFilteredData = globalState.selectedType === 'ALL'
    ? allData
    : allData.filter(d => d.srType === globalState.selectedType);

  const neighborhoodExists = globalState.selectedNeighborhood === 'ALL'
    || typeFilteredData.some(d => (d.NEIGHBORHOOD || 'Unknown') === globalState.selectedNeighborhood);

  const effectiveNeighborhood = neighborhoodExists ? globalState.selectedNeighborhood : 'ALL';
  globalState.selectedNeighborhood = effectiveNeighborhood;

  const filteredData = effectiveNeighborhood === 'ALL'
    ? typeFilteredData
    : typeFilteredData.filter(d => (d.NEIGHBORHOOD || 'Unknown') === effectiveNeighborhood);

  const priorityExists = globalState.selectedPriority === 'ALL'
    || filteredData.some(d => (d.PRIORITY || 'Unknown') === globalState.selectedPriority);

  const effectivePriority = priorityExists ? globalState.selectedPriority : 'ALL';
  globalState.selectedPriority = effectivePriority;

  const finalFilteredData = effectivePriority === 'ALL'
    ? filteredData
    : filteredData.filter(d => (d.PRIORITY || 'Unknown') === effectivePriority);

  // Push all state to the map at once
  leafletMap.updateState(globalState, finalFilteredData);

  // Push state to the filter panel
  filterPanel.updateUI(globalState, finalFilteredData.length, allData.length, finalFilteredData);

  // Keep neighborhood heatmap in sync with current request-type filter.
  neighborhoodHeatmap.updateData(typeFilteredData, effectiveNeighborhood);

  // Keep priority pie chart in sync with current request-type filter.
  priorityPieChart.updateData(typeFilteredData, effectivePriority);
}
// d3.csv('data/311_full_preprocessed_data.csv')
d3.csv('data/311_sample_preprocessed_data.csv')
  .then(data => {
    data.forEach(d => {
      d.latitude = d.LATITUDE.trim() === '' ? NaN : +d.LATITUDE;
      d.longitude = d.LONGITUDE.trim() === '' ? NaN : +d.LONGITUDE;
      d.srType = d.SR_TYPE || 'Unknown';
    });

    allData = data.filter(d => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));
    const missingGpsCount = data.filter(d => d.MISSING_GPS === 'TRUE').length;

    console.log('number of items: ' + allData.length);
    console.log('number of missing items: ' + missingGpsCount);

    leafletMap = new LeafletMap({
      parentElement: '#my-map',
      onPointSelect: point => {
        // Toggle logic: if clicking the currently selected point, unclick it (set to null)
        if (globalState.selectedPoint && point && globalState.selectedPoint.SR_NUMBER === point.SR_NUMBER) {
          setGlobalState({ selectedPoint: null });
        } else {
          setGlobalState({ selectedPoint: point });
        }
      },
      onMapClick: () => {
        setGlobalState({ selectedPoint: null });
      }
    }, allData);

    neighborhoodHeatmap = new NeighborhoodHeatmap({
      parentElement: '#chart-neighborhood .chart-body',
      onTileSelect: neighborhood => {
        setGlobalState({ selectedNeighborhood: neighborhood, selectedPoint: null });
      }
    });

    priorityPieChart = new PriorityPieChart({
      parentElement: '#chart-priority .chart-body',
      onSliceSelect: priority => {
        setGlobalState({ selectedPriority: priority, selectedPoint: null });
      }
    });

    // Initialize Filter Panel
    filterPanel = new FilterPanel(allData, missingGpsCount, {
      onFilterChange: (newFilters) => {
        setGlobalState(newFilters);
      },
      onClearSelection: () => {
        setGlobalState({ selectedPoint: null });
      }
    });

    // Run initial update to sync everything
    updateApp();
  })
  .catch(error => console.error(error));
