let leafletMap;
let filterPanel;
let neighborhoodHeatmap;
let cityGridHeatmap;
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
  showCityHeatmap: false,
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
  if (cityGridHeatmap) {
    cityGridHeatmap.updateData(finalFilteredData, globalState.showCityHeatmap);
  }
  filterPanel.updateUI(globalState, finalFilteredData.length, allData.length, finalFilteredData, typeFilteredData);

  // When a map brush is active, charts show only the brushed subset so all views stay in sync
  const brushData = globalState.brushedPoints.length > 0 ? globalState.brushedPoints : null;

  srTypeChart.update(brushData || forSrTypeBar, globalState.selectedSrTypes, typeFilteredData);
  deptChart.update(brushData || forAgencyBar, globalState.selectedAgencies, typeFilteredData);
  methodChart.update(brushData || forMethodBar, globalState.selectedMethods, typeFilteredData);
  neighborhoodHeatmap.updateData(brushData || forHeatmap, globalState.selectedNeighborhoods, typeFilteredData);
  priorityPieChart.updateData(brushData || forPieChart, globalState.selectedPriorities, typeFilteredData);
}
// Performance tracking
const appStartTime = performance.now();
console.log('🚀 Application initialization started...');

console.log('📂 Loading CSV data...');
const csvLoadStart = performance.now();

