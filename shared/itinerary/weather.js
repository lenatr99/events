const weatherLabels = [
  { codes: [0], text: "Clear", kind: "is-clear", icon: "☀️" },
  { codes: [1, 2], text: "Partly cloudy", kind: "is-cloud", icon: "⛅" },
  { codes: [3, 45, 48], text: "Cloudy", kind: "is-cloud", icon: "☁️" },
  { codes: [51, 53, 55, 56, 57], text: "Drizzle", kind: "is-rain", icon: "🌦" },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], text: "Showers", kind: "is-rain", icon: "🌧" },
  { codes: [71, 73, 75, 77, 85, 86], text: "Snow/sleet", kind: "is-rain", icon: "🌨" },
  { codes: [95, 96, 99], text: "Storms", kind: "is-storm", icon: "⛈" }
];

function weatherInfo(code) {
  return weatherLabels.find((group) => group.codes.includes(code)) || { text: "Forecast", kind: "is-cloud", icon: "☁️" };
}

function hourLabel(value) {
  return value.slice(11, 16);
}

function hourlyStrip(hourly) {
  if (!hourly || !hourly.time) return "";
  return hourly.time.map((time, index) => {
    const info = weatherInfo(hourly.weather_code[index]);
    const temp = Math.round(hourly.temperature_2m[index]);
    const rain = hourly.precipitation_probability?.[index];
    const rainText = rain == null ? "" : `<span class="hour-rain">${rain}%</span>`;
    return `<span class="weather-hour"><span>${hourLabel(time)}</span><span class="hour-icon" aria-hidden="true">${info.icon}</span><span class="hour-temp">${temp}°</span>${rainText}</span>`;
  }).join("");
}

function renderPopup(card, { place, info, high, low, rain, hourly }) {
  const rainLine = rain == null ? "" : `<div class="weather-popup-rain">${rain}% chance of rain</div>`;
  const hours = hourly ? hourlyStrip(hourly) : "";
  const hoursBlock = hours
    ? `<div class="weather-popup-hours-label">Hourly</div><div class="weather-more">${hours}</div>`
    : "";
  return `
    <div class="weather-popup-header">
      <span class="weather-popup-icon" aria-hidden="true">${info.icon}</span>
      <div>
        <div class="weather-popup-place">${place}</div>
        <div class="weather-popup-condition">${info.text}</div>
      </div>
      <div class="weather-popup-temps">
        <span class="weather-popup-high">${high}°</span><span class="weather-popup-low">${low}°</span>
      </div>
    </div>
    ${rainLine}
    ${hoursBlock}
    <div class="weather-popup-foot">via Open-Meteo</div>
  `;
}

function renderFallback(card) {
  const popup = card.querySelector(".weather-popup");
  if (!popup) return;
  const place = card.dataset.weatherPlace;
  const icon = card.dataset.weatherIcon || "☁️";
  const copy = card.querySelector(".weather-copy")?.textContent || "";
  popup.innerHTML = `
    <div class="weather-popup-header">
      <span class="weather-popup-icon" aria-hidden="true">${icon}</span>
      <div>
        <div class="weather-popup-place">${place}</div>
        <div class="weather-popup-condition">${copy}</div>
      </div>
    </div>
    <div class="weather-popup-foot">Connect to refresh forecast</div>
  `;
}

async function updateWeather(card) {
  const params = new URLSearchParams({
    latitude: card.dataset.weatherLat,
    longitude: card.dataset.weatherLon,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    hourly: "weather_code,temperature_2m,precipitation_probability",
    temperature_unit: "celsius",
    timezone: card.dataset.weatherTimezone || "auto",
    start_date: card.dataset.weatherDate,
    end_date: card.dataset.weatherDate
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) { renderFallback(card); return; }
  const data = await response.json();
  const daily = data.daily;
  if (!daily || !daily.time || !daily.time.length) { renderFallback(card); return; }

  const info = weatherInfo(daily.weather_code[0]);
  const high = Math.round(daily.temperature_2m_max[0]);
  const low = Math.round(daily.temperature_2m_min[0]);
  const rain = daily.precipitation_probability_max?.[0];
  const place = card.dataset.weatherPlace;

  const iconEl = card.querySelector(".weather-icon");
  const copyEl = card.querySelector(".weather-copy");
  const popupEl = card.querySelector(".weather-popup");

  if (iconEl) iconEl.textContent = info.icon;
  if (copyEl) copyEl.textContent = `${place} · ${info.text} · ${high}° / ${low}°`;
  card.dataset.weatherIcon = info.icon;
  card.dataset.weatherKind = info.kind;
  if (popupEl) popupEl.innerHTML = renderPopup(card, { place, info, high, low, rain, hourly: data.hourly });
}

document.querySelectorAll(".weather[data-weather-date]").forEach((card) => {
  renderFallback(card);
  updateWeather(card).catch(() => renderFallback(card));
});

document.addEventListener("click", (event) => {
  document.querySelectorAll(".weather[open]").forEach((card) => {
    if (!card.contains(event.target)) card.open = false;
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".weather[open]").forEach((card) => { card.open = false; });
});
