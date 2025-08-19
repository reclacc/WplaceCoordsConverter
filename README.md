# Wplace.live Coordinate Converter
<p align="center">
    <img src="https://github.com/reclacc/WplaceCoordsConverter/blob/master/icon%2Bname.png"
        height="130">
</p>
<p align="center">
    <a href="https://choosealicense.com/licenses/mit/" alt="License: MIT">
        <img src="https://img.shields.io/badge/License-MIT-green" /></a>
    <a href="https://developer.mozilla.org/ru/docs/Web/JavaScript" alt="Language: JavaScript">
        <img src="https://img.shields.io/badge/JavaScript-ES6+-yellow?logo=javascript&logoColor=white" /></a>
    <a href="https://www.tampermonkey.net/" alt="Tampermonkey">
        <img src="https://img.shields.io/badge/Platform-Tampermonkey-orange?logo=tampermonkey&logoColor=white" /></a>
    <a href="https://wplace.live/" alt="Wplace">
        <img src="https://img.shields.io/badge/Wplace-green?logo=webtrees&logoColor=white&style=flat" /></a>
</p>
Пользовательский скрипт для конвертации координат на wplace.live между системами:
- Координаты плитки/пикселя (Tile/Pixel)
- Географические координаты (Latitude/Longitude)

## Установка

1. Установи [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Safari)
2. Тыкни [сюда](https://raw.githubusercontent.com/reclacc/WplaceCoordsConverter/master/WplaceCoordsConverter.user.js), Tampermonkey должен определить пользовательский скрипт
3. Если не определилось, ручками закинь туда содержимое файла [WplaceCoordsConverter.user.js](https://raw.githubusercontent.com/reclacc/WplaceCoordsConverter/master/WplaceCoordsConverter.user.js) и включи появившийся в списке скрипт
4. Обнови страницу wplace.live
5. PROFIT

### Конвертация из плитки/пикселя в географические координаты
1. Введи значения:
   - **TlX**: X-координата плитки
   - **TlY**: Y-координата плитки
   - **PxX**: X-координата пикселя внутри плитки
   - **PxY**: Y-координата пикселя внутри плитки
2. Нажми кнопку **T/P → Lat/Lon**
3. Результат появится в поле вывода и автоматически заполнит поля Lat/Lon

### Конвертация из географических координат в плитку/пиксель
1. Введи значения:
   - **Lat**: Широта (например, 55.7558)
   - **Lon**: Долгота (например, 37.6173)
2. Нажми кнопку **Lat/Lon → T/P**
3. Результат появится в поле вывода и автоматически заполнит поля с координатами плитки/пикселя
