<template>
  <div>
    <div id="myMap"></div>

    <button id="calcRouteButton" @click="calcGHRoute">
      <h4>Calc Route</h4>
    </button>
    <button id="testButton" @click="tester"><h4>Run Test</h4></button>
    <button id="locationButton" @click="addMyLocation">
      <h4>Add My Location</h4>
    </button>

    <button
      id="mapInfo"
      @click="isActive = !isActive"
      :class="{ big: isActive }"
    >
      <h6>mapInfo</h6>
      <!-- <div>Mode: {{ mapMode }}</div>
      <div>Center: {{ hudCenter }}</div>
      <div>Zoom: {{ hudZoom }}</div> -->
      <div>Ready for GH Calc: {{ mapIsStatic }}</div>
      <!-- <div>Current Marker: {{ currentMarker }}</div> -->
    </button>
  </div>
</template>

<script>
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
      locationMarker: null,
      markerList: [],
      counter: 0,
      keys: {
        graphhopper: process.env.VUE_APP_GRAPHOPPER_API
      },
      transporation: {
        driving: true,
        biking: false,
        walking: false
      },
      routeStart: {
        marker: false,
        mapCenter: true,
        otherMarkers: false
      }
    };
  },
  methods: {
    zoomToNewRoute() {
      if (this.markerList.length >= 2) {
        this.map.fitBounds(this.route.graphhopper.paths[0].bbox, {
          padding: 100
        });
      }
    },
    removeCurrentRoute() {
      if (this.map.getSource("routeSource")) {
        this.map.removeLayer("routeID");
        this.map.removeSource("routeSource");
      }
    },
    displayRoute(data) {
      console.log("data from display route", data);
      this.map.addSource("routeSource", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: data
        }
      });

      this.map.addLayer({
        id: "routeID",
        type: "line",
        source: "routeSource",
        paint: {
          "line-color": "green", //"#1c4358", //pathwayscolor //"#FF6600" //, //"#4f7ba4",
          // "line-dasharray": [2,1.5], //[dashes, gaps] measured in units of line-width
          "line-opacity": 0.9,
          "line-width": {
            type: "exponential",
            base: 1.5,
            stops: [
              [0, 4.5 * Math.pow(2, 0 - 9)], //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
              [24, 4.5 * Math.pow(2, 24 - 18)] //[0, baseWidth * Math.pow(2, (0 - baseZoom))],
            ]
          }
        }
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
    addMyLocation() {
      if (this.locationMarker) {
        this.locationMarker.remove();
        this.locationMarker = null;
      } else {
        this.locationMarker = new mapboxgl.Marker({
          color: "orange",
          anchor: "bottom",
          draggable: true
        })
          .setLngLat({
            lng: -122.2646,
            lat: 37.4956
          })
          .addTo(this.map);
      }
    },
    async tester() {
      // ------------- update route trigger --------------------
      this.updateRoute = !this.updateRoute;

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
            this.map.flyTo({
              center: [
                marker.geometry.coordinates[0], 
                marker.geometry.coordinates[1] 
              ],
              essential: true // this animation is considered essential with respect to prefers-reduced-motion
            });
            console.log(marker);
          }
          this.removeCurrentRoute();
          this.triggerNewRoute();
        }
      });
    },
    calculateRoute() {
      let defaults = {
        key: this.keys.graphhopper,
        vehicle: "car",
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
            let data = json.paths[0].points;
            this.route.graphhopper = json;
            this.displayRoute(data);
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
      this.calculateRoute();
    }
  }
};
</script>

<style lang="scss" scoped>
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
  bottom: 30px;
  right: 30px;
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
