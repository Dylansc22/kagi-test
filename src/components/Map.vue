<template>
  <div>
    <div id="myMap"></div>
    <button id="testButton" @click="addWikiData">add test marker</button>
  </div>
</template>

<script>
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";

import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

var L = require("leaflet");
require("leaflet-routing-machine");

export default {
  mounted() {
    this.initializeMap();
    this.initializeLRM();
  },
  data() {
    return {
      map: null
    };
  },
  methods: {
    //-122.2646, 37.4956
    initializeLRM() {
      L.Routing.control({
        waypoints: [L.latLng(37.49, -122.2), L.latLng(37.4992, -122.29)]
      }).addTo(this.map);
    },
    addCustomMarker(marker) {
      var el = document.createElement("div");
      el.className = "marker";

      console.log(marker);

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
                "<h6>" +
                marker.properties.wikidata +
                "</h6>"
            )
        )
        .addTo(this.map);
    },
    initializeMap() {
      mapboxgl.accessToken =
        "pk.eyJ1IjoiZHlsYW5jIiwiYSI6Im53UGgtaVEifQ.RJiPqXwEtCLTLl-Vmd1GWQ";
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

      geocoder.on("result", e => {
        console.log(e.result.geometry.coordinates);
        this.addCustomMarker(e.result);
      });
      //
    }
  }
};
</script>

<style lang="scss" scoped>
#testButton {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1;
}

#myMap {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  background-color: rgb(182, 182, 182);
}
</style>