//d3.csv('data/311_sample_preprocessed_data.csv')
d3.csv('data/311_sampled_5000.csv')
  .then(data => {
    const csvLoadEnd = performance.now();
    console.log(`✅ CSV data loaded in ${(csvLoadEnd - csvLoadStart).toFixed(2)}ms`);

    console.log('🔄 Processing data...');
    const processingStart = performance.now();

    data.forEach(d => {
      d.latitude = d.LATITUDE.trim() === '' ? NaN : +d.LATITUDE;
      d.longitude = d.LONGITUDE.trim() === '' ? NaN : +d.LONGITUDE;
      d.srType = d.SR_TYPE || 'Unknown';
    });

    allData = data.filter(d => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));
    const missingGpsCount = data.filter(d => d.MISSING_GPS === 'TRUE').length;

    const processingEnd = performance.now();
    console.log(`✅ Data processing completed in ${(processingEnd - processingStart).toFixed(2)}ms`);
    console.log('📊 Number of items: ' + allData.length);
    console.log('⚠️ Number of missing GPS items: ' + missingGpsCount);

    // Initialize Leaflet Map
    console.log('🗺️ Loading Leaflet Map...');
    const mapStart = performance.now();
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
    const mapEnd = performance.now();
    console.log(`✅ Leaflet Map loaded in ${(mapEnd - mapStart).toFixed(2)}ms`);

    // Initialize city-wide grid heatmap overlay
    cityGridHeatmap = new CityGridHeatmap({
      map: leafletMap.theMap
    }, allData);

    // Brush Map toggle button for selecting points by drawing a rectangle on the map
    const brushMapBtn = document.createElement('button');
    brushMapBtn.id        = 'brush-map-btn';
    brushMapBtn.className = 'map-style-toggle';
    brushMapBtn.type      = 'button';
    brushMapBtn.textContent = '⬚  Brush Map: Off';
    brushMapBtn.addEventListener('click', () => {
      const isNowOn = leafletMap.toggleBrushMode();
      if (isNowOn) {
        brushMapBtn.textContent       = '⬚  Brush Map: ON';
        brushMapBtn.style.background  = '#bee3f8';
        brushMapBtn.style.borderColor = '#63b3ed';
        brushMapBtn.style.color       = '#1a365d';
      } else {
        brushMapBtn.textContent       = '⬚  Brush Map: Off';
        brushMapBtn.style.background  = '';
        brushMapBtn.style.borderColor = '';
        brushMapBtn.style.color       = '';
      }
    });
    document.querySelector('.toolbar-panel').appendChild(brushMapBtn);

    // Initialize Neighborhood Heatmap
    console.log('🔥 Loading Neighborhood Heatmap...');
    const heatmapStart = performance.now();

    neighborhoodHeatmap = new NeighborhoodHeatmap({
      parentElement: '#chart-neighborhood .chart-body',
      legendElement: '#chart-neighborhood .chart-legend-container',
      onTileSelect: neighborhoods => {
        setGlobalState({ selectedNeighborhoods: neighborhoods, selectedPoint: null });
      },
      onClearSelection: () => {
        setGlobalState({ selectedNeighborhoods: [], selectedPoint: null });
      }
    });
    const heatmapEnd = performance.now();
    console.log(`✅ Neighborhood Heatmap loaded in ${(heatmapEnd - heatmapStart).toFixed(2)}ms`);

    // Initialize Priority Pie Chart
    console.log('🥧 Loading Priority Pie Chart...');
    const pieStart = performance.now();
    priorityPieChart = new PriorityPieChart({
      parentElement: '#chart-priority .chart-body',
      legendElement: '#chart-priority .chart-legend-container',
      onSliceSelect: priorities => {
        setGlobalState({ selectedPriorities: priorities, selectedPoint: null });
      },
      onClearSelection: () => {
        setGlobalState({ selectedPriorities: [], selectedPoint: null });
      }
    });
    const pieEnd = performance.now();
    console.log(`✅ Priority Pie Chart loaded in ${(pieEnd - pieStart).toFixed(2)}ms`);

    // Initialize Filter Panel
    console.log('🎛️ Loading Filter Panel...');
    const filterStart = performance.now();
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
    const filterEnd = performance.now();
    console.log(`✅ Filter Panel loaded in ${(filterEnd - filterStart).toFixed(2)}ms`);

    // Initialize SR Type Bar Chart
    console.log('📊 Loading SR Type Bar Chart...');
    const srTypeStart = performance.now();
    srTypeChart = new BarChart({
      parentElement: '#chart-sr-type .chart-body',
      legendElement: '#chart-sr-type .chart-legend-container',
      xKey: 'srType',
      yKey: 'Requests',
      scrollable: true,
      label: 'Request Type',
      onBarSelect: srTypes => {
        setGlobalState({ selectedSrTypes: srTypes, selectedPoint: null });
      },
      onClearSelection: () => {
        setGlobalState({ selectedSrTypes: [], selectedPoint: null });
      }
    }, allData);
    const srTypeEnd = performance.now();
    console.log(`✅ SR Type Bar Chart loaded in ${(srTypeEnd - srTypeStart).toFixed(2)}ms`);

    // Initialize Method Bar Chart
    console.log('📊 Loading Method Received Bar Chart...');
    const methodStart = performance.now();
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
      },
      onClearSelection: () => {
        setGlobalState({ selectedMethods: [], selectedPoint: null });
      }
    }, allData);
    const methodEnd = performance.now();
    console.log(`✅ Method Received Bar Chart loaded in ${(methodEnd - methodStart).toFixed(2)}ms`);

    // Initialize Agency Bar Chart
    console.log('📊 Loading Agency Bar Chart...');
    const deptStart = performance.now();
    deptChart = new BarChart({
      parentElement: '#chart-agency .chart-body',
      legendElement: '#chart-agency .chart-legend-container',
      xKey: 'DEPT_NAME',
      yKey: 'Requests',
      scrollable: true,
      label: 'Agency',
      onBarSelect: agencies => {
        setGlobalState({ selectedAgencies: agencies, selectedPoint: null });
      },
      onClearSelection: () => {
        setGlobalState({ selectedAgencies: [], selectedPoint: null });
      }
    }, allData);
    const deptEnd = performance.now();
    console.log(`✅ Agency Bar Chart loaded in ${(deptEnd - deptStart).toFixed(2)}ms`);

    // Run initial update to sync everything
    console.log('🔄 Running initial app update...');
    const updateStart = performance.now();
    updateApp();
    const updateEnd = performance.now();
    console.log(`✅ Initial app update completed in ${(updateEnd - updateStart).toFixed(2)}ms`);

    // Total time
    const appEndTime = performance.now();
    const totalLoadTime = appEndTime - appStartTime;
    console.log(`\n⏱️ ========== TOTAL LOAD TIME: ${totalLoadTime.toFixed(2)}ms ==========`);
    console.log('🎉 Application fully initialized and ready!');
  })
  .catch(error => {
    console.error('❌ Error loading application:', error);
    const appErrorTime = performance.now();
    console.log(`⏱️ Application failed after ${(appErrorTime - appStartTime).toFixed(2)}ms`);
  });