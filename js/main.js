
let leafletMap;
let filterPanel;
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

    // Run initial update to sync everything
    updateApp();
  })
  .catch(error => console.error(error));
