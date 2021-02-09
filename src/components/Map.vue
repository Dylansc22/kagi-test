<template>
  <div>
    <div id="myMap"></div>
    <button id="calcRouteButton" @click="calcGHRoute">
      <h4>Calc Route</h4>
    </button>
    <button id="testButton" @click="tester">
      <h4>Run Test</h4>
    </button>
    <div id="controller" :class="{ active: markerList.length >= 2 }">
      <div id="controls">
        <button
          @click="changeTransporation('driving')"
          :class="{ activeButton: transporation == 'driving' }"
        >
          Driving
        </button>
        <button
          @click="changeTransporation('cycling')"
          :class="{ activeButton: transporation == 'cycling' }"
        >
          Cycling
        </button>
        <button
          @click="changeTransporation('walking')"
          :class="{ activeButton: transporation == 'walking' }"
        >
          Walking
        </button>
      </div>
    </div>
    <div id="route" :class="{ showColors: markerList.length >= 2 }">
      <span class="mapboxColor">Mapbox</span> |
      <span class="graphhopperColor">Graphhopper</span>
    </div>
    <button id="removeLastMarker" @click="undoLastMarker">
      <i class="fas fa-undo-alt fa-2x"></i>
    </button>
  </div>
</template>

<script>
import "@fortawesome/fontawesome-free/css/all.css";
import "@fortawesome/fontawesome-free/js/all.js";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";

import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

require("graphhopper-js-api-client");
var GraphHopper = require("graphhopper-js-api-client/src/GraphHopperRouting"); // If you only need e.g. Routing, you can only require the needed parts
var GHInput = require("graphhopper-js-api-client/src/GHInput");

import pointToLineDistance from "@turf/point-to-line-distance";

const axios = require("axios");

