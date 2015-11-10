define(function (require) {
  return function FillMapVisType(Private, getAppState, courier, config) {
    var VislibVisType = Private(require('ui/vislib_vis_type/VislibVisType'));
    var geoJsonConverter = Private(require('ui/agg_response/geo_json/geo_json'));
    var Schemas = Private(require('ui/Vis/Schemas'));
    var _ = require('lodash');
    var supports = require('ui/utils/supports');

    return new VislibVisType({
      name: 'fill_map',
      title: 'Fill map',
      icon: 'fa-map-marker',
      description: 'Your source for chloropleth maps.',
      params: {
        defaults: {
          isDesaturated: true,
          addTooltip: true,
          minColor: 'green',
          maxColor: 'yellow',
          addTitle: true,
          stepNumber: 4,
          setZoom: 5,
          wms: config.get('visualization:tileMap:WMSdefaults')
        },
        canDesaturate: !!supports.cssFilters,
        editor: require('plugins/kbn_vislib_vis_types/editors/fill_map.html')
      },
      //responseConverter: geoJsonConverter,
      schemas: new Schemas([
        {
          group: 'metrics',
          name: 'metric',
          title: 'Value',
          min: 1,
          max: 1,
          aggFilter: ['count', 'avg', 'sum', 'min', 'max', 'cardinality'],
          defaults: [
            { schema: 'metric', type: 'count' }
          ]
        },
        {
          group: 'buckets',
          name: 'segment',
          title: 'Chloropleth',
          min: 0,
          max: 1,
          aggFilter: '!geohash_grid'
        },
        {
          group: 'buckets',
          name: 'split',
          title: 'Split Chart',
          min: 0,
          max: 1
        }
      ])
    });
  };
});
