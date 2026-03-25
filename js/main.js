
let leafletMap;
let filterPanel;
let methodChart;
let deptChart;
let allData = [];

// Establish the Global State Object
const globalState = {
  selectedType: 'ALL',
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
  const filteredData = globalState.selectedType === 'ALL'
    ? allData
    : allData.filter(d => d.srType === globalState.selectedType);

  // Push all state to the map at once
  leafletMap.updateState(globalState, filteredData);

  // Push state to the filter panel
  filterPanel.updateUI(globalState, filteredData.length, allData.length, filteredData);

  // Update bar charts with filtered data
  methodChart.update(filteredData);
  deptChart.update(filteredData);
}

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

    // Initialize Filter Panel
    filterPanel = new FilterPanel(allData, missingGpsCount, {
      onFilterChange: (newFilters) => {
        setGlobalState(newFilters);
      },
      onClearSelection: () => {
        setGlobalState({ selectedPoint: null });
      }
    });

    methodChart = new BarChart({
      parentElement: '#chart-method-received .chart-body',
      xKey: 'METHOD_RECEIVED',
      yKey: 'Requests',
      scrollable: true,
      margin: { top: 6, right: 32, bottom: 6, left: 52 }
    }, allData);

    deptChart = new BarChart({
      parentElement: '#chart-agency .chart-body',
      xKey: 'DEPT_NAME',
      yKey: 'Requests',
      scrollable: true
    }, allData);

    // Run initial update to sync everything
    updateApp();
  })
  .catch(error => console.error(error));
