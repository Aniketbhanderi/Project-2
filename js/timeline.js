class Timeline {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      width: 600,
      height: 300,
      margin: { top: 20, right: 20, bottom: 40, left: 50 }
    };
    this.data = _data;
    this.initVis();
  }

  initVis() {
    let vis = this;

    vis.width = vis.config.width - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.height - vis.config.margin.top - vis.config.margin.bottom;

    vis.svg = d3.select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.width)
      .attr("height", vis.config.height)
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    vis.xScale = d3.scaleTime().range([0, vis.width]);
    vis.yScale = d3.scaleLinear().range([vis.height, 0]);

    vis.xAxis = d3.axisBottom(vis.xScale);
    vis.yAxis = d3.axisLeft(vis.yScale);

    vis.xAxisGroup = vis.svg.append("g")
      .attr("transform", `translate(0, ${vis.height})`);

    vis.yAxisGroup = vis.svg.append("g");

    vis.updateVis();
  }

  updateData(newData) {
    this.data = newData;
    this.updateVis();
  }

  updateVis() {
    let vis = this;

    let dateKey = "DATE_CREATED";

    // assign date
    vis.data.forEach(d => {
      d.date = new Date(d[dateKey] + "T00:00:00");
    });

    // filter valid dates
    let filteredData = vis.data.filter(d => d.date instanceof Date && !isNaN(d.date));

    // group by month
    let counts = d3.rollups(
      filteredData,
      v => v.length,
      d => {
        let year = d.date.getFullYear();
        let month = d.date.getMonth();
        return year + "-" + month;
      }
    );

    // convert key back to a Date
    counts = counts.map(d => {
      let parts = d[0].split("-");
      return [new Date(parts[0], parts[1], 1), d[1]];
    });

    vis.displayData = counts.map(d => ({
      date: d[0],
      count: d[1]
    }));

    // stop if no data
    if (vis.displayData.length === 0) {
      console.log("No valid timeline data");
      return;
    }

    vis.xScale.domain(d3.extent(vis.displayData, d => d.date));
    vis.yScale.domain([0, d3.max(vis.displayData, d => d.count)]);

    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    vis.bars = vis.svg.selectAll(".bar")
      .data(vis.displayData);

    vis.bars.enter()
      .append("rect")
      .attr("class", "bar")
      .merge(vis.bars)
      .attr("x", d => vis.xScale(d.date))
      .attr("y", d => vis.yScale(d.count))
      .attr("width", 20)
      .attr("height", d => vis.height - vis.yScale(d.count))
      .attr("fill", "steelblue");

    vis.bars.exit().remove();

    vis.xAxisGroup.call(vis.xAxis);
    vis.yAxisGroup.call(vis.yAxis);
  }
}