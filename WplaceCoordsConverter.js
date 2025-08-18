// ==UserScript==
// @name         Wplace.live Coordinate Converter
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Converts coordinates on wplace.live between Tile/Pixel and Lat/Lon
// @author       reclacc
// @run-at       document-start
// @match        *://*.wplace.live/*
// @icon         https://raw.githubusercontent.com/reclacc/WplaceCoordsConverter/4937468765558c7e53125e70764ebe204726a309/icon.png
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
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

        const savedX = GM_getValue('windowX', 20);
        const savedY = GM_getValue('windowY', 20);
        const savedCollapsed = GM_getValue('collapsed', false);

        const container = document.createElement('div');
        container.id = 'coord-converter';
        container.style.left = savedX + 'px';
        container.style.top = savedY + 'px';

        container.innerHTML = `
            <div class="converter-header">
                <div class="header-left">
                    <div class="header-icon">📍</div>
                    <h2>Конвертер координат</h2>
                </div>
                <div class="header-controls">
                    <button id="collapse-btn" class="control-btn" title="Свернуть/Развернуть">
                        <span class="collapse-icon">${savedCollapsed ? '▼' : '▲'}</span>
                    </button>
                </div>
            </div>
            <div class="converter-content" ${savedCollapsed ? 'style="display: none;"' : ''}>
                <div class="conversion-section">
                    <div class="section-header">
                        <div class="section-icon">🗂️</div>
                        <span>Tile/Pixel → Lat/Lon</span>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label for="tile-x">TlX</label>
                            <input type="number" id="tile-x" min="0" max="2047" placeholder="0-2047">
                        </div>
                        <div class="input-group">
                            <label for="tile-y">TlY</label>
                            <input type="number" id="tile-y" min="0" max="2047" placeholder="0-2047">
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label for="pixel-x">PxX</label>
                            <input type="number" id="pixel-x" min="0" max="999" placeholder="0-999">
                        </div>
                        <div class="input-group">
                            <label for="pixel-y">PxY</label>
                            <input type="number" id="pixel-y" min="0" max="999" placeholder="0-999">
                        </div>
                    </div>
                    <button id="toLatLon" class="convert-btn primary">
                        <span class="btn-icon">📍</span>
                        Конвертировать в Lat/Lon
                    </button>
                </div>

                <div class="conversion-section">
                    <div class="section-header">
                        <div class="section-icon">🌍</div>
                        <span>Lat/Lon → Tile/Pixel</span>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label for="lat">Latitude</label>
                            <input type="number" id="lat" step="any" placeholder="Широта">
                        </div>
                        <div class="input-group">
                            <label for="lon">Longitude</label>
                            <input type="number" id="lon" step="any" placeholder="Долгота">
                        </div>
                    </div>
                    <button id="toTilePixel" class="convert-btn secondary">
                        <span class="btn-icon">🗂️</span>
                        Конвертировать в T/P
                    </button>
                </div>

                <div class="output-section">
                    <div class="section-header">
                        <div class="section-icon">📋</div>
                        <span>Результат</span>
                        <button id="copy-btn" class="control-btn small" title="Копировать результат">
                            <span>📋</span>
                        </button>
                    </div>
                    <div id="output-area">Введите координаты и нажмите кнопку конвертации</div>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        makeDraggable(container);

        GM_addStyle(`
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Geist:wght@400;500;600&display=swap');

            input {
                transition: border-color 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease;
            }

            #coord-converter {
                position: fixed;
                background: linear-gradient(145deg, rgba(16, 20, 31, 0.95), rgba(24, 30, 45, 0.95));
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ffffff;
                border-radius: 16px;
                font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                z-index: 10000;
                width: 360px;
                max-height: 87vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3),
                           0 0 0 1px rgba(255, 255, 255, 0.05);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                user-select: none;
                overflow:visible;
            }

            #coord-converter:hover {
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4),
                           0 0 0 1px rgba(255, 255, 255, 0.1);
                transform: translateY(-2px);
            }

            .converter-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                cursor: move;
                background: linear-gradient(90deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
                border-radius: 16px 16px 0 0;
            }

            .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .header-icon {
                font-size: 20px;
                filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5));
            }

            .converter-header h2 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .header-controls {
                display: flex;
                gap: 8px;
            }

            .control-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #ffffff;
                padding: 6px 8px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .control-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }

            .control-btn.small {
                padding: 4px 6px;
                font-size: 12px;
            }

            .converter-content {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 18px;
                overflow: visible;
            }

            .conversion-section {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 16px;
                transition: all 0.3s ease;
            }

            .conversion-section:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(255, 255, 255, 0.12);
            }

            .section-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 14px;
                font-weight: 500;
                font-size: 13px;
                color: #e2e8f0;
            }

            .section-icon {
                font-size: 16px;
                opacity: 0.8;
            }

            .input-row {
                display: flex;
                gap: 12px;
                margin-bottom: 14px;
            }

            .input-group {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .input-group label {
                font-size: 12px;
                font-weight: 500;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .input-group input {
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ffffff;
                padding: 10px 12px;
                border-radius: 8px;
                font-size: 13px;
                font-family: 'JetBrains Mono', monospace;
                transition: all 0.2s ease;
                width: 100%;
                box-sizing: border-box;
            }

            .input-group input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                background: rgba(15, 23, 42, 0.8);
            }

            .input-group input::placeholder {
                color: #64748b;
                opacity: 0.7;
            }

            .convert-btn {
                width: 100%;
                padding: 12px 18px;
                border-radius: 10px;
                border: none;
                font-weight: 500;
                font-size: 13px;
                font-family: 'Geist', sans-serif;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                position: relative;
                overflow: hidden;
            }

            .convert-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                transition: left 0.5s;
            }

            .convert-btn:hover::before {
                left: 100%;
            }

            .convert-btn.primary {
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                color: white;
                box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
            }

            .convert-btn.primary:hover {
                background: linear-gradient(135deg, #2563eb, #1e40af);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
            }

            .convert-btn.secondary {
                background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                color: white;
                box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
            }

            .convert-btn.secondary:hover {
                background: linear-gradient(135deg, #7c3aed, #6d28d9);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
            }

            .convert-btn:active {
                transform: translateY(0);
            }

            .btn-icon {
                font-size: 16px;
            }

            .output-section {
                background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1));
                border: 1px solid rgba(34, 197, 94, 0.2);
                border-radius: 12px;
                padding: 16px;
                overflow: visible;
            }

            .output-section .section-header {
                color: #10b981;
                margin-bottom: 12px;
                justify-content: space-between;
            }

            #output-area {
                background: rgba(15, 23, 42, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.05);
                padding: 14px;
                border-radius: 8px;
                min-height: 50px;
                max-height: 100px;
                overflow-y: auto;
                white-space: pre-wrap;
                word-wrap: break-word;
                font-family: 'JetBrains Mono', monospace;
                font-size: 12px;
                line-height: 1.4;
                color: #e2e8f0;
                position: relative;

                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
            }

            #output-area::-webkit-scrollbar {
                width: 6px;
            }
            #output-area::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 3px;
            }
            #output-area::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }
            #output-area::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .collapse-icon {
                font-size: 12px;
                transition: transform 0.3s ease;
            }

            input.error {
                border-color: #ef4444 !important;
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
                background: rgba(239, 68, 68, 0.05) !important;
                animation: shake 0.5s ease-in-out;
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }

            #output-area.error {
                background: rgba(239, 68, 68, 0.1) !important;
                border-color: rgba(239, 68, 68, 0.2) !important;
            }

            .success {
                color: #10b981 !important;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .processing {
                animation: pulse 1s infinite;
            }

            input[type="number"]::-webkit-outer-spin-button,
            input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none;
            }

            input[type='number'],
            input[type="number"]:hover,
            input[type="number"]:focus {
                appearance: none;
                -moz-appearance: textfield;
            }
        `);

        const collapseBtn = document.getElementById('collapse-btn');
        const content = container.querySelector('.converter-content');
        const collapseIcon = collapseBtn.querySelector('.collapse-icon');
        let isCollapsed = savedCollapsed;

        collapseBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            content.style.display = isCollapsed ? 'none' : 'flex';
            collapseIcon.textContent = isCollapsed ? '▼' : '▲';
            GM_setValue('collapsed', isCollapsed);
        });

        function resetError() {
            this.classList.remove('error');

            const output = document.getElementById('output-area');
            if (output.classList.contains('error')) {
                output.textContent = 'Введите координаты и нажмите кнопку конвертации';
                output.className = '';
            }
        }

        document.querySelectorAll('#tile-x, #tile-y, #pixel-x, #pixel-y, #lat, #lon').forEach(input => {
            input.addEventListener('input', resetError);
            input.addEventListener('focus', resetError);
        });

        function validateTilePixelInputs() {
            let isValid = true;
            const errorFields = [];

            document.querySelectorAll('#tile-x, #tile-y, #pixel-x, #pixel-y').forEach(input => {
                input.classList.remove('error');
            });

            const validateIntegerField = (input, min, max) => {
                const value = parseInt(input.value);
                if (isNaN(value) || value < min || value > max) {
                    input.classList.add('error');
                    errorFields.push(input.id);
                    return false;
                }
                return true;
            };

            isValid = validateIntegerField(document.getElementById('tile-x'), 0, 2047) && isValid;
            isValid = validateIntegerField(document.getElementById('tile-y'), 0, 2047) && isValid;
            isValid = validateIntegerField(document.getElementById('pixel-x'), 0, 999) && isValid;
            isValid = validateIntegerField(document.getElementById('pixel-y'), 0, 999) && isValid;

            return {
                isValid,
                errorFields
            };
        }

        function validateLatLonInputs() {
            let isValid = true;
            const errorFields = [];

            document.querySelectorAll('#lat, #lon').forEach(input => {
                input.classList.remove('error');
            });

            const lat = document.getElementById('lat');
            const lon = document.getElementById('lon');

            const validateCoordinate = (input, min, max) => {
                const value = parseFloat(input.value);
                if (isNaN(value) || value < min || value > max) {
                    input.classList.add('error');
                    errorFields.push(input.id);
                    return false;
                }
                return true;
            };

            isValid = validateCoordinate(lat, -90, 90) && isValid;
            isValid = validateCoordinate(lon, -180, 180) && isValid;

            return {
                isValid,
                errorFields
            };
        }

        document.getElementById('toLatLon').addEventListener('click', () => {
            const validation = validateTilePixelInputs();

            if (!validation.isValid) {
                const output = document.getElementById('output-area');
                output.textContent = `❌ Ошибка валидации:\n\nПроверьте поля: ${validation.errorFields.join(', ')}\n\nДиапазоны:\n• TlX/TlY: 0-2047\n• PxX/PxY: 0-999`;
                output.className = 'error';
                return;
            }

            const btn = document.getElementById('toLatLon');
            const output = document.getElementById('output-area');

            btn.classList.add('processing');
            output.textContent = 'Обработка...';

            setTimeout(() => {
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
                    output.textContent = '❌ Ошибка: Некорректные входные данные\n\nПроверьте диапазоны:\n• TlX, TlY: 0-2047\n• PxX, PxY: 0-999';
                    output.className = 'error';
                    btn.classList.remove('processing');
                    return;
                }

                const [lat, lon] = projector.pixelCenterLatLon(pixelX, pixelY, fixedZoom);
                output.textContent = `✅ Успешно конвертировано:\n\nLatitude:  ${lat}\nLongitude: ${lon}`;
                output.className = 'success';

                document.getElementById('lat').value = lat;
                document.getElementById('lon').value = lon;

                btn.classList.remove('processing');
            }, 300);
        });

        document.getElementById('toTilePixel').addEventListener('click', () => {
            const validation = validateLatLonInputs();

            if (!validation.isValid) {
                const output = document.getElementById('output-area');
                output.textContent = `❌ Ошибка валидации:\n\nПроверьте поля: ${validation.errorFields.join(', ')}\n\nДиапазоны:\n• Latitude: -90...90\n• Longitude: -180...180`;
                output.className = 'error';
                return;
            }

            const btn = document.getElementById('toTilePixel');
            const output = document.getElementById('output-area');

            btn.classList.add('processing');
            output.textContent = 'Обработка...';

            setTimeout(() => {
                const lat = parseFloat(document.getElementById('lat').value);
                const lon = parseFloat(document.getElementById('lon').value);

                if (isNaN(lat) || isNaN(lon)) {
                    output.textContent = '❌ Ошибка: Некорректные координаты\n\nУбедитесь, что введены числовые значения для широты и долготы';
                    output.className = 'error';
                    btn.classList.remove('processing');
                    return;
                }

                const result = projector.latLonToTileAndPixel(lat, lon, fixedZoom);
                const tlX = result.tile[0];
                const tlY = result.tile[1];
                const pxX = result.pixel[0];
                const pxY = result.pixel[1];

                output.textContent = `✅ Успешно конвертировано:\n\nTile X:  ${tlX}\nTile Y:  ${tlY}\nPixel X: ${pxX}\nPixel Y: ${pxY}`;
                output.className = 'success';

                document.getElementById('tile-x').value = tlX;
                document.getElementById('tile-y').value = tlY;
                document.getElementById('pixel-x').value = pxX;
                document.getElementById('pixel-y').value = pxY;

                btn.classList.remove('processing');
            }, 300);
        });

        document.getElementById('copy-btn').addEventListener('click', () => {
            const output = document.getElementById('output-area');
            const originalText = output.textContent;

            const onSuccess = () => {
                output.textContent = '📋 Скопировано в буфер обмена!';
                setTimeout(() => { output.textContent = originalText; }, 1500);
            };
            
            const onFailure = () => {
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = originalText;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    onSuccess();
                } catch (e) {
                    output.textContent = '❌ Не удалось скопировать';
                    output.className = 'error';
                }
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(originalText).then(onSuccess).catch(onFailure);
            } else {
                onFailure();
            }
        });
    }

    function makeDraggable(element) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        let xOffset = parseInt(element.style.left, 10) || 0;
        let yOffset = parseInt(element.style.top, 10) || 0;

        const header = element.querySelector('.converter-header');

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target.closest('.control-btn')) return;

            xOffset = parseInt(element.style.left, 10);
            yOffset = parseInt(element.style.top, 10);
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                element.style.transition = 'none';
            }
        }

        function dragMove(e) {
            if (!isDragging) return;
            e.preventDefault();

            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            const width = element.offsetWidth;
            const content = element.querySelector('.converter-content');
            const height = content && content.style.display === 'none'
                ? element.querySelector('.converter-header').offsetHeight
                : element.offsetHeight;

            const maxX = Math.max(0, window.innerWidth - width);
            const maxY = Math.max(0, window.innerHeight - height);

            currentX = Math.max(0, Math.min(currentX, maxX));
            currentY = Math.max(0, Math.min(currentY, maxY));

            xOffset = currentX;
            yOffset = currentY;
            element.style.left = currentX + 'px';
            element.style.top = currentY + 'px';
        }

        function dragEnd() {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                GM_setValue('windowX', currentX);
                GM_setValue('windowY', currentY);
            }
        }
    }

    console.log(
        '%c🚀 Wplace Coordinate Converter STARTED!',
        'color: #ff69b4; font-weight: bold; font-size: 16px;'
    );
    window.addEventListener('load', createUI);
})();
