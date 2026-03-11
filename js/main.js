
let leafletMap;
let filterPanel;

d3.csv('data/311Sample.csv')
  .then(data => {
    data.forEach(d => {
      d.latitude = +d.LATITUDE;
      d.longitude = +d.LONGITUDE;
      d.srType = d.SR_TYPE || 'Unknown';
    });

    const allData = data.filter(d => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));

    console.log('number of items: ' + allData.length);

    leafletMap = new LeafletMap({
      parentElement: '#my-map',
      onPointSelect: point => {
        if (filterPanel) {
          filterPanel.setSelectedPoint(point);
        }
      }
    }, allData);
    filterPanel = new FilterPanel(allData, ({ filteredData, colorBy, mapStyle }) => {
      leafletMap.setMapStyle(mapStyle);
      leafletMap.setColorBy(colorBy);
      leafletMap.setData(filteredData);
    }, () => {
      leafletMap.clearSelection();
      filterPanel.setSelectedPoint(null);
    });
  })
  .catch(error => console.error(error));
