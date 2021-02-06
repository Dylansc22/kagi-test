<template>
  <div>
    <div id="myMap"></div>
    <button id="testButton" @click="testerButton"><h4>Run Test</h4></button>
    <button id="locationButton" @click="addMyLocation">
      <h4>Add My Location</h4>
    </button>
  </div>
</template>

<script>
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";

import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

// var L = require("leaflet");
// require("leaflet-routing-machine");
const axios = require("axios");

export default {
  mounted() {
    this.initializeMap();
  },
  data() {
    return {
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
    calcGHRoute() {
      alert(this.keys.graphhopper);
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
    async testerButton() {
      // --------------- Test 'capturing' the current location of the yellow marker
      try {
        console.log(
          `lat:  ${this.locationMarker.getLngLat().lat}`,
          `long: ${this.locationMarker.getLngLat().lng}`
        );
      } catch (error) {
        console.log("no marker on screen");
      }

      //test calling wikipedia data via axios
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
      marker.properties.wikiinfo = {};
      this.markerList.push(marker);
    },
    returnTest() {
      return "puppies from test";
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
    addCustomMarker(marker) {
      this.pushMarkerToList(marker);
      var el = document.createElement("div");
      el.className = "marker";

      new mapboxgl.Marker({
        element: el,
        anchor: "bottom"
      })
        .setLngLat({
          lng: marker.geometry.coordinates[0],
          lat: marker.geometry.coordinates[1]
        })
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }) // add popups
            .setHTML(
              "<h3>" +
                marker.text +
                "</h3><p>" +
                marker.place_name +
                "</p>" +
                "<h5>" +
                marker.properties.wikidata +
                "</h5>" +
                "<h6>" +
                marker.properties.wikiinfo +
                "</h6>"
            )
        )
        .addTo(this.map);
    },
    initializeMap() {
      mapboxgl.accessToken = process.env.VUE_APP_MAPBOX_API;
      this.map = new mapboxgl.Map({
        container: "myMap", // container id
        style: "mapbox://styles/dylanc/ckknn6k240hmz17pccv0pun4w", // style URL
        center: [-122.2646, 37.4956], // starting position [lng, lat]
        zoom: 11 // starting zoom
      });

      //Add geocoder
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        marker: false
      });
      this.map.addControl(geocoder, "top-left");

      geocoder.on("result", async e => {
        let marker = e.result;
        marker.properties.wikiinfo = await this.fetchWikidata(
          marker.properties.wikidata
        );
        this.addCustomMarker(marker);

        //I need a technique to store all the markers onscreen (thus an array of markers)
        //This is likely not the most memory efficient technique to manage this issue because I am likely saving a lot of excess information about each marker in the array
        //discussed further here -- https://stackoverflow.com/questions/53037503/get-marker-feature-instance-in-mapbox
        // this.markerList.push(e.results);

        // console.log("wiki info below");
        // console.log(e.result.properties.wikiinfo);
        // console.log(e.properties.wikiinfo)
      });
      //
    }
  }
};
</script>

<style lang="scss" scoped>
#locationButton {
  position: absolute;
  bottom: 30px;
  right: 30px;
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
  background-color: rgb(182, 182, 182);
}
</style>
