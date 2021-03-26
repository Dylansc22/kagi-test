<template>
  <div>
    <div id="myMap"></div>
    <div id="myZoom">zoom: {{ roundedZoom }}</div>
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

require("graphhopper-js-api-client");
// var GraphHopper = require("graphhopper-js-api-client/src/GraphHopperRouting"); // If you only need e.g. Routing, you can only require the needed parts
// var GHInput = require("graphhopper-js-api-client/src/GHInput");

import H from "here-js-api/scripts/mapsjs-core";
import "here-js-api/scripts/mapsjs-service";
// import "here-js-api/scripts/mapsjs-ui";
// import "here-js-api/scripts/mapsjs-mapevents";
// import "here-js-api/scripts/mapsjs-clustering";
// const axios = require("axios");

import POILayer from "@/poilayers.js";

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
      // HERE initialisation, with API key
      platform: new H.service.Platform({
        apikey: "Z7bRvZnp1S4qP30GF-l2fZoatQUZVEoawNQZfXEcTUw"
      }),
      mapIsStatic: true,
      isActive: true,
      map: null,
      currentZoom: 11,
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
    initializeMap() {
      // TODO(z64): obviously, this is not what we will do in production. we will
      // develop a backend interface to hide and proxy requests off to mapbox where
      // our secrets are safe. :)

      mapboxgl.accessToken =
        "pk.eyJ1IjoidnByZWxvdmFjIiwiYSI6ImNqYzlqZjZjdDAwMXEyenJ1eDA0ZjJnanAifQ.HfZmaH2OvqcECAIi87A4Vg";

      const config = {
        container: "map",
        style: "mapbox://styles/vprelovac/cklyc5k0z3vxf17po9xna1cg3",
        center: [-122.14, 37.44],
        zoom: 9,
        minZoom: 1, //zoomed out (world view)
        maxZoom: 22, //zoomed in
        minPitch: 0, //0 degrees (flat-map)
        maxPitch: 60, //85 degrees is default
        hash: true, //include zoom, lat, long, bearing, pitch in page URL (default is false but this helps for dev purposes - FIXME eventually)
        doubleClickZoom: true
      };

      var map = new mapboxgl.Map(config);

      // Add zoom and rotation controls to the map.
      var nav = new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: false
      });

      map.addControl(nav, "top-right"); //adds map-navigation controller

      

      /**
       * When the user moves the map, we want to update the links
       * for the static image and the hash location in the URL.
       */
      map.on("moveend", function() {
        reloadPOIs();
      });

      map.on("load", function() {
        initPOILayers();
        reloadPOIs();
      });

      /**
       * Loads the POIs for the visible area, either from cache or from HERE's API
       */
      function reloadPOIs() {
        for (var i = 0; i < poiLayers.length; i++) {
          poiLayers[i].loadPOIs();
        }
      }

      /**
       * Sets up the POI layers in Mapbox
       */
      function initPOILayers() {
        for (var i = 0; i < poiLayers.length; i++) {
          poiLayers[i].initLayer();
        }
      }

      /**
       * The POI layers to show. See POILayer.js for a description of the fields
       */

      // eslint-disable-next-line no-unused-vars
      let coursePOIs = [
        "400-4000-4581", //Airport
        "800-8200-0173", //Higher Education
        // '800-8000-0000', //Hospital or Health Care Facility
        "300-3000-0025" //Historical Monument
        // '300-3000-0000', //Landmark-Attraction
        // '550-5510-0000', //Outdoor-Recreation
        // '550-5510-0202', //Park-Recreation Area
      ];

      // eslint-disable-next-line no-unused-vars
      let finePOIs = [
        "100-1000", //Restaurant
        "100-1100", //Coffee-Tea
        "200-2000", //Nightlife-Entertainment
        "200-2100", //Cinema
        "200-2200", //Theatre, Music and Culture
        "200-2300", //Gambling-Lottery-Betting
        "300-3000", //Landmark-Attraction
        "300-3100", //Museum
        "300-3200", //Religious Place
        // '400-4100', //Public Transport
        "500-5000", //Hotel-Motel
        "500-5100", //Lodging
        "550-5520", //Leisure
        "600-6000", //Convenience Store
        "600-6100", //Mall-Shopping Complex
        "600-6200", //Department Store
        "600-6300", //Food and Drink
        "600-6400" //Drugstore or Pharmacy
        // '600-6500', //Electronics
        // '600-6600', //Hardware, House and Garden
        // '600-6700', //Bookstore
        // '600-6800', //Clothing and Accessories
        // '600-6900', //Consumer Goods
        // '600-6950', //Hair and Beauty
        // '700-7000', //Banking
        // '700-7010', //ATM
        // '700-7050', //Money-Cash Services
        // '700-7100', //Communication-Media
        // '700-7200', //Commercial Services
        // '700-7250', //Business-Industry
        // '700-7300', //Police-Fire-Emergency
        // '700-7400', //Consumer Services
        // '700-7450', //Post Office
        // '700-7460', //Tourist Information
        // '700-7600', //Fueling Station
        // '700-7800', //Car Dealer-Sales
        // '700-7850', //Car Repair-Service
        // '700-7851', //Car Rental
        // '700-7900', //Truck-Semi Dealer-Services
        // '800-8000', //Hospital or Health Care Facility
        // '800-8100', //Government or Community Facility
        // '800-8200', //Education Facility
        // '800-8300', //Library
        // '800-8600', //Sports Facility-Venue
        // '800-8700', //Facilities
        // '900-9200', //Outdoor Area-Complex
        // '900-9300', //Building
      ];

      let poiLayers = [
        new POILayer(
          map,
          this.platform,
          "course",
          coursePOIs,
          "circle",
          100000,
          10,
          0
        )
        // new POILayer(map, platform, 'fine', finePOIs, 'circle', 2500, 14, 0),
      ];
    }
  },
  computed: {
    roundedZoom() {
      return Math.round(this.currentZoom * 100) / 100;
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

#myZoom {
  position: absolute;
  bottom: 35px;
  left: 10px;
}
</style>
