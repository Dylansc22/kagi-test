<template>
  <div>
    <div id="myMap"></div>
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
import nearestPoint from "@turf/nearest-point";
import * as turf from "@turf/helpers";

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
          features: []
        }
      },
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
    // addGeojsonCircles(routingEngine) {
    //   let circleColor = routingEngine == "graphhopper" ? "brown" : "orange";

    //   this.map.addLayer({
    //     id: `${routingEngine}CircleID`,
    //     type: "circle",
    //     source: `${routingEngine}RouteSource`,
    //     paint: {
    //       "circle-radius": 5,
    //       "circle-color": circleColor
    //     }
    //   });
    // },
    compareRoutesUsingTurf() {
      //Using the Map Maching Mapbox API -- Only 100 Coordinates Per Request -- https://docs.mapbox.com/api/overview/
      let gh = this.route.graphhopper.paths[0].points.coordinates;
      let mp = this.route.mapbox.routes[0].geometry.coordinates;

      //mapbox route (Linestring Feature), re-processed as Points FeatureCollection
      //I need this for a later turf.nearestPoints() function
      let input = [];
      mp.map(e => {
        input.push(turf.point(e));
      });
      let mapboxRouteAsPointsFeature = turf.featureCollection(input);

      let counter = 0;
      let detourSegment = [];
      let threshold = 0.01;

      gh.map((element, index) => {
        let currentDeviation = pointToLineDistance(element, mp, {
          units: "miles",
          mercator: false
        });

        currentDeviation = Math.round(currentDeviation * 100) / 100;

        //The current element is first segment of a detour
        if (currentDeviation >= threshold && detourSegment.length == 0) {
          // let snappedPoint = nearestPoint(element, mapboxRouteAsPointsFeature);
          // detourSegment.push(snappedPoint.geometry.coordinates);
          detourSegment.push(gh[index - 1]);
          detourSegment.push(element);
        }
        //The current element is part of the middle of a detour, far off course the mapbox route
        else if (currentDeviation >= threshold && detourSegment.length != 0) {
          detourSegment.push(element);
        }

        //The current element is the end of a detour, rejoining the main mapbox route
        else if (currentDeviation < threshold && detourSegment.length != 0) {
          // let snappedPoint = nearestPoint(element, mapboxRouteAsPointsFeature);
          // detourSegment.push(snappedPoint.geometry.coordinates);

          detourSegment.push(element);
          // detourSegment.push(gh[index + 1]);

          this.route.alternatives.features[counter] = {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: detourSegment
            }
          };
          detourSegment = [];
          counter++;
        } else if (gh.length - 1 === index && detourSegment.legnth != 0) {
          let snappedPoint = nearestPoint(element, mapboxRouteAsPointsFeature);
          detourSegment.push(snappedPoint);
          this.route.alternatives.features[counter] = {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: detourSegment
            }
          };
        }
      });
    },
    clearMap() {
      // this.map.removeLayer("graphhopperCircleID");
      // this.map.removeLayer("mapboxCircleID");
      this.map.removeLayer("graphhopperRouteID");
      this.map.removeLayer("mapboxRouteID");
      this.map.removeSource("graphhopperRouteSource");
      this.map.removeSource("mapboxRouteSource");
    },
    changeTransporation(type) {
      //only trigger behavior if someone is clicking a different transportion type than what is currently selected
      if (this.transporation != type) {
        this.transporation = type;
        if (this.markerList.length >= 2) {
          this.clearMap();
          this.triggerNewRoute();
        }
      }
    },
    undoLastMarker() {
       if (this.markerList.length > 2) {
        this.clearMap();
        this.markerList[this.markerList.length - 1].remove();
        this.markerList.pop();
        this.triggerNewRoute();
      }
      else if (this.markerList.length == 2) {
        this.clearMap();
        this.markerList[this.markerList.length - 1].remove();
        this.markerList.pop();
      }
      else if (this.markerList.length == 1) {
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
        // this.map.removeLayer("graphhopperCircleID");
        this.map.removeSource("graphhopperRouteSource");
      }
      if (this.map.getSource("mapboxRouteSource")) {
        this.map.removeLayer("mapboxRouteID");
        // this.map.removeLayer("mapboxCircleID");
        this.map.removeSource("mapboxRouteSource");
      }
    },
    displayRoute(myData, routingEngine) {
      
      if (routingEngine == "graphhopper") {
        this.map.addSource(`${routingEngine}RouteSource`, {
          type: "geojson",
          data: myData
        });
      } 
      //Mapbox Route
      else {
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

      // this.addGeojsonCircles(routingEngine);
    },
    async triggerNewRoute() {
      let ghResponse = this.graphhopperRoutePromise();
      let mpResponse = this.mapboxRoutePromise();
      let allData = await Promise.all([ghResponse, mpResponse]);

      this.route.mapbox = allData[1].data;

      this.route.graphhopper = allData[0];

      this.compareRoutesUsingTurf()
      this.displayRoute(this.route.alternatives, "graphhopper");
      this.displayRoute(this.route.mapbox.routes[0].geometry, "mapbox");

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

      await axios.get(
        `${url}key=${key}&point=${points.start.lat},${points.start.lng}&point=${points.end.lat},${points.end.lng}&vehicle=${parameters.vehicle}&locale=${parameters.locale}&calc_points=${parameters.calc_points}&points_encoded=${parameters.points_encoded}`
      );
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
            // this.map.removeLayer("graphhopperCircleID");
            // this.map.removeLayer("mapboxCircleID");
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
