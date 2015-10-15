define(function (require) {
  return function FillMapFactory(Private) {
    var d3 = require('d3');
    var _ = require('lodash');
    var $ = require('jquery');

    var Chart = Private(require('ui/vislib/visualizations/_chart'));
    var FillMapMap = Private(require('ui/vislib/visualizations/_fill_map'));

    /**
     * Tile Map Visualization: renders maps
     *
     * @class FillMap
     * @constructor
     * @extends Chart
     * @param handler {Object} Reference to the Handler Class Constructor
     * @param chartEl {HTMLElement} HTML element to which the map will be appended
     * @param chartData {Object} Elasticsearch query results for this map
     */
    _.class(FillMap).inherits(Chart);
    function FillMap(handler, chartEl, chartData) {
      if (!(this instanceof FillMap)) {
        return new FillMap(handler, chartEl, chartData);
      }

      FillMap.Super.apply(this, arguments);

      // track the map objects
      this.maps = [];
      this._chartData = chartData || {};
      _.assign(this, this._chartData);
    }

    /**
     * Draws tile map, called on chart render
     *
     * @method draw
     * @return {Function} - function to add a map to a selection
     */
    FillMap.prototype.draw = function () {
      var self = this;

      // clean up old maps
      self.destroy();

      return function (selection) {
        selection.each(function () {
          self._appendMap(this);
        });
      };
    };

    /**
     * Invalidate the size of the map, so that leaflet will resize to fit.
     * then moves to center
     *
     * @method resizeArea
     * @return {undefined}
     */
    FillMap.prototype.resizeArea = function () {
      this.maps.forEach(function (map) {
        map.updateSize();
      });
    };

    /**
     * clean up the maps
     *
     * @method destroy
     * @return {undefined}
     */
    FillMap.prototype.destroy = function () {
        //console.log("maps destroy");
      this.maps = this.maps.filter(function (map) {
        map.destroy();
      });
    };

    /**
     * Renders map
     *
     * @method _appendMap
     * @param selection {Object} d3 selection
     */
    FillMap.prototype._appendMap = function (selection) {
      var container = $(selection).addClass('fillmap');

      var map = new FillMapMap(container, this._chartData, {
        // center: this._attr.mapCenter,
        // zoom: this._attr.mapZoom,
        events: this.events,
        tooltipFormatter: this.tooltipFormatter,
        valueFormatter: this.valueFormatter,
        attr: this._attr
      });

      // add title for splits
      if (this.title) {
        map.addTitle(this.title);

      }
      // add fit to bounds control
      map.addFitControl();
      map.addBoundingControl();

      this.maps.push(map);
    };

    return FillMap;
  };
});