export default {
  mounted() {
    this.initializeMap();
  },
  data() {
    return {
      //I want to be able to easily reference geojson of the routes that are on screen (both graphhopper and mapbox)
      route: {
        graphhopper: {},
        mapbox: {},
        alternatives: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: []
              }
            }
          ]
        }
      },
      updateRoute: false,
      mapIsStatic: true,
      isActive: true,
      map: null,
      markerList: [],
      counter: 0,
      keys: {
        graphhopper: process.env.VUE_APP_GRAPHOPPER_API,
        mapbox: process.env.VUE_APP_MAPBOX_API
      },
      transporation: "driving",
      routeStart: {
        marker: false,
        mapCenter: true,
        otherMarkers: false
      }
    };
  },
  methods: {
    compareRoutesUsingTurf() {
      //Using the Map Maching Mapbox API -- Only 100 Coordinates Per Request -- https://docs.mapbox.com/api/overview/
      let gh = this.route.graphhopper.paths[0].points.coordinates;
      let mp = this.route.mapbox.routes[0].geometry.coordinates;

      let differenceMiles = [];
      gh.map(coord => {
        differenceMiles.push(
          pointToLineDistance(coord, mp, {
            units: "miles",
            mercator: false
          })
        );
      });
      differenceMiles = differenceMiles.map(e => Math.round(e * 100) / 100); //only 1/10th of a mile precision necessary -- can adjust this as needed later

      let counter = 0;
      let linestring = [];
      let threashold = 0.02;

      differenceMiles.map((element, index) => {
        if (element >= threashold && linestring.length == 0) {
          linestring.push(
            this.route.graphhopper.paths[0].points.coordinates[index - 1]
          );
          linestring.push(
            this.route.graphhopper.paths[0].points.coordinates[index]
          );
        } else if (element >= threashold && linestring.length != 0) {
          linestring.push(
            this.route.graphhopper.paths[0].points.coordinates[index]
          );
        } else if (element < threashold && linestring.length != 0) {
          linestring.push(
            this.route.graphhopper.paths[0].points.coordinates[index]
          );
          this.route.alternatives.features[counter] = {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: linestring
            }
          };
          linestring = [];
          counter++;
        } else if (
          differenceMiles.length - 1 == index &&
          linestring.length != 0
        ) {
          linestring.push(
            this.route.graphhopper.paths[0].points.coordinates[index]
          );
          this.route.alternatives.features[counter] = {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: linestring
            }
          };
        }
      });
      // console.log("detour", differenceMiles);
      // console.log(this.route.alternatives);
    },
    changeTransporation(type) {
      //only trigger behavior if someone is clicking a different transportion type than what is currently selected
      if (this.transporation != type) {
        this.transporation = type;
        if (this.markerList.length >= 2) {
          this.map.removeLayer("graphhopperRouteID");
          this.map.removeLayer("mapboxRouteID");
          this.map.removeSource("graphhopperRouteSource");
          this.map.removeSource("mapboxRouteSource");
          this.triggerNewRoute();
        }
      }
    },
    undoLastMarker() {
      if (this.markerList.length >= 2) {
        this.map.removeLayer("graphhopperRouteID");
        this.map.removeLayer("mapboxRouteID");
        this.map.removeSource("graphhopperRouteSource");
        this.map.removeSource("mapboxRouteSource");
        this.markerList[this.markerList.length - 1].remove();
        this.markerList.pop();
        this.triggerNewRoute();
      } else if (this.markerList.length >= 1) {
        this.markerList[this.markerList.length - 1].remove();
        this.markerList.pop();
      }
    },
    async mapboxRoutePromise() {
      if (this.transporation == "driving") {
        var mode = "driving";
      } else if (this.transporation == "cycling") {
        mode = "cycling";
      } else if (this.transporation == "walking") {
        mode = "walking";
      }

      let url = "https://api.mapbox.com/directions/v5/mapbox/";
      let key = this.keys.mapbox;

      if (this.markerList.length >= 2) {
        let pointString = "";
        this.markerList.map(e => {
          pointString =
            pointString +
            e.getLngLat().lng.toString() +
            `,` +
            e.getLngLat().lat.toString() +
            `;`;
        });
        pointString = "/" + pointString.slice(0, -1);

        return axios.get(
          `${url}${mode}${pointString}?access_token=${key}&geometries=geojson&overview=full`
        );
      }
    },
    flyToFirstMarker(marker) {
      this.map.flyTo({
        center: [
          marker.geometry.coordinates[0],
          marker.geometry.coordinates[1]
        ],
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
      });
    },
    zoomToNewRoute() {
      if (this.markerList.length >= 2) {
        this.map.fitBounds(this.route.graphhopper.paths[0].bbox, {
          padding: 100
        });
      }
    },
    removeCurrentRoute() {
      if (this.map.getSource("graphhopperRouteSource")) {
        this.map.removeLayer("graphhopperRouteID");
        this.map.removeSource("graphhopperRouteSource");
      }
      if (this.map.getSource("mapboxRouteSource")) {
        this.map.removeLayer("mapboxRouteID");
        this.map.removeSource("mapboxRouteSource");
      }
    },
    displayRoute(myData, routingEngine) {
      if (routingEngine == "graphhopper") {
        this.map.addSource(`${routingEngine}RouteSource`, {
          type: "geojson",
          data: myData
        });
      } else {
        this.map.addSource(`${routingEngine}RouteSource`, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: myData
          }
        });
      }

      let color = routingEngine == "graphhopper" ? "#28ac9f" : "#0072b8";

      if (this.transporation == "driving") {
        var shape = "line";
        var style = {
          "line-color": color,
          "line-opacity": 1.0,
          "line-width": {
            type: "exponential",
            base: 1.61,
            stops: [
              [0, 7 * Math.pow(2, 0 - 9)], //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
              [24, 7 * Math.pow(2, 24 - 18)] //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
            ]
          }
        };
        var layout = {}; //default
      } else if (this.transporation == "cycling") {
        shape = "line";
        style = {
          "line-color": color,
          "line-dasharray": [2, 1.25], //[dashes, gaps] measured in units of line-width
          "line-opacity": 1.0,
          "line-width": {
            type: "exponential",
            base: 1.61,
            stops: [
              [0, 7 * Math.pow(2, 0 - 9)], //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
              [24, 7 * Math.pow(2, 24 - 18)] //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
            ]
          }
        };
        layout = {}; //default
      } else if (this.transporation == "walking") {
        shape = "line";
        style = {
          "line-color": color,
          "line-dasharray": [0.1, 2], //[dashes, gaps] measured in units of line-width
          "line-opacity": 0.8,
          "line-width": {
            type: "exponential",
            base: 1.5,
            stops: [
              [0, 7 * Math.pow(2, 0 - 9)], //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
              [24, 7 * Math.pow(2, 24 - 18)] //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
            ]
          }
        };
        layout = {
          "line-cap": "round",
          "line-join": "round"
        };
      }

      // // Find which label's layer has the smallest z-index, and place the geojson route below that layer
      // var layers = this.map.getStyle().layers;
      // // Find the index of the first symbol layer in the map style
      // var firstSymbolId;
      // for (var i = layers.length - 1; i >= 0; i--) {
      //   if (layers[i].type !== "symbol") {
      //     firstSymbolId = layers[i].id;
      //     console.log(i, firstSymbolId);
      //     break;
      //   }
      // }

      this.map.addLayer(
        {
          id: `${routingEngine}RouteID`,
          type: shape,
          source: `${routingEngine}RouteSource`,
          paint: style,
          layout: layout
        },
        "admin-0-boundary-disputed"
      );
    },
    async triggerNewRoute() {
      let ghResponse = this.graphhopperRoutePromise();
      let mpResponse = this.mapboxRoutePromise();
      let allData = await Promise.all([ghResponse, mpResponse]);

      this.route.mapbox = allData[1].data;
      this.displayRoute(this.route.mapbox.routes[0].geometry, "mapbox");

      this.route.graphhopper = allData[0];

      this.compareRoutesUsingTurf();
      this.displayRoute(this.route.alternatives, "graphhopper");

      this.zoomToNewRoute();
    },
    async calcGHRoute() {
      let key = this.keys.graphhopper;
      let parameters = {
        locale: "en",
        vehicle: "car",
        calc_points: false,
        points_encoded: false
      };

      let points = {
        start: { lat: 32.225073, lng: -110.969338 },
        end: { lat: 32.209933, lng: -110.922217 }
      };

      let url = "http://graphhopper.com/api/1/route?";

      this.map.flyTo({
        lng: -122.19011309461766,
        lat: 37.46486343542965
      });

      let x = await axios.get(
        `${url}key=${key}&point=${points.start.lat},${points.start.lng}&point=${points.end.lat},${points.end.lng}&vehicle=${parameters.vehicle}&locale=${parameters.locale}&calc_points=${parameters.calc_points}&points_encoded=${parameters.points_encoded}`
      );
      console.log(x.data);
    },
    async tester() {
      // eslint-disable-next-line prettier/prettier
      this.route = {
        graphhopper: {
          hints: { "visited_nodes.sum": 88, "visited_nodes.average": 88 },
          info: {
            copyrights: ["GraphHopper", "OpenStreetMap contributors"],
            took: 1
          },
          paths: [
            {
              distance: 3343.681,
              weight: 561.564407,
              time: 511369,
              transfers: 0,
              points_encoded: true,
              bbox: [-122.190711, 37.453648, -122.181665, 37.473711],
              points: {
                type: "LineString",
                coordinates: [
                  [-122.1821, 37.453920000000004],
                  [-122.18205, 37.45393],
                  [-122.18174, 37.45378],
                  [-122.18167000000001, 37.45387],
                  [-122.18225000000001, 37.45423],
                  [-122.18236000000002, 37.45432],
                  [-122.18244000000001, 37.45423],
                  [-122.18261000000001, 37.454080000000005],
                  [-122.18279000000001, 37.45389],
                  [-122.18297000000001, 37.45364],
                  [-122.18379000000002, 37.45405],
                  [-122.18412000000001, 37.45423],
                  [-122.19072000000001, 37.45747],
                  [-122.19030000000001, 37.45803],
                  [-122.18990000000001, 37.4585],
                  [-122.18900000000001, 37.459700000000005],
                  [-122.18851000000001, 37.460280000000004],
                  [-122.18757000000001, 37.46155],
                  [-122.18483, 37.46506],
                  [-122.18657, 37.46591],
                  [-122.18798000000001, 37.466660000000005],
                  [-122.18747, 37.467330000000004],
                  [-122.18728000000002, 37.46763],
                  [-122.18335, 37.47256],
                  [-122.18347000000001, 37.47258],
                  [-122.18359000000001, 37.472620000000006],
                  [-122.18411, 37.47288],
                  [-122.18434, 37.473020000000005],
                  [-122.18471000000001, 37.4733],
                  [-122.18519, 37.473600000000005],
                  [-122.18539000000001, 37.473710000000004]
                ]
              },
              instructions: [
                {
                  distance: 37.076,
                  heading: 69.49,
                  sign: 0,
                  interval: [0, 2],
                  text: "Continue",
                  time: 13347,
                  street_name: "",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 11.724,
                  sign: -2,
                  interval: [2, 3],
                  text: "Turn left",
                  time: 4220,
                  street_name: "",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 79.206,
                  sign: -2,
                  interval: [3, 5],
                  text: "Turn left onto Merrill Street",
                  time: 17820,
                  street_name: "Merrill Street",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 93.569,
                  sign: -3,
                  interval: [5, 9],
                  text: "Turn sharp left onto Santa Cruz Avenue",
                  time: 14033,
                  street_name: "Santa Cruz Avenue",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 805.279,
                  sign: 2,
                  interval: [9, 12],
                  text: "Turn right onto El Camino Real, CA 82",
                  time: 73404,
                  street_name: "El Camino Real, CA 82",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 991.439,
                  sign: 2,
                  interval: [12, 18],
                  text: "Turn right onto Encinal Avenue",
                  time: 127453,
                  street_name: "Encinal Avenue",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 329.882,
                  sign: -2,
                  interval: [18, 20],
                  text: "Turn left onto Middlefield Road",
                  time: 37109,
                  street_name: "Middlefield Road",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 773.179,
                  sign: 2,
                  interval: [20, 23],
                  text: "Turn right onto James Avenue",
                  time: 173961,
                  street_name: "James Avenue",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 222.327,
                  sign: -3,
                  interval: [23, 30],
                  text: "Turn sharp left onto Catalpa Drive",
                  time: 50022,
                  street_name: "Catalpa Drive",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                },
                {
                  distance: 0,
                  sign: 4,
                  last_heading: 303.49574408079707,
                  interval: [30, 30],
                  text: "Arrive at destination",
                  time: 0,
                  street_name: "",
                  points: [
                    [-122.1821, 37.453920000000004],
                    [-122.18205, 37.45393],
                    [-122.18174, 37.45378],
                    [-122.18167000000001, 37.45387],
                    [-122.18225000000001, 37.45423],
                    [-122.18236000000002, 37.45432],
                    [-122.18244000000001, 37.45423],
                    [-122.18261000000001, 37.454080000000005],
                    [-122.18279000000001, 37.45389],
                    [-122.18297000000001, 37.45364],
                    [-122.18379000000002, 37.45405],
                    [-122.18412000000001, 37.45423],
                    [-122.19072000000001, 37.45747],
                    [-122.19030000000001, 37.45803],
                    [-122.18990000000001, 37.4585],
                    [-122.18900000000001, 37.459700000000005],
                    [-122.18851000000001, 37.460280000000004],
                    [-122.18757000000001, 37.46155],
                    [-122.18483, 37.46506],
                    [-122.18657, 37.46591],
                    [-122.18798000000001, 37.466660000000005],
                    [-122.18747, 37.467330000000004],
                    [-122.18728000000002, 37.46763],
                    [-122.18335, 37.47256],
                    [-122.18347000000001, 37.47258],
                    [-122.18359000000001, 37.472620000000006],
                    [-122.18411, 37.47288],
                    [-122.18434, 37.473020000000005],
                    [-122.18471000000001, 37.4733],
                    [-122.18519, 37.473600000000005],
                    [-122.18539000000001, 37.473710000000004]
                  ]
                }
              ],
              legs: [],
              details: {},
              ascend: 9.280001640319824,
              descend: 17.695502281188965,
              snapped_waypoints: {
                type: "LineString",
                coordinates: [
                  [-122.1821, 37.453920000000004],
                  [-122.18539000000001, 37.473710000000004]
                ]
              }
            }
          ]
        },
        mapbox: {
          routes: [
            {
              weight_name: "auto",
              weight: 517.239,
              duration: 378.949,
              distance: 3142.397,
              legs: [
                {
                  admins: [{ iso_3166_1_alpha3: "USA", iso_3166_1: "US" }],
                  weight: 517.239,
                  duration: 378.949,
                  steps: [],
                  distance: 3142.397,
                  summary: "Oak Grove Avenue, Middlefield Road"
                }
              ],
              geometry: {
                coordinates: [
                  [-122.182094, 37.453922],
                  [-122.182072, 37.453933],
                  [-122.182046, 37.453936],
                  [-122.182018, 37.453924],
                  [-122.181908, 37.453868],
                  [-122.181782, 37.453802],
                  [-122.181732, 37.453783],
                  [-122.181716, 37.453806],
                  [-122.181665, 37.453874],
                  [-122.182245, 37.454238],
                  [-122.182274, 37.454262],
                  [-122.182354, 37.454329],
                  [-122.182333, 37.454375],
                  [-122.182335, 37.454413],
                  [-122.182346, 37.454439],
                  [-122.182365, 37.454476],
                  [-122.182388, 37.454506],
                  [-122.182419, 37.454527],
                  [-122.182486, 37.454574],
                  [-122.182757, 37.454752],
                  [-122.182842, 37.454808],
                  [-122.182998, 37.454906],
                  [-122.183428, 37.455177],
                  [-122.183526, 37.455238],
                  [-122.183542, 37.455248],
                  [-122.183606, 37.455289],
                  [-122.183481, 37.45544],
                  [-122.183445, 37.455483],
                  [-122.183411, 37.455526],
                  [-122.183373, 37.455574],
                  [-122.183295, 37.455674],
                  [-122.182963, 37.456112],
                  [-122.182885, 37.456218],
                  [-122.182265, 37.457051],
                  [-122.182222, 37.457108],
                  [-122.18217, 37.457179],
                  [-122.182125, 37.457236],
                  [-122.182054, 37.457329],
                  [-122.18177, 37.457696],
                  [-122.181703, 37.457782],
                  [-122.181546, 37.457986],
                  [-122.181373, 37.458201],
                  [-122.181254, 37.45835],
                  [-122.180922, 37.458762],
                  [-122.180769, 37.458953],
                  [-122.180466, 37.459328],
                  [-122.180011, 37.459893],
                  [-122.179968, 37.459947],
                  [-122.179703, 37.460279],
                  [-122.179406, 37.460653],
                  [-122.179371, 37.460696],
                  [-122.179359, 37.460713],
                  [-122.178996, 37.461213],
                  [-122.178961, 37.461257],
                  [-122.178785, 37.461477],
                  [-122.178531, 37.461794],
                  [-122.178473, 37.461867],
                  [-122.178569, 37.461916],
                  [-122.178808, 37.462038],
                  [-122.17905, 37.46216],
                  [-122.179617, 37.462445],
                  [-122.181379, 37.463331],
                  [-122.181597, 37.463441],
                  [-122.18194, 37.463614],
                  [-122.183627, 37.464464],
                  [-122.183759, 37.464531],
                  [-122.184824, 37.465069],
                  [-122.184943, 37.465127],
                  [-122.186011, 37.465649],
                  [-122.186391, 37.465834],
                  [-122.186561, 37.465918],
                  [-122.187629, 37.466484],
                  [-122.187706, 37.466525],
                  [-122.187973, 37.466665],
                  [-122.187468, 37.46734],
                  [-122.187271, 37.467633],
                  [-122.186601, 37.46846],
                  [-122.186512, 37.468572],
                  [-122.186288, 37.46886],
                  [-122.185685, 37.469633],
                  [-122.184831, 37.470696],
                  [-122.184799, 37.470743],
                  [-122.183862, 37.471919],
                  [-122.18341, 37.472485],
                  [-122.183344, 37.472567],
                  [-122.183462, 37.472582],
                  [-122.183584, 37.472627],
                  [-122.183663, 37.472666],
                  [-122.184106, 37.472889],
                  [-122.18434, 37.473025],
                  [-122.184564, 37.473195],
                  [-122.184703, 37.473307],
                  [-122.184923, 37.473453],
                  [-122.185183, 37.473606],
                  [-122.185385, 37.473713]
                ],
                type: "LineString"
              }
            }
          ],
          waypoints: [
            { distance: 16.498, name: "", location: [-122.182094, 37.453922] },
            {
              distance: 47.396,
              name: "Catalpa Drive",
              location: [-122.185385, 37.473713]
            }
          ],
          code: "Ok",
          uuid: "3zQZ710H4dx10DVpglqZ_u3u5gf_j7pWF8vq06qPJLUTMN9_JgdQNQ=="
        },
        alternatives: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-122.18244000000001, 37.45423],
                  [-122.18261000000001, 37.454080000000005],
                  [-122.18279000000001, 37.45389],
                  [-122.18297000000001, 37.45364],
                  [-122.18379000000002, 37.45405],
                  [-122.18412000000001, 37.45423],
                  [-122.19072000000001, 37.45747],
                  [-122.19030000000001, 37.45803],
                  [-122.18990000000001, 37.4585],
                  [-122.18900000000001, 37.459700000000005],
                  [-122.18851000000001, 37.460280000000004],
                  [-122.18757000000001, 37.46155],
                  [-122.18483, 37.46506]
                ]
              }
            },
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-122.18652000000002, 37.46857],
                  [-122.18719000000002, 37.46905],
                  [-122.18788, 37.469500000000004],
                  [-122.18876000000002, 37.46997],
                  [-122.18946000000001, 37.470290000000006],
                  [-122.18920000000001, 37.4709],
                  [-122.18907000000002, 37.47111],
                  [-122.1889, 37.47131],
                  [-122.18870000000001, 37.4716],
                  [-122.18839000000001, 37.47233000000001],
                  [-122.18813000000002, 37.47283],
                  [-122.18762000000001, 37.473470000000006],
                  [-122.18755000000002, 37.47364],
                  [-122.18750000000001, 37.4739],
                  [-122.18732000000001, 37.474360000000004],
                  [-122.1872, 37.47458],
                  [-122.18679000000002, 37.474410000000006]
                ]
              }
            }
          ]
        }
      };

      // this.compareRoutesUsingTurf();
      this.displayRoute(this.route.alternatives, "graphhopper");
      this.displayRoute(this.route.mapbox.routes[0].geometry, "mapbox");

      this.map.flyTo({
        center: [-122.18703586689887, 37.46396992041629],
        zoom: 14
      });

      // await delay();
      // console.log("this this will wait");
      // function delay() {
      //   new Promise((res, rej) => {
      //     setTimeout(() => {
      //       console.log("trying to get this first")
      //       res();
      //     }, 1000);
      //   });
      // }
      // ---------------- test fetching mapbox directions ----------
      // let url = "https://api.mapbox.com/directions/v5";
      // let modeOfTransporation = "/mapbox/cycling";
      // let start = "/-122.42,37.78";
      // let end = "-77.03,38.91";
      // let key = this.keys.mapbox;
      // let x = await axios.get(
      //   `${url}${modeOfTransporation}${start};${end}?access_token=${key}&geometries=geojson`
      // );
      // console.log(x.data);
      // ------------- update route trigger --------------------
      // this.updateRoute = !this.updateRoute;
      // --------------- Test 'capturing' the current location of the yellow marker
      // try {
      //   console.log(
      //     `lat:  ${this.locationMarker.getLngLat().lat}`,
      //     `long: ${this.locationMarker.getLngLat().lng}`
      //   );
      // } catch (error) {
      //   console.log("no marker on screen");
      // }
      // ---------- test calling wikipedia data via axios ------------
      // let url = "https://www.wikidata.org/wiki/Special:EntityData/";
      // let x = await axios.get(url + "Q74195" + ".json");
      // console.log("the promise:");
      // console.log(x.data);
    },
    async fetchWikidata(QID) {
      if (QID) {
        let url = "https://www.wikidata.org/wiki/Special:EntityData/";
        try {
          const response = await axios.get(url + QID + ".json");
          let wikipediaDescription =
            response.data.entities[QID].descriptions.en.value;
          return wikipediaDescription;
        } catch (error) {
          console.log(
            "request failed during axios request of data in addAllWikiInfo... Likely due to a timeout or something up with the Q ID not existing at the wikidata endpoint"
          );
          console.log(error);
        }
      }
    },
    pushMarkerToList(marker) {
      marker.id = "marker" + this.counter;
      this.counter = +1;
      this.markerList.push(marker);
    },
    async addAllWikiInfo(marker) {
      let url = "https://www.wikidata.org/wiki/Special:EntityData/";
      let term = marker.properties.wikidata;
      //some geocoder searches will not have a wikidata page
      if (term) {
        try {
          const response = await axios.get(url + term + ".json");
          marker.properties.wikidata = null;
          marker.properties.wikidata =
            response.data.entities[term].descriptions.en.value;
          return marker.properties.wikidata;
        } catch (error) {
          console.log(
            "request failed during axios request of data in addAllWikiInfo... Likely due to a timeout or something up with the Q ID not existing at the wikidata endpoint"
          );
          console.log(error);
        }
      }
    },
    addAppleMarker(pin) {
      var el = document.createElement("div");
      el.className = "marker";

      let marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
        draggable: true
      })
        .setLngLat({
          lng: pin.geometry.coordinates[0],
          lat: pin.geometry.coordinates[1]
        })
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            "<h3>" +
              pin.text +
              "</h3><p>" +
              pin.place_name +
              "</p>" +
              // "<h5>" +
              // pin.properties.wikidata +
              // "</h5>" +
              "<h6>" +
              pin.properties.wikiinfo +
              "</h6>"
          )
        )
        .on("dragstart", () => {
          this.mapIsStatic = false;
        })
        .on("dragend", async () => {
          this.mapIsStatic = true;

          if (this.markerList.length >= 2) {
            this.map.removeLayer("graphhopperRouteID");
            this.map.removeLayer("mapboxRouteID");
            this.map.removeSource("graphhopperRouteSource");
            this.map.removeSource("mapboxRouteSource");
            this.triggerNewRoute();
          }
        })
        .addTo(this.map);

      if (pin.properties.wikiinfo) {
        marker.setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            "<h3>" +
              pin.text +
              "</h3><p>" +
              pin.place_name +
              "</p>" +
              "<h5>" +
              pin.properties.wikidata +
              "</h5>" +
              "<h6>" +
              pin.properties.wikiinfo +
              "</h6>"
          )
        );
      } else {
        marker.setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            "<h3>" + pin.text + "</h3><p>" + pin.place_name + "</p>"
          )
        );
      }

      this.pushMarkerToList(marker);
    },
    initializeMap() {
      mapboxgl.accessToken = process.env.VUE_APP_MAPBOX_API;
      this.map = new mapboxgl.Map({
        container: "myMap", // container id
        style: "mapbox://styles/dylanc/ckknn6k240hmz17pccv0pun4w", // style URL
        center: [-122.2646, 37.4956], // starting position [lng, lat]
        zoom: 11, // starting zoom
        minZoom: 3,
        maxPitch: 60
      });

      //Add geocoder
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        marker: false, //I am using a custom Apple-like Marker. No need for default
        flyTo: false //I only need the map to zoom to the first marker the first time (ie if markerList.length is == 1). if there is more than 1 marker, than it will zoom to the generated route via zoomToNewRoute()
      });
      this.map.addControl(geocoder, "top-left");

      this.map.on("move", () => {
        this.mapIsStatic = false;
      });

      this.map.on("moveend", () => {
        this.mapIsStatic = true;
      });

      //*** */
      //The above geocoder.on("result",...) is written with async/await but it was being called twice. I don't understand why because I have it operating behind an "await" -- Had to add an if statement to check if the description was already returned to force it to only be called once?
      //This still has a bug that needs addressing -- the first map drag after a marker is returned does not engadge.
      geocoder.on("result", async e => {
        geocoder.clear(); //this clears the searchbox after every search. Without it, the search term would stay in the box, until you hit 'X' to close/clear the searchbox. Bad UX.
        let marker = e.result;
        if (!marker.properties.wikiinfo) {
          marker.properties.wikiinfo = await this.fetchWikidata(
            marker.properties.wikidata
          );
        }
        this.addAppleMarker(marker);
        if (this.markerList.length == 1) {
          this.flyToFirstMarker(marker);
        }
        if (this.markerList.length >= 2) {
          this.removeCurrentRoute();
          this.triggerNewRoute();
        }
      });
    },
    graphhopperRoutePromise() {
      if (this.transporation == "driving") {
        var mode = "car";
      } else if (this.transporation == "cycling") {
        mode = "bike";
      } else if (this.transporation == "walking") {
        mode = "foot";
      }

      let defaults = {
        key: this.keys.graphhopper,
        vehicle: mode,
        elevation: false,
        host: "https://graphhopper.com/api/1/"
      };

      let ghRouting = new GraphHopper(defaults);

      if (this.markerList.length >= 2) {
        this.markerList.map(e => {
          ghRouting.addPoint(new GHInput(e.getLngLat().lat, e.getLngLat().lng));
        });

        return ghRouting.doRequest();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
#route {
  display: none;

  &.showColors {
    display: inline;
    font-size: 22px;
    font-weight: 700;
    position: absolute;
    bottom: 120px;
    right: 70px;

    .mapboxColor {
      color: #328cc3;
    }

    .graphhopperColor {
      color: #52bcb1;
    }
  }
}

#controller {
  font-size: 18px;
  font-weight: 700;
  position: absolute;
  bottom: 30px;
  right: 70px;
  border: solid 1px black;
  background-color: rgba(253, 253, 253, 0.5);
  width: 0px;
  height: 78px;
  border-top-left-radius: 15px;
  border-bottom-left-radius: 15px;
  overflow: hidden;

  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  align-items: center;
  text-align: center;

  &.active {
    width: 300px;
    padding-right: 40px;
    padding-left: 10px;
  }

  /*animations & transitions*/
  -webkit-transition: all 0.3s;
  -moz-transition: all 0.3s;
  -o-transition: all 0.3s;
  transition: all 0.3s;

  #controls {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr;
    align-items: center;
    text-align: center;

    button {
      margin-left: 10px;
      margin-right: 10px;
      font-size: 14px;
      height: 50px;
      border-radius: 5px;
      border: solid 1px black;
      outline: none;

      &:active {
        transform: scale(0.98);
      }
      /*animations & transitions*/
      -webkit-transition: all 0.05s;
      -moz-transition: all 0.05s;
      -o-transition: all 0.05s;
      transition: all 0.05s;

      &.activeButton {
        font-weight: 600;
      }
    }
  }

  /*animations & transitions*/
  -webkit-transition: all 0.3;
  -moz-transition: all 0.3;
  -o-transition: all 0.3;
  transition: all 0.3;
}

