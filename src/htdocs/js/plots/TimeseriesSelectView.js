'use strict';

var Collection = require('mvc/Collection'),
    CompactSelectView = require('plots/CompactSelectView'),
    ScaleView = require('plots/ScaleView'),
    Util = require('util/Util'),
    View = require('mvc/View');


var DEFAULTS = {
  channels: [
    'H',
    'E',
    'Z',
    'F'
  ],
  observatories: null
};


/**
 * Choose timeseries to be displayed.
 *
 * @param options {Object}
 *        all options are passed to View.
 * @param options.channels {Array<String>}
 *        default ['H', 'E', 'Z', 'F'].
 *        channel names.
 * @param options.config {Model}.
 *        configuration model to update.
 * @param options.observatories {Array<String>}
 *        default array of 14 observatories.
 *        observatory codes.
 */
var TimeseriesSelectView = function (options) {
  var _this,
      _initialize,
      // variables
      _config,
      _elements,
      _elementsEl,
      _elementsView,
      _endTime,
      _endTimeError,
      _endTimeErrorLabel,
      _observatories,
      _observatoriesEl,
      _observatoriesView,
      _scaleView,
      _startTime,
      _startTimeError,
      _startTimeErrorLabel,
      _timeCustom,
      _timeEl,
      _timeError,
      _timeNext,
      _timePrevious,
      _timePastday,
      _timeRealtime,
      _timeUpdate,
      // methods
      _formatDate,
      _onTimeChange,
      _onTimeIncrement,
      _parseDate,
      _roundUpToNearestNMinutes,
      _setTimeError,
      _timeOrder,
      _validateRange,
      _validateEndTime,
      _validateStartTime;


  _this = View(options);

  _initialize = function (options) {
    var el;

    options = Util.extend({}, DEFAULTS, options);
    _config = options.config;
    _elements = options.elements || Collection();
    _observatories = options.observatories || Collection();
    _this.plotModel = options.plotModel;

    el = _this.el;
    el.classList.add('timeseries-selectview');
    el.innerHTML =
        '<div class="timeseries-elements"></div>' +
        '<div class="timeseries-observatories"></div>' +
        '<h2>Time</h2>' +
        '<div class="timeseries-time">' +
          '<input type="radio" name="timemode" id="time-realtime" ' +
            'value="realtime" />' +
          '<label for="time-realtime">Realtime</label>' +
          '<input type="radio" name="timemode" id="time-pastday" ' +
            'value="pastday" />' +
          '<label for="time-pastday">Past 24 Hours</label>' +
          '<input type="radio" name="timemode" id="time-custom" ' +
            'value="custom" />' +
          '<label for="time-custom">Custom</label>' +
          '<div class="timeseries-increment">' +
            '<button class="previous-button">' +
              '&#xe020' +
            '</button>' +
            '<button class="next-button">' +
              '&#xe01F' +
            '</button>' +
          '</div>' +
          '<div class="time-input">' +
            '<div class="time-error">' +
            '</div>' +
            '<label class="starttime-error-label" for="time-starttime">' +
              'Start Time (UTC)' +
              '<input type="text" id="time-starttime" name="time-starttime" ' +
                'aria-describedby="starttime-error-message" />' +
            '</label>' +
            '<label class="endtime-error-label" for="time-endtime">' +
              'End Time (UTC)' +
              '<input type="text" id="time-endtime" name="time-endtime"/>' +
            '</label>' +
            '<button>Update</button>' +
          '</div>' +
          '<div class="scale-view"></div>' +
        '</div>';

    _elementsEl = el.querySelector('.timeseries-elements');

    _endTime = el.querySelector('#time-endtime');
    _endTimeError = document.createElement('span');
    _endTimeError.classList.add('usa-input-error-message');
    _endTimeErrorLabel = el.querySelector('.endtime-error-label');

    _observatoriesEl = el.querySelector('.timeseries-observatories');

    _timeEl = el.querySelector('.timeseries-time');
    _timeRealtime = el.querySelector('#time-realtime');
    _timePastday = el.querySelector('#time-pastday');
    _timeCustom = el.querySelector('#time-custom');

    _timeNext = el.querySelector('.next-button');
    _timePrevious = el.querySelector('.previous-button');

    _startTime = el.querySelector('#time-starttime');
    _startTimeError = document.createElement('span');
    _startTimeError.classList.add('usa-input-error-message');
    _startTimeErrorLabel = el.querySelector('.starttime-error-label');

    _timeUpdate = el.querySelector('.time-input > button');
    _timeError = el.querySelector('.time-input > .time-error');

    _config.on('change', _this.render);

    _timeRealtime.addEventListener('change', _onTimeChange);
    _timePrevious.addEventListener('click', _onTimeIncrement);
    _timeNext.addEventListener('click', _onTimeIncrement);
    _timePastday.addEventListener('change', _onTimeChange);
    _timeCustom.addEventListener('change', _onTimeChange);
    _startTime.addEventListener('change', _onTimeChange);
    _endTime.addEventListener('change', _onTimeChange);
    _timeUpdate.addEventListener('click', _onTimeChange);

    _elementsView = CompactSelectView({
      collection: _elements,
      el: _elementsEl,
      title: 'Channel'
    });

    _observatoriesView = CompactSelectView({
      collection: _observatories,
      el: _observatoriesEl,
      title: 'Observatory'
    });

    _scaleView = ScaleView({
      el: _this.el.querySelector('.scale-view'),
      model: _this.plotModel
    });

    // initial render
    _this.render();
  };


  /**
   * Format a date object.
   *
   * @param d {Date}
   *        date to format.
   */
  _formatDate = function (d) {
    if (!d || typeof d.toISOString !== 'function') {
      return '';
    }
    return d.toISOString().replace('T', ' ').replace(/\.[\d]{3}Z/, '');
  };

  /**
   * Time radio and text input change handler.
   */
  _onTimeChange = function (e) {
    var endTime,
        startTime;

    if (_timeCustom.checked) {
      _timeEl.classList.add('custom');
      if (e.target === _timeCustom) {
        // user selected custom, allow to edit times
        return;
      }

      endTime = _parseDate(_endTime.value);
      startTime = _parseDate(_startTime.value);

      if (_validateStartTime(startTime) &&
          _validateEndTime(endTime) &&
          _timeOrder(startTime, endTime, e) &&
          _validateRange(startTime, endTime)){
        _config.set({
          endtime: endTime,
          starttime: startTime,
          timemode: 'custom'
        });
      }
    } else {
      _timeEl.classList.remove('custom');
      if (_timeRealtime.checked) {
        _config.set({
          timemode: 'realtime'
        });
      } else if (_timePastday.checked) {
        _config.set({
          timemode: 'pastday'
        });
      }
    }

  };

  _onTimeIncrement = function (e) {
    var direction,
        endtime,
        increment,
        roundValue,
        starttime,
        timemode;

    endtime = _config.get('endtime');
    starttime = _config.get('starttime');
    timemode = _config.get('timemode');

    if (!_timeCustom.checked) {
      _timeCustom.checked = true;
      _timeEl.classList.add('custom');
    }

    if (e.target === _timeNext) {
      direction = 1;
    } else {
      direction = -1;
    }

    if (timemode === 'pastday') {
      roundValue = 5;
    } else {
      roundValue = 1;
    }

    increment = direction * ((endtime.getTime() - starttime.getTime()) / 2);
    starttime = _roundUpToNearestNMinutes(
      new Date(starttime.getTime() + increment),
      roundValue
    );
    endtime = _roundUpToNearestNMinutes(
      new Date(endtime.getTime() + increment),
      roundValue
    );

    _config.set({
      timemode: 'custom',
      starttime: starttime,
      endtime: endtime
    });

    _startTime.value = _formatDate(starttime);
    _endTime.value = _formatDate(endtime);

  };


  /**
   * Parse a date string.
   *
   * @param s {String}
   *        ISO8601ish string to parse as UTC.
   * @return {Date}
   *         parsed date, or null if unable to parse.
   */
  _parseDate = function (s) {
    var dt;
    if (!s) {
      return null;
    }
    dt = new Date(s.replace(' ', 'T').replace('Z', '') + 'Z');
    return dt;
  };

  /**
   * Round a date up to the next N minute interval.
   *
   * @param dt {Date}
   *        date to round.
   * @param n {Integer}
   *        default 5.
   *        number of minutes to round to.
   *        e.g. 1: round up to nearest minute.
   *             5: round up to nearest 5 minutes.
   * @return {Date} rounded date.
   *         If dt is on a 5 minute interval, the return value is 5 minutes later.
   */
  _roundUpToNearestNMinutes = function (dt, n) {
    var y = dt.getUTCFullYear(),
        m = dt.getUTCMonth(),
        d = dt.getUTCDate(),
        h = dt.getUTCHours(),
        i = dt.getUTCMinutes();

    n = n || 5;
    // round i
    i = n * Math.floor((i + n) / n);
    return new Date(Date.UTC(y, m, d, h, i));
  };

  /**
   * Show/clear error message for time inputs.
   *
   * @param message {String}
   *        error message, or null if no errors.
   */
  _setTimeError = function (message) {
    if (message === null) {
      _timeError.innerHTML = '';
      _timeError.classList.remove('error');
      _timeError.classList.remove('alert');
    } else {
      _timeError.innerHTML = message;
      _timeError.classList.add('alert');
      _timeError.classList.add('error');
    }
  };


  /**
   * Ensure that start time comes before end time. Swap them if needed.
   * If start and end are identical (within 10 seconds), make the range
   * between them 3 days.
   *
   * @param start {Date}
   *        time entered in start field.
   * @param end {Date}
   *        time entered in end field.
   * @return [{Date}, {Date}]
   *         start time and end time in proper order.
   */
  _timeOrder = function(start, end, e) {
    if (start > end) {
      if (e.target !== _startTime) {
        _setTimeError('Start Time must come before End Time.');
      }
      return false;
    } else {
      _setTimeError(null);
      return true;
    }

  };

  /**
   * Validate a date-time string, or create a valid date-time.
   *
   * @param time {Date}
   *        string that needs to be a valid date-time.
   * @return {Boolean}
   *         true if time is a valid date time.
   */
  _validateEndTime = function (time) {
    if (time === null || !(time instanceof Date) || isNaN(+time)) {
      _endTimeError.innerHTML = 'Please enter a valid time.';
      _endTimeErrorLabel.classList.add('usa-input-error-label');
      _endTimeErrorLabel.insertBefore(_endTimeError, _endTime);
      return false;
    } else {
      var span;

      _endTimeError.innerHTML = '';
      _endTimeErrorLabel.classList.remove('usa-input-error-label');

      span = _endTimeErrorLabel.querySelector('.usa-input-error-message');
      if (span !== null) {
        _endTimeErrorLabel.removeChild(span);
      }

      return true;
    }
  };

  /**
   * Validate a date-time string, or create a valid date-time.
   *
   * @param time {Date}
   *        string that needs to be a valid date-time.
   * @return {Boolean}
   *         true if time is a valid date time.
   */
  _validateStartTime = function (time) {
    if (time === null || !(time instanceof Date) || isNaN(+time)) {
      _startTimeError.innerHTML = 'Please enter a valid time.';
      _startTimeErrorLabel.classList.add('usa-input-error-label');
      _startTimeErrorLabel.insertBefore(_startTimeError, _startTime);
      return false;
    } else {
      var span;

      _startTimeError.innerHTML = '';
      _startTimeErrorLabel.classList.remove('usa-input-error-label');

      span = _startTimeErrorLabel.querySelector('.usa-input-error-message');
      if (span !== null) {
        _startTimeErrorLabel.removeChild(span);
      }

      return true;
    }
  };

  /**
   * Ensure that the time range isn't greater than 1 month.
   *
   * @param start {Date}
   *        time entered in start field.
   * @param end {Date}
   *        time entered in end field.
   * @return {Boolean}
   *         true if the range is less than 31 days.
   */
  _validateRange = function (start, end) {
    if ((end-start) > 2678400000) {
      _setTimeError('Please select less than 1 month of data.');
      return false;
    } else {
      _setTimeError(null);
      return true;
    }
  };


  /**
   * Destroy this view.
   */
  _this.destroy = Util.compose(function () {
    _elementsView.destroy();
    _scaleView.destroy();
    _observatoriesView.destroy();

    _config.off('change', _this.render);

    _timeRealtime.removeEventListener('change', _onTimeChange);
    _timePastday.removeEventListener('change', _onTimeChange);
    _timeCustom.removeEventListener('change', _onTimeChange);
    _startTime.removeEventListener('change', _onTimeChange);
    _endTime.removeEventListener('change', _onTimeChange);
    _timeUpdate.removeEventListener('click', _onTimeChange);


    // variables
    _config = null;
    _elements = null;
    _elementsEl = null;
    _elementsView = null;
    _endTime = null;
    _endTimeError = null;
    _endTimeErrorLabel = null;
    _observatories = null;
    _observatoriesEl = null;
    _observatoriesView = null;
    _scaleView = null;
    _startTime = null;
    _startTimeError = null;
    _startTimeErrorLabel = null;
    _timeCustom = null;
    _timeEl = null;
    _timeError = null;
    _timeNext = null;
    _timePrevious = null;
    _timePastday = null;
    _timeRealtime = null;
    _timeUpdate = null;
    _validateEndTime = null;
    _validateStartTime = null;

    // methods
    _formatDate = null;
    _onTimeChange = null;
    _onTimeIncrement = null;
    _parseDate = null;
    _setTimeError = null;
    _timeOrder = null;
    _validateRange = null;
    _validateEndTime = null;
    _validateStartTime = null;

    _this = null;
  }, _this.destroy);

  /**
   * Update controls based on current model.
   */
  _this.render = function () {
    var now,
        endTime = _config.get('endtime'),
        selectedChannel = _config.get('channel'),
        selectedObservatory = _config.get('observatory'),
        startTime = _config.get('starttime'),
        timeMode = _config.get('timemode');

    _endTime.value = _formatDate(endTime);
    _startTime.value = _formatDate(startTime);
    if (timeMode === 'realtime') {
      _timeRealtime.checked = true;
      _timeNext.disabled = true;
    } else if (timeMode === 'pastday') {
      _timePastday.checked = true;
      _timeNext.disabled = true;
    } else {
      _timeCustom.checked = true;
      now = new Date();
      if (endTime > now) {
        _timeNext.disabled = true;
      } else {
        _timeNext.disabled = false;
      }
    }
  };


  _initialize(options);
  options = null;
  return _this;
};


module.exports = TimeseriesSelectView;
