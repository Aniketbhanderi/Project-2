const PRIORITY_COLORS = {
  'STANDARD':  '#4e79a7',
  'HAZARDOUS': '#f28e2b',
  'PRIORITY':  '#e15759',
};
const PRIORITY_COLOR_DEFAULT = '#9aa5b1';

class PriorityPieChart {
  constructor(_config) {
    this.config = {
      parentElement: _config.parentElement,
      legendElement: _config.legendElement || null,
      onSliceSelect: _config.onSliceSelect || null
    };

    this.selectedPriorities = [];
    this.data = [];
    this.tooltipOffset = 12;
    this.tooltip = d3.select('#tooltip');

    this.initVis();
  }

  getColor(priority) {
    return PRIORITY_COLORS[priority] || PRIORITY_COLOR_DEFAULT;
  }

  initVis() {
    const vis = this;

    vis.container = d3.select(vis.config.parentElement);
    vis.container.html('');
    vis.container.classed('priority-pie-body', true);

    vis.svg = vis.container
      .append('svg')
      .attr('class', 'priority-pie-svg');

    vis.chartGroup = vis.svg.append('g').attr('class', 'priority-pie-group');

    vis.emptyState = vis.container
      .append('div')
      .attr('class', 'priority-pie-empty')
      .style('display', 'none')
      .text('No priority data for current filters.');

    window.addEventListener('resize', () => {
      vis.renderVis();
    });

    vis.renderLegend();
  }

  renderLegend() {
    const vis = this;
    if (!vis.config.legendElement) return;
    const container = document.querySelector(vis.config.legendElement);
    if (!container) return;
    const labelMap = { 'STANDARD': 'Standard', 'HAZARDOUS': 'Hazardous', 'PRIORITY': 'Priority' };
    const items = Object.entries(PRIORITY_COLORS).map(([key, color]) => `
      <div class="legend-swatch-item">
        <span class="legend-swatch" style="background:${color}"></span>
        <span class="legend-swatch-label">${labelMap[key] || key}</span>
      </div>`).join('');
    container.innerHTML = `<div class="legend-swatch-list" style="display:flex;gap:8px;flex-wrap:wrap;">${items}</div>`;
  }

  updateData(data, selectedPriorities, colorBaseData) {
    const vis = this;

    vis.selectedPriorities = selectedPriorities || [];

    vis.data = d3.rollups(
      data,
      values => values.length,
      d => {
        const raw = (d.PRIORITY || '').trim();
        return raw === '' ? 'Unknown' : raw;
      }
    )
      .map(([priority, count]) => ({ priority, count }))
      .sort((a, b) => d3.descending(a.count, b.count) || d3.ascending(a.priority));

    vis.totalCount = d3.sum(vis.data, d => d.count);
    vis.renderVis();
  }

  renderVis() {
    const vis = this;
    if (!vis.container.node()) return;

    if (vis.data.length === 0) {
      vis.svg.attr('width', 0).attr('height', 0);
      vis.chartGroup.selectAll('.priority-arc').remove();
      vis.emptyState.style('display', 'flex');
      return;
    }

    vis.emptyState.style('display', 'none');

    const width = Math.max(140, vis.container.node().clientWidth || 140);
    const height = Math.max(90, vis.container.node().clientHeight || 90);
    const size = Math.min(width, height);
    const radius = Math.max(28, (size / 2) - 8);
    const innerRadius = Math.max(14, radius * 0.56);

    vis.svg.attr('width', width).attr('height', height);
    vis.chartGroup.attr('transform', `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie()
      .sort(null)
      .value(d => d.count);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const arcs = vis.chartGroup
      .selectAll('.priority-arc')
      .data(pie(vis.data), d => d.data.priority)
      .join(
        enter => {
          const g = enter.append('g').attr('class', 'priority-arc');
          g.append('path').attr('class', 'priority-slice');
          return g;
        },
        update => update,
        exit => exit.remove()
      );

    arcs
      .select('.priority-slice')
      .attr('d', arc)
      .attr('fill', d => vis.getColor(d.data.priority))
      .attr('opacity', d => vis.selectedPriorities.length === 0 || vis.selectedPriorities.includes(d.data.priority) ? 1 : 0.2)
      .classed('active', d => vis.selectedPriorities.includes(d.data.priority))
      .on('mouseover', function(event, d) {
        const pct = vis.totalCount > 0 ? ((d.data.count / vis.totalCount) * 100).toFixed(1) : '0.0';
        d3.select(this).classed('hovered', true);

        vis.tooltip
          .style('opacity', 1)
          .style('z-index', 1000000)
          .html(`<div class="tooltip-label priority-tooltip"><strong>Priority:</strong> ${d.data.priority}<br><strong>Calls:</strong> ${d.data.count}<br><strong>Share:</strong> ${pct}%</div>`);

        vis.positionTooltip(event);
      })
      .on('mousemove', event => {
        vis.positionTooltip(event);
      })
      .on('mouseleave', function() {
        d3.select(this).classed('hovered', false);
        vis.tooltip.style('opacity', 0);
      })
      .on('click', (_, d) => {
        const p = d.data.priority;
        const next = vis.selectedPriorities.includes(p)
          ? vis.selectedPriorities.filter(x => x !== p)
          : [...vis.selectedPriorities, p];
        if (vis.config.onSliceSelect) {
          vis.config.onSliceSelect(next);
        }
      });
  }

  positionTooltip(event) {
    const vis = this;
    const tooltipNode = vis.tooltip.node();
    if (!tooltipNode) return;

    const tipWidth = tooltipNode.offsetWidth || 0;
    const tipHeight = tooltipNode.offsetHeight || 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = event.pageX + vis.tooltipOffset;
    let top = event.pageY + vis.tooltipOffset;

    if (left + tipWidth > viewportWidth - 4) {
      left = event.pageX - tipWidth - vis.tooltipOffset;
    }

    if (top + tipHeight > viewportHeight - 4) {
      top = event.pageY - tipHeight - vis.tooltipOffset;
    }

    left = Math.max(4, Math.min(left, viewportWidth - tipWidth - 4));
    top = Math.max(4, Math.min(top, viewportHeight - tipHeight - 4));

    vis.tooltip
      .style('left', `${left}px`)
      .style('top', `${top}px`);
  }
}
