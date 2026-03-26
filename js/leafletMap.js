class LeafletMap {

  /**
   * Class constructor with basic configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      onPointSelect: _config.onPointSelect || null,
      onMapClick: _config.onMapClick || null,
    };
    this.data = _data;
    this.colorData = _data;
    this.colorBy = 'timeGap';
    this.mapStyle = 'aerial';
    this.selectedPoint = null;
    this.ordinalScale = d3.scaleOrdinal(d3.schemeTableau10);
    this.initVis();
  }

  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

    vis.esriUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    vis.esriAttr = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

    vis.topoUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    vis.topoAttr = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';

    vis.thOutUrl = 'https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey={apikey}';
    vis.thOutAttr = '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    vis.stUrl = 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}';
    vis.stAttr = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    vis.aerialLayer = L.tileLayer(vis.esriUrl, {
      id: 'esri-image',
      attribution: vis.esriAttr,
      ext: 'png'
    });

    vis.streetLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        id: 'esri-street',
        attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NGA, EPA, USDA',
        ext: 'png'
      }
    );

    vis.theMap = L.map('my-map', {
      center: [30, 0],
      zoom: 2,
      layers: [vis.aerialLayer]
    });

    vis.fitToData(vis.data);

    L.svg({ clickable: true }).addTo(vis.theMap);
    vis.overlay = d3.select(vis.theMap.getPanes().overlayPane);
    vis.svg = vis.overlay.select('svg').attr('pointer-events', 'auto');
    vis.g = vis.svg.append('g').attr('class', 'leaflet-zoom-hide');

    vis.renderVis();

    vis.theMap.on('viewreset zoomend move', function() {
      vis.updateVis();
    });

    vis.theMap.on('click', function() {
      if (vis.config.onMapClick) {
        vis.config.onMapClick();
      }
    });
  }

  updateVis() {
    let vis = this;

    vis.Dots
      .attr('cx', d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr('cy', d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .attr('fill', d => vis.getPointColor(d))
      .attr('r', d => vis.getPointRadius(d))
      .attr('stroke-width', d => vis.getPointStrokeWidth(d));
  }

  updateState(globalState, filteredData, colorBaseData) {
    // Handle Basemap toggle
    if (this.mapStyle !== globalState.mapStyle) {
      const currentLayer = this.mapStyle === 'aerial' ? this.aerialLayer : this.streetLayer;
      const nextLayer = globalState.mapStyle === 'aerial' ? this.aerialLayer : this.streetLayer;

      if (this.theMap.hasLayer(currentLayer)) this.theMap.removeLayer(currentLayer);
      if (!this.theMap.hasLayer(nextLayer)) this.theMap.addLayer(nextLayer);

      this.mapStyle = globalState.mapStyle;
    }

    // Update local properties
    this.colorBy = globalState.colorBy;
    this.selectedPoint = globalState.selectedPoint;
    this.data = filteredData;
    // colorBaseData is filtered only by Request Type (not chart clicks),
    // so color scales stay stable when cross-filtering between charts
    this.colorData = colorBaseData || filteredData;

    // Re-render
    this.updateColorScales();
    this.renderVis();
  }

  getRequestedDate(d) {
    return new Date(d.DATE_CREATED || '');
  }

  getUpdatedDate(d) {
    return new Date(d.DATE_LAST_UPDATE || d.DATE_CLOSED || '');
  }

  getTimeGapDays(d) {
    const requestedDate = this.getRequestedDate(d);
    const updatedDate = this.getUpdatedDate(d);

    if (!Number.isFinite(requestedDate.getTime()) || !Number.isFinite(updatedDate.getTime())) {
      return null;
    }

    return Math.max(0, (updatedDate - requestedDate) / (1000 * 60 * 60 * 24));
  }

  updateColorScales() {
    const vis = this;

    if (vis.colorBy === 'timeGap') {
      const values = vis.colorData
        .map(d => vis.getTimeGapDays(d))
        .filter(v => Number.isFinite(v));
      const extent = values.length > 0 ? d3.extent(values) : [0, 1];
      const domain = extent[0] === extent[1] ? [extent[0], extent[0] + 1] : extent;
      vis.timeGapScale = d3.scaleSequential(d3.interpolateYlOrRd).domain(domain);
      return;
    }

    let categories;
    if (vis.colorBy === 'neighborhood') {
      categories = [...new Set(vis.colorData.map(d => d.NEIGHBORHOOD || 'Unknown'))];
    } else if (vis.colorBy === 'priority') {
      categories = [...new Set(vis.colorData.map(d => d.PRIORITY || 'Unknown'))];
    } else {
      categories = [...new Set(vis.colorData.map(d => d.DEPT_NAME || 'Unknown'))];
    }

    vis.ordinalScale.domain(categories.sort(d3.ascending));
  }

  getPointColor(d) {
    const vis = this;

    if (vis.colorBy === 'timeGap') {
      const days = vis.getTimeGapDays(d);
      return Number.isFinite(days) ? vis.timeGapScale(days) : '#9aa5b1';
    }

    if (vis.colorBy === 'neighborhood') {
      return vis.ordinalScale(d.NEIGHBORHOOD || 'Unknown');
    }

    if (vis.colorBy === 'priority') {
      return vis.ordinalScale(d.PRIORITY || 'Unknown');
    }

    return vis.ordinalScale(d.DEPT_NAME || 'Unknown');
  }

  getPointRadius(d) {
    const zoom = this.theMap ? this.theMap.getZoom() : 2;
    const baseRadius = Math.max(3, Math.min(10, 2.5 + (zoom * 0.35)));
    const isSelected = this.selectedPoint && d.SR_NUMBER === this.selectedPoint.SR_NUMBER;
    return isSelected ? baseRadius + 2 : baseRadius;
  }

  getPointStrokeWidth(d) {
    const isSelected = this.selectedPoint && d.SR_NUMBER === this.selectedPoint.SR_NUMBER;
    return isSelected ? 2 : 1;
  }

  renderVis() {
    let vis = this;

    vis.updateColorScales();

    console.log(`[renderVis] Attempting to draw ${vis.data.length} points.`);

    vis.Dots = vis.g.selectAll('circle')
      .data(vis.data, d => d.SR_NUMBER)
      .join(
        enter => enter.append('circle')
          .style('cursor', 'pointer')
          .attr('fill', d => vis.getPointColor(d))
          .attr('stroke', 'black')
          .attr('r', d => vis.getPointRadius(d)),
        update => update,
        exit => exit.remove()
      );
    
    vis.Dots
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration('150')
          .attr('stroke', 'red')
          .attr('r', vis.getPointRadius(d) + 1.5);

        d3.select('#tooltip')
          .style('opacity', 1)
          .style('z-index', 1000000)
          .html(`<div class="tooltip-label">
            <strong>Call Date:</strong> ${d.DATE_CREATED || d.DATE_TIME_RECEIVED || 'N/A'}<br>
            <strong>Last Update Date:</strong> ${d.DATE_LAST_UPDATE || d.DATE_CLOSED || 'N/A'}<br>
            <strong>Agency:</strong> ${d.DEPT_NAME || 'N/A'}<br>
            <strong>Call Type:</strong> ${d.SR_TYPE || 'N/A'}<br>
            <strong>Description:</strong> ${d.SR_TYPE_DESC || d.GROUP_DESC || 'N/A'}
          </div>`);
      })
      .on('mousemove', event => {
        d3.select('#tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration('150')
          .attr('stroke', 'black')
          .attr('r', d => vis.getPointRadius(d));

        d3.select('#tooltip').style('opacity', 0);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        if (vis.config.onPointSelect) {
          vis.config.onPointSelect(d);
        }
      });

    vis.updateVis();
  }

  fitToData(data) {
    let vis = this;
    const validPoints = data.filter(d => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));

    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints.map(d => [d.latitude, d.longitude]));
      const leftColW = document.querySelector('.left-column')?.offsetWidth || 270;
      const chartsW = document.querySelector('.charts-panel')?.offsetWidth || 330;
      const timelineH = document.querySelector('.timeline-panel')?.offsetHeight || 130;

      vis.theMap.fitBounds(bounds, {
        paddingTopLeft: [55 + leftColW - 400, 50],
        paddingBottomRight:[12 + chartsW + 20,  12 + timelineH + 20],
        maxZoom: 14
      });
      vis.theMap.setZoom(Math.min(vis.theMap.getZoom(), 14));
      vis.theMap.setMinZoom(vis.theMap.getZoom());
    }
  }
}