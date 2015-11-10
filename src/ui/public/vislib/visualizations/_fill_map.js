define(function (require) {
  return function FillMapMapFactory(Private) {
    var _ = require('lodash');
    var $ = require('jquery');
    var L = require('leaflet');
    var Rainbow = require('rainbowvis.js');
    var sprintf = require("sprintf-js").sprintf;



    var defaultMapZoom = 2;
    var defaultMapCenter = [15, 5];

    var mapTiles = {
      url: 'https://otile{s}-s.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg',
      options: {
        attribution: 'Tiles by <a href="http://www.mapquest.com/">MapQuest</a> &mdash; ' +
          'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
          '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        subdomains: '1234'
      }
    };

    /**
     * Tile Map Maps
     *
     * @class Map
     * @constructor
     * @param container {HTML Element} Element to render map into
     * @param chartData {Object} Elasticsearch query results for this map
     * @param params {Object} Parameters used to build a map
     */
    function FillMapMap(container, chartData, params) {
      this._container = $(container).get(0);
      this._chartData = chartData;

      // keep a reference to all of the optional params
      this._events = _.get(params, 'events');
      this._valueFormatter = params.valueFormatter || _.identity;
      this._tooltipFormatter = params.tooltipFormatter || _.identity;
      this._attr = params.attr || {};

      var mapOptions = {
        minZoom: 1,
        maxZoom: 18,
        noWrap: true,
        maxBounds: L.latLngBounds([-90, -220], [90, 220]),
        scrollWheelZoom: false,
        fadeAnimation: false,
      };

      this._createMap(mapOptions, chartData);
    }

    FillMapMap.prototype.addBoundingControl = function () {
      if (this._boundingControl) return;

      var self = this;
      var drawOptions = { draw: {} };

      _.each(['polyline', 'polygon', 'circle', 'marker', 'rectangle', 'geometry'], function (drawShape) {
        if (self._events && !self._events.listenerCount(drawShape)) {
          drawOptions.draw[drawShape] = false;
        } else {
          drawOptions.draw[drawShape] = {
            shapeOptions: {
              stroke: false,
              color: '#000'
            }
          };
        }
      });

      this._boundingControl = new L.Control.Draw(drawOptions);
      this.map.addControl(this._boundingControl);
    };

    FillMapMap.prototype.addFitControl = function () {
      if (this._fitControl) return;

      var self = this;
      var fitContainer = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-fit');

      // Add button to fit container to points
      var FitControl = L.Control.extend({
        options: {
          position: 'topleft'
        },
        onAdd: function (map) {
          $(fitContainer).html('<a class="fa fa-crop" href="#" title="Fit Data Bounds"></a>')
          .on('click', function (e) {
            e.preventDefault();
            self._fitBounds();
          });

          return fitContainer;
        },
        onRemove: function (map) {
          $(fitContainer).off('click');
        }
      });

      this._fitControl = new FitControl();
      this.map.addControl(this._fitControl);
    };

    /**
     * Adds label div to each map when data is split
     *
     * @method addTitle
     * @param mapLabel {String}
     * @return {undefined}
     */
    FillMapMap.prototype.addTitle = function (mapLabel) {
      if (this._label) return;
      if (!this._attr.isShowLable) {
        $('tilemap-info tilemap-label').addClass('filters-off');
      }

      var label = this._label = L.control();

      label.onAdd = function () {
        this._div = L.DomUtil.create('div', 'tilemap-info tilemap-label');
        this.update();
        return this._div;
      };
      label.update = function () {
        this._div.innerHTML = '<h2>' + _.escape(mapLabel) + '</h2>';
      };

      this.map.addControl(label);
    };

    /**
     * remove css class for desat filters on map tiles
     *
     * @method saturateTiles
     * @return undefined
     */
    FillMapMap.prototype.addTitle = function () {
      if (!this._attr.isShowLable) {
        $('tilemap-info tilemap-label').addClass('filters-off');
      }
    };

    FillMapMap.prototype.saturateTiles = function () {
      if (!this._attr.isDesaturated) {
        $('img.leaflet-tile-loaded').addClass('filters-off');
      }
    };

    FillMapMap.prototype.updateSize = function () {
      this.map.invalidateSize({
        debounceMoveend: true
      });
    };

    FillMapMap.prototype.destroy = function () {
      console.log("destroy");
      if (this._label) this._label.removeFrom(this.map);
      if (this._fitControl) this._fitControl.removeFrom(this.map);
      if (this._boundingControl) this._boundingControl.removeFrom(this.map);
      if (this._legend) this._legend.removeFrom(this.map);
      if (this._info) this._info.removeFrom(this.map);

      this.map.remove();
      this.map = undefined;
    };


    FillMapMap.prototype._attachEvents = function () {
      var self = this;
      var saturateTiles = self.saturateTiles.bind(self);

      this._tileLayer.on('tileload', saturateTiles);

      this.map.on('unload', function () {
        self._tileLayer.off('tileload', saturateTiles);
      });

      this.map.on('moveend', function setZoomCenter(ev) {
        // update internal center and zoom references
        self._mapCenter = self.map.getCenter();
        self._mapZoom = self.map.getZoom();

        if (!self._events) return;

        self._events.emit('mapMoveEnd', {
          chart: self._chartData,
          map: self.map,
          center: self._mapCenter,
          zoom: self._mapZoom,
        });
      });

      this.map.on('draw:created', function (e) {
        var drawType = e.layerType;
        if (!self._events || !self._events.listenerCount(drawType)) return;

        // TODO: Different drawTypes need differ info. Need a switch on the object creation
        var bounds = e.layer.getBounds();

        self._events.emit(drawType, {
          e: e,
          chart: self._chartData,
          bounds: {
            top_left: {
              lat: bounds.getNorthWest().lat,
              lon: bounds.getNorthWest().lng
            },
            bottom_right: {
              lat: bounds.getSouthEast().lat,
              lon: bounds.getSouthEast().lng
            }
          }
        });
      });

      this.map.on('zoomend', function () {
        self._mapZoom = self.map.getZoom();
        if (!self._events) return;

        self._events.emit('mapZoomEnd', {
          chart: self._chartData,
          map: self.map,
          zoom: self._mapZoom,
        });
      });
    };

    FillMapMap.prototype.addLegend = function() {
      this._legend = L.control({
        position: 'bottomright'
      });
      var self = this;
      this._legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend'),
            labels = [];
        // loop through our density intervals and generate a label with a colored square for each interval

        var stepNumber = self._attr.stepNumber;
        var steps = stepNumber;
        var round = self._attr.roundNumber;
        var stepSize = (self._max - self._min) / (steps-1);
        //console.log(this);
        for (var i = 0; i < steps; i++) {
          from = Math.round((self._min + stepSize * i) / round) * round;
          to = i < steps-1 ? Math.round((self._min + stepSize * (i+1)) / round) * round : 0;
          labels.push(
            '<div><i style="background: ' + self._getColor(from + 1) + '"></i> ' +
            from + (to ? '&ndash;' + to : '+') + '</div>');
        }
        div.innerHTML = labels.join('');
        return div;
      };
      this._legend.addTo(self.map);

    };


    FillMapMap.prototype._getColor = function(value) {
      if (!value)
        return;
      var color = '#' + this._rainbow.colourAt(value);
      return color;
    };

    FillMapMap.prototype._format = function(format, object) {
      try {
        return sprintf( format , object)
      }
      catch(err) {
        return "Format Error";
      }
    };

    FillMapMap.prototype._addHighlights = function() {
      var self = this;

      // control that shows state info on hover
      this._info = L.control();

      this._info.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'info');
        this.update();
        return this._div;
      };

      this._info.update = function (props) {
        this._div.innerHTML =  (props ?
          self._format( self._attr.highlightsFormat , props)
          : 'Hover over a shape to show details');
      };

      this._info.addTo(this.map);
    }

    FillMapMap.prototype._addGeoJson = function (features) {
      var self = this;

      function style(feature) {
        return {
          fillColor: self._getColor(feature.properties.count),
          weight: 2,
          opacity: 1,
          color: '#5e7a3d',
          dashArray: '3',
          fillOpacity: 0.7
        };
      };
      //mouse handlers
      function highlightFeature(layer) {
        layer.setStyle({
          weight: 8,
          color: '#c7d2bc',
          dashArray: '*',
          fillOpacity: 0.7
        });
        self._info.update(layer.feature.properties)
      };

      function resetHighlight(layer) {
        self._geoJson.resetStyle(layer);
        self._info.update();
      };

      var zoomToFeature = function zoomTofeature(e) {
        self.map.fitBounds(e.target.getBounds());
      };

      function onEachFeature(feature, layer) {
        layer.on({
          mouseover: function(e) {
            highlightFeature(e.target);
          },
          mouseout: function(e){
            resetHighlight(e.target);
          },
          click: zoomToFeature,

        });
        var popup = L.popup();

        var label = L.marker(layer.getBounds().getCenter(), {
          icon: L.divIcon({
            className: 'label',
            html: self._format( self._attr.labelFormat , feature.properties),
            iconSize: [100, 0],
            iconColor: '#2a1eb5'
          })
        });
        label.layer = layer;
        label.on({
          mouseover: function(e) {
            highlightFeature(e.target.layer);
          },
          mouseout: function(e){
            resetHighlight(e.target.layer);
          },
          //click: zoomToFeature,
        });
        label.addTo(self.map);
      };

      this._geoJson = L.geoJson(features, {
        style: style,
        onEachFeature: onEachFeature
      });

      this._geoJson.addTo(this.map);
    }

    FillMapMap.prototype._addShapes = function (chartData) {
      var self = this;
      var url = self._attr.geoJsonUrl;
      $.ajax({
        type: 'GET',
        url: url,
        async: false,
        jsonpCallback: 'geoJsonCallback',
        contentType: "application/json",
        cache: true,
        dataType: 'jsonp',
        success: function(json) {
          var features = json.features;
          if (chartData) {
            chartValues = chartData.series[0].values
            features = _.map(features, function (feature) {
              var matchingColumn = _.get(feature.properties, self._attr.idmatch);
              chartItem = _.find(chartValues, {
                x: matchingColumn
              });
              feature.properties.count = _.has(chartItem, 'y') ? chartItem.y : 0;
              return feature;
            });
          }
          self._addGeoJson(features);
        },
        error: function(e) {
         console.log(e);
        }
      });
    };

    FillMapMap.prototype._createMap = function (mapOptions, chartData) {
      if (this.map) this.destroy();
      var self = this;

      this._addShapes(chartData);

      // get center and zoom from mapdata, or use defaults
      this._mapCenter = _.get(this._geoJson, 'properties.center') || defaultMapCenter;
      this._mapZoom = _.get(this._geoJson, 'properties.zoom') || defaultMapZoom;

      // add map tiles layer, using the mapTiles object settings
      if (this._attr.wms && this._attr.wms.enabled) {
        this._tileLayer = L.tileLayer.wms(this._attr.wms.url, this._attr.wms.options);
      } else {
        this._tileLayer = L.tileLayer(mapTiles.url, mapTiles.options);
      }

      // append tile layers, center and zoom to the map options
      mapOptions.layers = this._tileLayer;
      mapOptions.center = this._mapCenter;
      mapOptions.zoom = this._mapZoom;

      this.map = L.map(this._container, mapOptions).setView([8.7703686,-11.8564844], this._attr.setZoom);
      this._attachEvents();

      if (chartData) {
        this._rainbow = new Rainbow;

        this._min = _.min(chartData.series[0].values, function(value){
          return value.y;
        }).y;
        this._max = _.max(chartData.series[0].values, function(value){
          return value.y;
        }).y;

        this._rainbow.setNumberRange(this._min, this._max);
        this._rainbow.setSpectrum(this._attr.minColor, this._attr.maxColor);

        this.addLegend();
        this._addHighlights();
      }
      this.map.attributionControl.addAttribution(
        'Total Calls &copy; <a herf="http://census.gov/>117 call Center</a>"'
      );

    };

    /**
     * zoom map to fit all features in featureLayer
     *
     * @method _fitBounds
     * @param map {Leaflet Object}
     * @return {boolean}
     */
    FillMapMap.prototype._fitBounds = function () {
      this.map.fitBounds(this._geoJson.getBounds());
    };

    return FillMapMap;
  };
});
