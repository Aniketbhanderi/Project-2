
let leafletMap;
let filterPanel;
let neighborhoodHeatmap;
let priorityPieChart;
let srTypeChart;
let methodChart;
let deptChart;
let allData = [];

// Establish the Global State Object
const globalState = {
  selectedType: 'ALL',
  selectedSrTypes: [],
  selectedNeighborhoods: [],
  selectedPriorities: [],
  selectedAgencies: [],
  selectedMethods: [],
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

  // Helper: apply an array filter (empty array = no filter)
  const applyFilter = (data, arr, accessor) =>
    arr.length === 0 ? data : data.filter(d => arr.includes(accessor(d)));

  const getSrType = d => d.srType;
  const getNeighborhood = d => d.NEIGHBORHOOD || 'Unknown';
  const getPriority = d => d.PRIORITY || 'Unknown';
  const getAgency = d => d.DEPT_NAME || 'Unknown';
  const getMethod = d => d.METHOD_RECEIVED || 'Unknown';

  // Full cascade → map gets everything
  const withSrType  = applyFilter(typeFilteredData, globalState.selectedSrTypes, getSrType);
  const withNeighborhood = applyFilter(withSrType, globalState.selectedNeighborhoods, getNeighborhood);
  const withPriority = applyFilter(withNeighborhood, globalState.selectedPriorities, getPriority);
  const withAgency = applyFilter(withPriority, globalState.selectedAgencies, getAgency);
  const finalFilteredData = applyFilter(withAgency, globalState.selectedMethods, getMethod);

  // Each chart sees all active filters EXCEPT its own dimension,
  // so its elements stay visible (faded vs highlighted) rather than disappearing.
  const forSrTypeBar = applyFilter(applyFilter(applyFilter(applyFilter(typeFilteredData, globalState.selectedNeighborhoods, getNeighborhood), globalState.selectedPriorities, getPriority), globalState.selectedAgencies, getAgency), globalState.selectedMethods, getMethod);
  const forHeatmap   = applyFilter(applyFilter(applyFilter(applyFilter(typeFilteredData, globalState.selectedSrTypes, getSrType), globalState.selectedPriorities, getPriority), globalState.selectedAgencies, getAgency), globalState.selectedMethods, getMethod);
  const forPieChart  = applyFilter(applyFilter(applyFilter(applyFilter(typeFilteredData, globalState.selectedSrTypes, getSrType), globalState.selectedNeighborhoods, getNeighborhood), globalState.selectedAgencies, getAgency), globalState.selectedMethods, getMethod);
  const forAgencyBar = applyFilter(applyFilter(applyFilter(applyFilter(typeFilteredData, globalState.selectedSrTypes, getSrType), globalState.selectedNeighborhoods, getNeighborhood), globalState.selectedPriorities, getPriority), globalState.selectedMethods, getMethod);
  const forMethodBar = applyFilter(applyFilter(applyFilter(applyFilter(typeFilteredData, globalState.selectedSrTypes, getSrType), globalState.selectedNeighborhoods, getNeighborhood), globalState.selectedPriorities, getPriority), globalState.selectedAgencies, getAgency);

  leafletMap.updateState(globalState, finalFilteredData, typeFilteredData);
  filterPanel.updateUI(globalState, finalFilteredData.length, allData.length, finalFilteredData, typeFilteredData);

  srTypeChart.update(forSrTypeBar, globalState.selectedSrTypes, typeFilteredData);
  deptChart.update(forAgencyBar, globalState.selectedAgencies, typeFilteredData);
  methodChart.update(forMethodBar, globalState.selectedMethods, typeFilteredData);
  neighborhoodHeatmap.updateData(forHeatmap, globalState.selectedNeighborhoods, typeFilteredData);
  priorityPieChart.updateData(forPieChart, globalState.selectedPriorities, typeFilteredData);
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
      legendElement: '#chart-neighborhood .chart-legend-container',
      onTileSelect: neighborhoods => {
        setGlobalState({ selectedNeighborhoods: neighborhoods, selectedPoint: null });
      }
    });

    priorityPieChart = new PriorityPieChart({
      parentElement: '#chart-priority .chart-body',
      legendElement: '#chart-priority .chart-legend-container',
      onSliceSelect: priorities => {
        setGlobalState({ selectedPriorities: priorities, selectedPoint: null });
      }
    });

    // Initialize Filter Panel
    filterPanel = new FilterPanel(allData, missingGpsCount, {
      onFilterChange: (newFilters) => {
        setGlobalState(newFilters);
      },
      onClearSelection: () => {
        setGlobalState({
          selectedSrTypes: [],
          selectedNeighborhoods: [],
          selectedPriorities: [],
          selectedAgencies: [],
          selectedMethods: [],
          selectedPoint: null
        });
      }
    });

    srTypeChart = new BarChart({
      parentElement: '#chart-sr-type .chart-body',
      legendElement: '#chart-sr-type .chart-legend-container',
      xKey: 'srType',
      yKey: 'Requests',
      scrollable: true,
      label: 'Request Type',
      onBarSelect: srTypes => {
        setGlobalState({ selectedSrTypes: srTypes, selectedPoint: null });
      }
    }, allData);

    methodChart = new BarChart({
      parentElement: '#chart-method-received .chart-body',
      legendElement: '#chart-method-received .chart-legend-container',
      xKey: 'METHOD_RECEIVED',
      yKey: 'Requests',
      scrollable: true,
      margin: { top: 6, right: 32, bottom: 6, left: 52 },
      label: 'Method',
      onBarSelect: methods => {
        setGlobalState({ selectedMethods: methods, selectedPoint: null });
      }
    }, allData);

    deptChart = new BarChart({
      parentElement: '#chart-agency .chart-body',
      legendElement: '#chart-agency .chart-legend-container',
      xKey: 'DEPT_NAME',
      yKey: 'Requests',
      scrollable: true,
      label: 'Agency',
      onBarSelect: agencies => {
        setGlobalState({ selectedAgencies: agencies, selectedPoint: null });
      }
    }, allData);

    // Run initial update to sync everything
    updateApp();
  })
  .catch(error => console.error(error));
