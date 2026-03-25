class NeighborhoodHeatmap {
  constructor(_config) {
    this.config = {
      parentElement: _config.parentElement,
      onTileSelect: _config.onTileSelect || null
    };

    this.selectedNeighborhood = 'ALL';
    this.tilesData = [];
    this.totalCount = 0;
    this.tooltipOffset = 12;
    this.tooltip = d3.select('#tooltip');

    this.initVis();
  }

  initVis() {
    const vis = this;

    vis.container = d3.select(vis.config.parentElement);
    vis.container.html('');
    vis.container.classed('neighborhood-heatmap-body', true);

    vis.scrollHost = vis.container
      .append('div')
      .attr('class', 'neighborhood-heatmap-scroll');

    vis.svg = vis.scrollHost
      .append('svg')
      .attr('class', 'neighborhood-heatmap-svg');

    vis.g = vis.svg.append('g').attr('class', 'neighborhood-heatmap-tiles');

    vis.emptyState = vis.container
      .append('div')
      .attr('class', 'neighborhood-heatmap-empty')
      .style('display', 'none')
      .text('No neighborhood data for current filters.');

    window.addEventListener('resize', () => {
      vis.renderVis();
    });
  }

  updateData(data, selectedNeighborhood) {
    const vis = this;

    vis.selectedNeighborhood = selectedNeighborhood || 'ALL';

    vis.tilesData = d3.rollups(
      data,
      values => values.length,
      d => {
        const raw = (d.NEIGHBORHOOD || '').trim();
        return raw === '' ? 'Unknown' : raw;
      }
    )
      .map(([neighborhood, count]) => ({ neighborhood, count }))
      .sort((a, b) => d3.descending(a.count, b.count) || d3.ascending(a.neighborhood, b.neighborhood));

    vis.totalCount = d3.sum(vis.tilesData, d => d.count);
    vis.renderVis();
  }

  renderVis() {
    const vis = this;

    if (!vis.container.node()) return;

    if (vis.tilesData.length === 0) {
      vis.svg.attr('width', 0).attr('height', 0);
      vis.g.selectAll('.heatmap-tile').remove();
      vis.emptyState.style('display', 'flex');
      return;
    }

    vis.emptyState.style('display', 'none');

    const bodyWidth = Math.max(160, vis.container.node().clientWidth || 160);
    const gap = 4;
    const tileSize = 30;
    const columns = Math.max(2, Math.floor((bodyWidth + gap) / (tileSize + gap)));
    const rows = Math.ceil(vis.tilesData.length / columns);

    const width = columns * (tileSize + gap) - gap;
    const height = rows * (tileSize + gap) - gap;

    vis.svg.attr('width', width).attr('height', height);

    const counts = vis.tilesData.map(d => d.count);
    const extent = d3.extent(counts);
    const colorScale = d3.scaleSequential(d3.interpolateYlGnBu)
      .domain(extent[0] === extent[1] ? [extent[0], extent[0] + 1] : extent);

    const tiles = vis.g
      .selectAll('.heatmap-tile')
      .data(vis.tilesData, d => d.neighborhood)
      .join(
        enter => {
          const tile = enter.append('g').attr('class', 'heatmap-tile');
          tile.append('rect').attr('rx', 4).attr('ry', 4);
          tile.append('text').attr('class', 'heatmap-tile-label');
          return tile;
        },
        update => update,
        exit => exit.remove()
      );

    tiles
      .attr('transform', (_, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        return `translate(${col * (tileSize + gap)}, ${row * (tileSize + gap)})`;
      })
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).classed('hovered', true);

        const pct = vis.totalCount > 0 ? ((d.count / vis.totalCount) * 100).toFixed(1) : '0.0';
        vis.tooltip
          .style('opacity', 1)
          .style('z-index', 1000000)
          .html(`<div class="tooltip-label neighborhood-tooltip"><strong>Neighborhood:</strong> ${d.neighborhood}<br><strong>Calls:</strong> ${d.count}<br><strong>Share:</strong> ${pct}%</div>`);

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
        const nextNeighborhood = vis.selectedNeighborhood === d.neighborhood ? 'ALL' : d.neighborhood;
        if (vis.config.onTileSelect) {
          vis.config.onTileSelect(nextNeighborhood);
        }
      });

    tiles
      .select('rect')
      .attr('width', tileSize)
      .attr('height', tileSize)
      .attr('fill', d => colorScale(d.count))
      .attr('class', d => {
        const active = vis.selectedNeighborhood === d.neighborhood;
        return active ? 'heatmap-rect active' : 'heatmap-rect';
      });

    tiles
      .select('text')
      .attr('x', tileSize / 2)
      .attr('y', tileSize / 2 + 1)
      .text(d => vis.getCompactLabel(d.neighborhood))
      .attr('title', d => d.neighborhood);
  }

  getCompactLabel(name) {
    const cleaned = String(name || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');

    if (cleaned.length <= 5) return cleaned;

    const consonants = cleaned
      .replace(/[AEIOU]/g, '')
      .replace(/(.)\1+/g, '$1');

    if (consonants.length <= 5) return consonants;

    if (cleaned.length >= 8 && consonants.length >= 6) {
      return `${consonants[0]}${consonants[1]}${consonants[consonants.length - 3]}${consonants[consonants.length - 1]}`;
    }

    return consonants.slice(0, 5);
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
