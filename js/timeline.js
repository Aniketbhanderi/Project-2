class Timeline {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      width: _config.width || 600,
      height: _config.height || 160,
      margin: { top: 20, right: 20, bottom: 40, left: 50 }
    };
    this.data = _data;
    this.initVis();
  }

  initVis() {
    let vis = this;

    vis.container = d3.select(vis.config.parentElement);

    vis.svg = vis.container
      .append("svg")
      .attr("class", "timeline-svg");

    vis.chart = vis.svg
      .append("g")
      .attr("class", "timeline-chart");

    vis.xAxisGroup = vis.chart.append("g").attr("class", "x-axis");
    vis.yAxisGroup = vis.chart.append("g").attr("class", "y-axis");

    vis.barsGroup = vis.chart.append("g").attr("class", "bars-group");

    vis.yAxisLabel = vis.chart
      .append("text")
      .attr("class", "y-axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .text("No. of Calls");

    vis.xAxisLabel = vis.chart
      .append("text")
      .attr("class", "x-axis-label")
      .attr("text-anchor", "middle")
      .text("Days of Jan 2025");

    vis.xScale = d3.scaleTime();
    vis.yScale = d3.scaleLinear();

    vis.xAxis = d3.axisBottom(vis.xScale);
    vis.yAxis = d3.axisLeft(vis.yScale).ticks(4).tickSizeOuter(0);

    vis.updateDimensions();
    vis.bindResize();
    vis.updateVis();
  }

  bindResize() {
    let vis = this;

    if (vis.resizeHandler) return;

    vis.resizeHandler = () => {
      vis.updateDimensions();
      vis.renderVis();
    };

    window.addEventListener("resize", vis.resizeHandler);
  }

  updateDimensions() {
    let vis = this;

    const node = vis.container.node();
    if (!node) return;

    const bounds = node.getBoundingClientRect();
    const containerWidth = Math.max(320, Math.floor(bounds.width || vis.config.width));
    const containerHeight = Math.max(120, Math.floor(bounds.height || vis.config.height));

    vis.config.width = containerWidth;
    vis.config.height = containerHeight;

    vis.width = vis.config.width - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.height - vis.config.margin.top - vis.config.margin.bottom;

    vis.minPlotWidth = vis.width;
    vis.plotWidth = vis.width;

    vis.svg
      .attr("width", vis.config.width)
      .attr("height", vis.config.height);

    vis.chart.attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    vis.xScale.range([0, vis.plotWidth]);
    vis.yScale.range([vis.height, 0]);

    vis.xAxisGroup.attr("transform", `translate(0, ${vis.height})`);

    vis.yAxisLabel
      .attr("x", -vis.height / 2)
      .attr("y", -38);

    vis.xAxisLabel
      .attr("x", vis.plotWidth / 2)
      .attr("y", vis.height + 38);
  }

  clearVis() {
    let vis = this;

    vis.displayData = [];
    vis.barsGroup.selectAll(".bar").remove();

    vis.xScale.domain([new Date(), d3.timeDay.offset(new Date(), 1)]).range([0, vis.plotWidth]);
    vis.yScale.domain([0, 1]);

    vis.xAxisGroup.call(vis.xAxis.scale(vis.xScale));
    vis.yAxisGroup.call(vis.yAxis.scale(vis.yScale));
  }

  getTimeBuckets() {
    let vis = this;

    const parseDate = d3.timeParse("%Y-%m-%d");

    vis.data.forEach(d => {
      const rawDate = (d.DATE_CREATED || "").trim();
      d.date = rawDate ? parseDate(rawDate) : null;
    });

    const januaryStart = new Date(2025, 0, 1);
    const februaryStart = new Date(2025, 1, 1);

    const janRows = vis.data.filter(d => (
      d.date instanceof Date
      && !Number.isNaN(d.date.getTime())
      && d.date >= januaryStart
      && d.date < februaryStart
    ));

    const grouped = d3.rollups(
      janRows,
      v => v.length,
      d => d3.timeDay.floor(d.date)
    ).sort((a, b) => a[0] - b[0]);

    const dayCountMap = new Map(grouped.map(d => [d[0].getTime(), d[1]]));

    return d3.timeDays(januaryStart, februaryStart).map(day => ({
      date: day,
      count: dayCountMap.get(day.getTime()) || 0
    }));
  }

  computePlotWidth() {
    let vis = this;

    const minBarSlot = 22;
    const neededWidth = vis.displayData.length * minBarSlot;
    vis.plotWidth = Math.max(vis.minPlotWidth, neededWidth);

    vis.svg
      .attr("width", vis.plotWidth + vis.config.margin.left + vis.config.margin.right)
      .attr("height", vis.config.height);

    vis.xScale.range([0, vis.plotWidth]);
  }

  updateScales() {
    let vis = this;

    const januaryStart = new Date(2025, 0, 1);
    const februaryStart = new Date(2025, 1, 1);

    vis.xScale.domain([januaryStart, februaryStart]);
    vis.yScale.domain([0, d3.max(vis.displayData, d => d.count) || 1]).nice();

    vis.barWidth = Math.max(
      4,
      Math.min(
        28,
        vis.displayData.length > 1
          ? d3.min(d3.pairs(vis.displayData, (a, b) => vis.xScale(b.date) - vis.xScale(a.date))) * 0.86
          : vis.plotWidth * 0.8
      )
    );

    vis.xAxis
      .ticks(d3.timeDay.every(1))
      .tickFormat(d3.timeFormat("%d"));

    vis.xAxisLabel.attr("x", vis.plotWidth / 2);
  }

  updateData(newData) {
    this.data = newData;
    this.updateVis();
  }

  updateVis() {
    let vis = this;

    vis.updateDimensions();
    vis.displayData = vis.getTimeBuckets();

    if (vis.displayData.length === 0) {
      vis.clearVis();
      return;
    }

    vis.computePlotWidth();
    vis.updateScales();
    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    vis.bars = vis.barsGroup
      .selectAll(".bar")
      .data(vis.displayData, d => d.date.getTime());

    vis.bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .merge(vis.bars)
      .attr("x", d => vis.xScale(d.date) + 1)
      .attr("y", d => vis.yScale(d.count))
      .attr("width", Math.max(1, vis.barWidth - 2))
      .attr("height", d => vis.height - vis.yScale(d.count))
      .attr("fill", "steelblue");

    vis.bars.exit().remove();

    vis.xAxisGroup
      .call(vis.xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-0.6em")
      .attr("dy", "0.15em")
      .attr("transform", "rotate(-35)");

    vis.yAxisGroup.call(vis.yAxis);
  }
}