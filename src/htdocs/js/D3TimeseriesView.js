'use strict';


var d3 = require('d3'),
    D3GraphView = require('D3GraphView'),
    Util = require('util/Util');


var __dateFormat = d3.time.format.utc.multi([
  [':%S', function(d) { return d.getUTCSeconds(); }],
  ['%H:%M', function(d) { return d.getUTCMinutes(); }],
  ['%H:00', function(d) { return d.getUTCHours(); }],
  ['%a %e', function(d) { return d.getUTCDay() && d.getUTCDate() !== 1; }],
  ['%b %e', function(d) { return d.getUTCDate() !== 1; }],
  ['%b', function(d) { return d.getUTCMonth(); }],
  ['%Y', function() { return true; }]
]);

/**
 * Format a date for display in tooltip.
 *
 * @param d {Date}
 *        date to format.
 * @return {String}
 *         formatted date.
 */
var __formatTooltipDate = function (d) {
  d = d.toISOString();
  d = d.replace(/^.*T/, '');
  d = d.replace('.000Z' ,'');
  return d;
};

/**
 * Display a Timeseries model.
 *
 * @param options {Object}
 *        all options are passed to D3GraphView.
 * @param options.data {Timeseries}
 *        data to plot.
 */
var D3TimeseriesView = function (options) {
  var _this,
      _initialize,
      // variables
      _data,
      _el,
      _gaps,
      _line,
      _point,
      _timeseries,
      _x,
      _y,
      // methods
      _bisectDate,
      _defined,
      _getX,
      _getY,
      _onGapOver,
      _onGapOut,
      _onMouseMove,
      _onMouseOut;

  _this = D3GraphView(Util.extend({
    height: 300,
    width: 960,
    xAxisFormat: __dateFormat,
    xAxisScale: d3.time.scale.utc()
  }, options));

  _initialize = function () {
    var el = d3.select(_this.dataEl);
    // data gaps
    _gaps = el.append('g')
        .attr('class', 'gaps')
        .attr('clip-path', 'url(#plotAreaClip)');
    // data line
    _timeseries = el.append('path')
        .attr('class', 'timeseries')
        .attr('clip-path', 'url(#plotAreaClip)');
    // hovered data point
    _point = el.append('circle')
        .attr('class', 'point');
    // used to plot _timeseries
    _line = d3.svg.line()
        .x(_getX)
        .y(_getY)
        .defined(_defined);
    // mouse tracking event handlers
    _el = d3.select(_this.el.querySelector('.inner-frame'));
    _el.on('mousemove', _onMouseMove);
    _el.on('mouseout', _onMouseOut);
  };

  _this.destroy = Util.compose(function () {
    // unbind listeners
    _el.on('mousemove', null);
    _el.on('mouseout', null);
    // free references
    _el = null;
    _timeseries = null;
    _point = null;
    _line = null;
    _bisectDate = null;
    _data = null;
    _x = null;
    _y = null;
    _defined = null;
    _getX = null;
    _getY = null;
    _onMouseMove = null;
    _onMouseOut = null;
    _this = null;
  }, _this.destroy);

  /**
   * Check whether value is defined at the given point.
   *
   * @param d {Number}
   *        index of point.
   * @return {Boolean}
   *         true if value is not null, false otherwise.
   */
  _defined = function (d) {
    return _data.values[d] !== null;
  };

  /**
   * Get the x coordinate of a data point.
   *
   * @param d {Number}
   *        index of point.
   * @return {Number}
   *         pixel x value.
   */
  _getX = function (d) {
    return _x(_data.times[d]);
  };

  /**
   * Get the y coordinate of a data point.
   *
   * @param d {Number}
   *        index of point.
   * @return {Number}
   *         pixel y value.
   */
  _getY = function (d) {
    return _y(_data.values[d]);
  };

  /**
   * Gap mouse over event handler.
   *
   * @param gap {Object}
   *        gap.start {Date} start of gap
   *        gap.end {Date} end of gap.
   */
  _onGapOver = function (gap) {
    var centerX,
        centerY,
        yExtent;
    yExtent = _y.domain();
    centerX = new Date((gap.end.getTime() + gap.start.getTime()) / 2);
    centerY = (yExtent[0] + yExtent[1]) / 2;

    // show data point on line
    _point.classed({'visible': true})
        .attr('transform',
            'translate(' + _x(centerX) + ',' + _y(centerY) + ')');
    _this.showTooltip([centerX, centerY],
      [
        {
          class: 'value',
          text: 'NO DATA'
        },
        {
          class: 'time',
          text: __formatTooltipDate(gap.start) +
              ' - ' + __formatTooltipDate(gap.end)
        }
      ]
    );
  };

  /**
   * Gap mouse out event handler.
   */
  _onGapOut = function () {
    // hide point
    _point.classed({'visible': false});
    // hide tooltip
    _this.showTooltip(null);
  };

  /**
   * Mouse move event handler.
   */
  _onMouseMove = function () {
    var coords,
        i,
        i0,
        t,
        t0,
        x,
        y;

    // determine mouse coordinates in svg coordinates.
    coords = d3.mouse(this);
    x = _x.invert(coords[0]);
    if (!x) {
      _onMouseOut();
      return;
    }

    // find date closest to mouse position
    i = d3.bisectLeft(_data.times, x, 1);
    // data point closest to x mouse position
    i0 = Math.max(0, i - 1);
    t = _data.times[i].getTime();
    t0 = _data.times[i0].getTime();
    x = x.getTime();

    if (x - t0 < t - x) {
      i = i0;
    }

    x = _data.times[i];
    y = _data.values[i];

    if (!y) {
      // gap or out of plot, hide tooltip
      _onMouseOut();
      return;
    }

    // show data point on line
    _point.attr('transform', 'translate(' + _x(x) + ',' + _y(y) + ')')
        .classed({'visible': true});
    // show tooltip of current point
    _this.showTooltip([x, y],
      [
        {
          class: 'value',
          text: y
        },
        {
          class: 'time',
          text: __formatTooltipDate(x)
        }
      ]
    );
  };

  /**
   * Mouse out event handler.
   */
  _onMouseOut = function () {
    // hide point
    _point.classed({'visible': false});
    // hide tooltip
    _this.showTooltip(null);
  };

  /**
   * Get x axis extent.
   */
  _this.getXExtent = function () {
    var xExtent = _this.model.get('xExtent');
    if (xExtent === null) {
      _data = _this.model.get('data').get();
      xExtent = d3.extent(_data.times);
    }
    return xExtent;
  };

  /**
   * Get y axis extent.
   *
   * @param xExtent {Array<Number>}
   *        current x extent.
   * @return {Array<Number>}
   *         y extent.
   */
  _this.getYExtent = function (xExtent) {
    var yExtent = _this.model.get('yExtent'),
        minXIndex,
        maxXIndex;
    if (yExtent === null) {
      _data = _this.model.get('data').get();
      if (xExtent) {
        minXIndex = d3.bisectLeft(_data.times, xExtent[0]);
        maxXIndex = d3.bisectLeft(_data.times, xExtent[1]);
        yExtent = d3.extent(_data.values.slice(minXIndex, maxXIndex + 1));
      } else {
        yExtent = d3.extent(_data.values);
      }
    }
    return yExtent;
  };

  /**
   * Update the timeseries that is displayed.
   *
   * @param changed {Object}
   *        options that changed.
   *        when undefined, render everything.
   */
  _this.plot = function (changed) {
    var gaps,
        options,
        yExtent;

    changed = changed || _this.model.get();
    options = _this.model.get();

    if (changed.hasOwnProperty('pointRadius')) {
      // update point radius
      _point.attr('r', options.pointRadius);
    }

    // update references used by _line function callbacks
    _data = options.data.get();
    _x = options.xAxisScale;
    _y = options.yAxisScale;

    // plot gaps
    yExtent = _y.domain();
    if (isNaN(yExtent[0]) || isNaN(yExtent[1])) {
      return;
    }

    gaps = _gaps.selectAll('rect').data(options.data.getGaps());
    gaps.enter()
        .append('rect')
        .attr('class', 'gap')
        .on('mouseover', _onGapOver)
        .on('mouseout', _onGapOut);
    gaps.attr('x', function (g) { return _x(g.start); })
        .attr('width', function (g) { return _x(g.end) - _x(g.start); })
        .attr('y', function () { return _y(yExtent[1]); })
        .attr('height', function () {
            return _y(yExtent[0]) - _y(yExtent[1]); });
    gaps.exit()
        .on('mouseover', null)
        .on('mouseout', null)
        .remove();

    // plot timeseries
    _timeseries.attr('d', _line(d3.range(_data.times.length)));
  };


  _initialize(options);
  options = null;
  return _this;
};


module.exports = D3TimeseriesView;