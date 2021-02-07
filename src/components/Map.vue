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
        mapbox: {}
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
    changeTransporation(type) {
      if (this.transporation != type) {
        this.transporation = type;
        if (this.markerList.length >= 2) {
        this.map.removeLayer("graphhopperRouteID")
        this.map.removeLayer("mapboxRouteID")
        this.map.removeSource("graphhopperRouteSource")
        this.map.removeSource("mapboxRouteSource")
        this.triggerNewRoute();
      }
      }
    },
    undoLastMarker(){
      if (this.markerList.length >= 2) {
        this.map.removeLayer("graphhopperRouteID")
        this.map.removeLayer("mapboxRouteID")
        this.map.removeSource("graphhopperRouteSource")
        this.map.removeSource("mapboxRouteSource")
        this.markerList.[this.markerList.length - 1].remove();
        this.markerList.pop();
        this.triggerNewRoute();
      } else if (this.markerList.length >= 1) {
        this.markerList.[this.markerList.length - 1].remove();
        this.markerList.pop();
      }
    },
    async calculateMapboxRoute() {
      if (this.transporation == "driving") {
        var mode = "driving"
      } else if (this.transporation == "cycling") {
        mode = "cycling"
      } else if (this.transporation == "walking") {
        mode = "walking"
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

        let x = await axios.get(
          `${url}${mode}${pointString}?access_token=${key}&geometries=geojson`
        );
        this.route.mapbox = x.data;
        this.displayRoute(this.route.mapbox.routes[0].geometry, "mapbox")
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
    displayRoute(data, routingEngine) {
      this.map.addSource(`${routingEngine}RouteSource`, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: data
        }
      });

      let color = routingEngine == "graphhopper" ? "#28ac9f" : "#0072b8";

      if (this.transporation == "driving") {
        var shape = "line"
        var style = {
          "line-color": color,
          "line-opacity": 0.8,
          "line-width": {
            type: "exponential",
            base: 1.5,
            stops: [
              [0, 7 * Math.pow(2, 0 - 9)], //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
              [24, 7 * Math.pow(2, 24 - 18)] //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
            ]
          }
        }
        var layout = {}; //default
      } else if (this.transporation == "cycling") {
        shape = "line"
        style = {
          "line-color": color,
          "line-dasharray": [2,1.25], //[dashes, gaps] measured in units of line-width
          "line-opacity": 0.8,
          "line-width": {
            type: "exponential",
            base: 1.5,
            stops: [
              [0, 7 * Math.pow(2, 0 - 9)], //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
              [24, 7 * Math.pow(2, 24 - 18)] //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
            ]
          }
        }
        layout = {}; //default
      } else if (this.transporation == "walking") {
        shape = "line"
        style = {
          "line-color": color,
          "line-dasharray": [.1,2], //[dashes, gaps] measured in units of line-width
          "line-opacity": 0.8,
          "line-width": {
            type: "exponential",
            base: 1.5,
            stops: [
              [0, 7 * Math.pow(2, 0 - 9)], //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
              [24, 7 * Math.pow(2, 24 - 18)] //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
            ]
          }
        }
        layout = {
        "line-cap": "round",
        "line-join": "round"
      }
      }


      this.map.addLayer({
        id: `${routingEngine}RouteID`,
        type: shape,
        source: `${routingEngine}RouteSource`,
        paint: style,
        layout: layout
      });
    },
    triggerNewRoute() {
      this.updateRoute = !this.updateRoute;
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

      let x = await axios.get(
        `${url}key=${key}&point=${points.start.lat},${points.start.lng}&point=${points.end.lat},${points.end.lng}&vehicle=${parameters.vehicle}&locale=${parameters.locale}&calc_points=${parameters.calc_points}&points_encoded=${parameters.points_encoded}`
      );
      console.log(x.data);
    },
    async tester() {

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
        this.map.removeLayer("graphhopperRouteID")
        this.map.removeLayer("mapboxRouteID")
        this.map.removeSource("graphhopperRouteSource")
        this.map.removeSource("mapboxRouteSource")
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
          this.addAppleMarker(marker);
          if (this.markerList.length == 1) {
            this.flyToFirstMarker(marker);
          }
          this.removeCurrentRoute();
          this.triggerNewRoute();
        }
      });
    },
    calculateGraphhopperRoute() {
      if (this.transporation == "driving") {
        var mode = "car"
      } else if (this.transporation == "cycling") {
        mode = "bike"
      } else if (this.transporation == "walking") {
        mode = "foot"
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

        ghRouting
          .doRequest()
          .then(json => {
            this.route.graphhopper = json;
            this.displayRoute(this.route.graphhopper.paths[0].points, "graphhopper");
            this.zoomToNewRoute();

            // this.$emit(
            //   "childDisplayRoute",
            //   val.id,
            //   val.source,
            //   jsonParsed.paths[0].points
            // );
          })
          .catch(err => {
            alert("uh oh spaghettios! Graphhopper errored out");
            console.error(err.message);
          });
      }
    }
  },

  watch: {
    updateRoute() {
      this.calculateGraphhopperRoute();
      this.calculateMapboxRoute();
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
