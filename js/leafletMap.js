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
    };
    this.data = _data;
    this.colorBy = 'timeGap';
    this.mapStyle = 'aerial';
    this.selectedPointId = null;
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

    vis.renderVis();

    vis.theMap.on('zoomend', function() {
      vis.updateVis();
    });

    vis.theMap.on('click', function() {
      vis.clearSelection();
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

  setData(_data) {
    this.data = _data;

    if (this.selectedPointId !== null && !this.data.some(d => d.SR_NUMBER === this.selectedPointId)) {
      this.selectedPointId = null;
      if (this.config.onPointSelect) {
        this.config.onPointSelect(null);
      }
    }

    this.updateColorScales();
    this.renderVis();
  }

  clearSelection() {
    this.selectedPointId = null;
    this.updateVis();

    if (this.config.onPointSelect) {
      this.config.onPointSelect(null);
    }
  }

  setMapStyle(_style) {
    const vis = this;
    const nextStyle = _style || 'aerial';

    if (vis.mapStyle === nextStyle) {
      return;
    }

    const currentLayer = vis.mapStyle === 'aerial' ? vis.aerialLayer : vis.streetLayer;
    const nextLayer = nextStyle === 'aerial' ? vis.aerialLayer : vis.streetLayer;

    if (vis.theMap.hasLayer(currentLayer)) {
      vis.theMap.removeLayer(currentLayer);
    }

    if (!vis.theMap.hasLayer(nextLayer)) {
      vis.theMap.addLayer(nextLayer);
    }

    vis.mapStyle = nextStyle;
  }

  setColorBy(_colorBy) {
    this.colorBy = _colorBy || 'timeGap';
    this.updateColorScales();
    this.updateVis();
  }

  getRequestedDate(d) {
    return new Date(d.DATE_CREATED || d.DATE_TIME_RECEIVED || d.TIME_RECEIVED || '');
  }

  getUpdatedDate(d) {
    return new Date(d.DATE_LAST_UPDATE || d.DATE_STATUS_CHANGE || d.DATE_CLOSED || '');
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
      const values = vis.data
        .map(d => vis.getTimeGapDays(d))
        .filter(v => Number.isFinite(v));
      const extent = values.length > 0 ? d3.extent(values) : [0, 1];
      const domain = extent[0] === extent[1] ? [extent[0], extent[0] + 1] : extent;
      vis.timeGapScale = d3.scaleSequential(d3.interpolateYlOrRd).domain(domain);
      return;
    }

    let categories;
    if (vis.colorBy === 'neighborhood') {
      categories = [...new Set(vis.data.map(d => d.NEIGHBORHOOD || 'Unknown'))];
    } else if (vis.colorBy === 'priority') {
      categories = [...new Set(vis.data.map(d => d.PRIORITY || 'Unknown'))];
    } else {
      categories = [...new Set(vis.data.map(d => d.DEPT_NAME || 'Unknown'))];
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
    return d.SR_NUMBER === this.selectedPointId ? baseRadius + 2 : baseRadius;
  }

  getPointStrokeWidth(d) {
    return d.SR_NUMBER === this.selectedPointId ? 2 : 1;
  }

  renderVis() {
    let vis = this;

    vis.updateColorScales();

    vis.Dots = vis.svg.selectAll('circle')
      .data(vis.data, d => d.SR_NUMBER)
      .join(
        enter => enter.append('circle')
          .attr('fill', d => vis.getPointColor(d))
          .attr('stroke', 'black')
          .attr('r', d => vis.getPointRadius(d)),
        update => update,
        exit => exit.remove()
      )
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration('150')
          .attr('fill', 'red')
          .attr('r', vis.getPointRadius(d) + 1.5);

        d3.select('#tooltip')
          .style('opacity', 1)
          .style('z-index', 1000000)
          .html(`<div class="tooltip-label">
            <strong>Call Date:</strong> ${d.DATE_CREATED || d.DATE_TIME_RECEIVED || 'N/A'}<br>
            <strong>Updated Date:</strong> ${d.DATE_LAST_UPDATE || d.DATE_STATUS_CHANGE || 'N/A'}<br>
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
          .attr('fill', d => vis.getPointColor(d))
          .attr('r', d => vis.getPointRadius(d));

        d3.select('#tooltip').style('opacity', 0);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        vis.selectedPointId = d.SR_NUMBER;
        vis.updateVis();

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
      vis.theMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
    }
  }
}