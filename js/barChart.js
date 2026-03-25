class BarChart {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      xKey:          _config.xKey,
      yKey:          _config.yKey      || 'Count',
      scrollable:    _config.scrollable || false,
      barHeight:     _config.barHeight  || 12,
      barGap:        _config.barGap     || 3,
      margin:        _config.margin || { top: 6, right: 28, bottom: 6, left: 108 }
    };
    this.data = _data;
    this.initVis();
  }

  initVis() {
    const vis = this;
    const m   = vis.config.margin;

    vis.container = document.querySelector(vis.config.parentElement);
    vis.totalWidth = vis.container.clientWidth;
    vis.width      = vis.totalWidth - m.left - m.right;

    if (vis.config.scrollable) {
      vis.container.style.overflowY = 'auto';
      vis.container.style.overflowX = 'hidden';
    } else {
      vis.height = vis.container.clientHeight - m.top - m.bottom;
    }

    vis.svg = d3.select(vis.container)
      .append('svg')
        .attr('class', 'bar-chart')
        .attr('width', vis.totalWidth);

    if (!vis.config.scrollable) {
      vis.svg.attr('height', vis.container.clientHeight);
    }

    vis.chart = vis.svg.append('g')
      .attr('transform', `translate(${m.left},${m.top})`);

    vis.xScale = d3.scaleLinear().range([0, vis.width]);
    vis.yScale = d3.scaleBand().paddingInner(0.22).paddingOuter(0.1);

    vis.yAxisG = vis.chart.append('g').attr('class', 'bar-chart-axis bar-chart-y-axis');

    vis.updateVis();
  }

  updateVis() {
    const vis = this;
    const m   = vis.config.margin;

    // Aggregate: count records per category
    const counts = d3.rollup(vis.data, v => v.length, d => d[vis.config.xKey]);
    vis.aggregated = Array.from(counts, ([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

    if (vis.config.scrollable) {
      const containerHeight = vis.container.clientHeight;
      const availableHeight = containerHeight - m.top - m.bottom;
      const naturalHeight   = vis.aggregated.length * (vis.config.barHeight + vis.config.barGap);

      // Expand bars to fill when they fit; use fixed sizes and scroll when they don't
      vis.height = naturalHeight > availableHeight ? naturalHeight : availableHeight;
      vis.svg.attr('height', vis.height + m.top + m.bottom);
    }

    vis.xScale.domain([0, d3.max(vis.aggregated, d => d.value) || 1]);
    vis.yScale.range([0, vis.height]).domain(vis.aggregated.map(d => d.key));

    vis.renderVis();
  }

  renderVis() {
    const vis = this;

    // --- Bars ---
    vis.chart.selectAll('.bar-chart-bar')
      .data(vis.aggregated, d => d.key)
      .join(
        enter => enter.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', 0)
          .attr('y',      d => vis.yScale(d.key))
          .attr('height', vis.yScale.bandwidth())
          .attr('width',  d => vis.xScale(d.value)),
        update => update
          .attr('y',      d => vis.yScale(d.key))
          .attr('height', vis.yScale.bandwidth())
          .attr('width',  d => vis.xScale(d.value)),
        exit => exit.remove()
      );

    // --- Value labels (drawn to the right of each bar) ---
    vis.chart.selectAll('.bar-chart-label')
      .data(vis.aggregated, d => d.key)
      .join(
        enter => enter.append('text')
          .attr('class', 'bar-chart-label')
          .attr('x',      d => vis.xScale(d.value) + 3)
          .attr('y',      d => vis.yScale(d.key) + vis.yScale.bandwidth() / 2)
          .attr('dy', '0.35em')
          .text(d => d.value),
        update => update
          .attr('x',  d => vis.xScale(d.value) + 3)
          .attr('y',  d => vis.yScale(d.key) + vis.yScale.bandwidth() / 2)
          .text(d => d.value),
        exit => exit.remove()
      );

    // --- Y axis (category labels) ---
    vis.yAxisG.call(
      d3.axisLeft(vis.yScale)
        .tickSizeOuter(0)
        .tickSizeInner(0)
        .tickPadding(6)
    );
  }

  update(newData) {
    this.data = newData;
    this.updateVis();
  }
}
