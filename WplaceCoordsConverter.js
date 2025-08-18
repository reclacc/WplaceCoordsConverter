// ==UserScript==
// @name         Wplace.live Coordinate Converter
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Converts coordinates on wplace.live between Tile/Pixel and Lat/Lon
// @author       reclacc
// @match        *://*.wplace.live/*
// @icon         https://raw.githubusercontent.com/reclacc/WplaceCoordsConverter/4937468765558c7e53125e70764ebe204726a309/icon.png
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    class Projector {
        constructor(tileSize = 1000) {
            this.ws = 2 * Math.PI * 6378137 / 2;
            this.tileSize = tileSize;
            this.initialResolution = 2 * this.ws / tileSize;
            this.FACTOR = 0.001885;
        }

        resolution(zoom) {
            return this.initialResolution / 2 ** zoom;
        }

        pixelsToMeters(x, y, zoom) {
            const res = this.resolution(zoom);
            return [
                x * res - this.ws,
                this.ws - y * res
            ];
        }

        metersToLatLon(x, y) {
            const lon = x / this.ws * 180;
            let lat = y / this.ws * 180;
            lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
            return [lat, lon];
        }

        pixelsToLatLon(x, y, zoom) {
            const [mx, my] = this.pixelsToMeters(x, y, zoom);
            return this.metersToLatLon(mx, my);
        }

        latLonToMeters(lat, lon) {
            const x = lon / 180 * this.ws;
            const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
            return [x, y * this.ws / 180];
        }

        metersToPixels(x, y, zoom) {
            const res = this.resolution(zoom);
            return [
                (x + this.ws) / res,
                (this.ws - y) / res
            ];
        }

        latLonToPixels(lat, lon, zoom) {
            const [mx, my] = this.latLonToMeters(lat, lon);
            return this.metersToPixels(mx, my, zoom);
        }

        latLonToPixelsFloor(lat, lon, zoom) {
            const [px, py] = this.latLonToPixels(lat, lon, zoom);
            return [Math.floor(px), Math.floor(py)];
        }

        latLonToTile(lat, lon, zoom) {
            const [px, py] = this.latLonToPixels(lat, lon, zoom);
            const tileX = Math.floor(px / this.tileSize);
            const tileY = Math.floor(py / this.tileSize);
            return [tileX, tileY];
        }

        latLonToTileAndPixel(lat, lon, zoom) {
            const [px, py] = this.latLonToPixels(lat, lon, zoom);
            const tileX = Math.floor(px / this.tileSize);
            const tileY = Math.floor(py / this.tileSize);
            const pixelX = Math.floor(px) % this.tileSize;
            const pixelY = Math.floor(py) % this.tileSize;
            return {
                tile: [tileX, tileY],
                pixel: [pixelX, pixelY]
            };
        }

        pixelBounds(x, y, zoom) {
            return {
                min: this.pixelsToMeters(x, y, zoom),
                max: this.pixelsToMeters(x + 1, y + 1, zoom)
            };
        }

        pixelToBoundsLatLon(x, y, zoom) {
            const bounds = this.pixelBounds(x, y, zoom);
            const dx = (bounds.max[0] - bounds.min[0]) * this.FACTOR;
            const dy = (bounds.max[1] - bounds.min[1]) * this.FACTOR;

            const adjustedMin = [
                bounds.min[0] - dx,
                bounds.min[1] - dy
            ];

            const adjustedMax = [
                bounds.max[0] - dx,
                bounds.max[1] - dy
            ];

            return {
                min: this.metersToLatLon(...adjustedMin),
                max: this.metersToLatLon(...adjustedMax)
            };
        }

        pixelCenterLatLon(x, y, zoom) {
            const bounds = this.pixelToBoundsLatLon(x, y, zoom);
            const centerLat = (bounds.min[0] + bounds.max[0]) / 2;
            const centerLon = (bounds.min[1] + bounds.max[1]) / 2;
            return [centerLat, centerLon];
        }
    }

    function createUI() {
        const projector = new Projector();
        const fixedZoom = 11;

        const container = document.createElement('div');
        container.id = 'coord-converter';
        container.innerHTML = `
            <h2>Конвертер координат</h2>
            <div class="input-group">
                <label for="tile-x">TlX:</label>
                <input type="number" id="tile-x" value="0">
                <label for="tile-y">TlY:</label>
                <input type="number" id="tile-y" value="0">
                <label for="pixel-x">PxX:</label>
                <input type="number" id="pixel-x" value="0">
                <label for="pixel-y">PxY:</label>
                <input type="number" id="pixel-y" value="0">
                <button id="toLatLon">T/P → Lat/Lon</button>
            </div>
            <div class="input-group">
                <label for="lat">Lat:</label>
                <input type="number" id="lat" step="any" value="0">
                <label for="lon">Lon:</label>
                <input type="number" id="lon" step="any" value="0">
                <button id="toTilePixel">Lat/Lon → T/P</button>
            </div>
            <div id="output-area"></div>
        `;
        document.body.appendChild(container);

        GM_addStyle(`
            #coord-converter {
                position: fixed;
                top: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                padding: 15px;
                border-radius: 8px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                z-index: 9999;
                max-width: 300px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }
            #coord-converter h2 {
                margin: 0 0 10px;
                font-size: 16px;
                text-align: center;
            }
            #coord-converter .input-group {
                display: grid;
                grid-template-columns: auto 1fr auto 1fr;
                gap: 5px;
                align-items: center;
                margin-bottom: 10px;
            }
            #coord-converter .input-group label {
                white-space: nowrap;
            }
            #coord-converter .input-group input {
                width: 100%;
                background: #333;
                color: #fff;
                border: 1px solid #555;
                padding: 5px;
                border-radius: 4px;
            }
            #coord-converter .input-group button {
                grid-column: 1 / -1;
                background-color: #007bff;
                color: white;
                border: none;
                padding: 8px;
                cursor: pointer;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            #coord-converter .input-group button:hover {
                background-color: #0056b3;
            }
            #output-area {
                background: #222;
                padding: 10px;
                border-radius: 4px;
                min-height: 40px;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
        `);

        document.getElementById('toLatLon').addEventListener('click', () => {
            const tlX = parseInt(document.getElementById('tile-x').value);
            const tlY = parseInt(document.getElementById('tile-y').value);
            const pxX = parseInt(document.getElementById('pixel-x').value);
            const pxY = parseInt(document.getElementById('pixel-y').value);

            const pixelX = tlX * projector.tileSize + pxX;
            const pixelY = tlY * projector.tileSize + pxY;

            if (
                !Number.isInteger(tlX) || !Number.isInteger(tlY) ||
                !Number.isInteger(pxX) || !Number.isInteger(pxY) ||
                pxX < 0 || pxX >= projector.tileSize ||
                pxY < 0 || pxY >= projector.tileSize ||
                tlX < 0 || tlX > 2047 ||
                tlY < 0 || tlY > 2047
            ) {
                document.getElementById('output-area').textContent = 'Ошибка: некорректные входные данные.';
                return;
            }

            const [lat, lon] = projector.pixelCenterLatLon(pixelX, pixelY, fixedZoom);
            document.getElementById('output-area').textContent = `Lat: ${lat}\nLon: ${lon}`;

            document.getElementById('lat').value = lat;
            document.getElementById('lon').value = lon;
        });

        document.getElementById('toTilePixel').addEventListener('click', () => {
            const lat = parseFloat(document.getElementById('lat').value);
            const lon = parseFloat(document.getElementById('lon').value);

            if (isNaN(lat) || isNaN(lon)) {
                document.getElementById('output-area').textContent = 'Ошибка: некорректные входные данные.';
                return;
            }

            const result = projector.latLonToTileAndPixel(lat, lon, fixedZoom);
            const tlX = result.tile[0];
            const tlY = result.tile[1];
            const pxX = result.pixel[0];
            const pxY = result.pixel[1];

            document.getElementById('output-area').textContent = `TlX: ${tlX}\nTlY: ${tlY}\nPxX: ${pxX}\nPxY: ${pxY}`;

            document.getElementById('tile-x').value = tlX;
            document.getElementById('tile-y').value = tlY;
            document.getElementById('pixel-x').value = pxX;
            document.getElementById('pixel-y').value = pxY;
        });
    }

    window.addEventListener('load', createUI);
})();