#mapInfo {
  &.big {
    height: auto;
    width: auto;
  }
  height: 40px;
  width: 40px;
  overflow: hidden;
  font-size: 12px;
  line-height: 15px;
  font-weight: bold;
  position: absolute;
  left: 20px;
  bottom: 20px;
  background-color: rgba(253, 253, 253, 0.5);
  border: solid 1px grey;
  border-radius: 4px;
  padding: 5px;
}

#locationButton {
  position: absolute;
  bottom: 70px;
  right: 30px;
}

#removeLastMarker {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: solid 1px black;
  position: absolute;
  bottom: 30px;
  right: 30px;

  &:focus {
    outline: none;
  }
  &:hover {
    cursor: pointer;
  }
  &:active {
    transform: scale(0.9);
  }
  /*animations & transitions*/
  -webkit-transition: all 0.1s;
  -moz-transition: all 0.1s;
  -o-transition: all 0.1s;
  transition: all 0.1s;
}

#calcRouteButton {
  position: absolute;
  top: 10px;
  right: 240px;
  width: 200px;
  z-index: 1;
  border: solid 2px black;
}

#testButton {
  position: absolute;
  top: 10px;
  right: 30px;
  width: 200px;
  z-index: 1;
  border: solid 2px black;
}

#myMap {
  position: absolute;
  top: 80px;
  bottom: 0;
  width: 100%;
  background-color: #ade1f5;
}
</style>
