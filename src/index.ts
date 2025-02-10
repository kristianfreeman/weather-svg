import {
  cloudy,
  rainy,
  snowy,
  stormy,
  sun
} from './icons';

import { DateTime } from 'luxon';

type Env = {
  OPENWEATHER_API_KEY: string;
  WEATHER_CACHE: KVNamespace;
};

interface WeatherCondition {
  text: string;
  code: number;
}

interface DayForecast {
  date: string;
  day: {
    maxtemp_f: number;
    mintemp_f: number;
    condition: WeatherCondition;
  };
}

interface Forecast {
  zipCode: string;
  location: {
    name: string;
    region: string;
  };
  forecast: DayForecast[];
}

const CONFIG = {
  ZIP_CODES: [
    '78666',
  ],
  DEFAULT_DIMENSIONS: {
    width: 800,
    height: 200
  }
};

type IconType = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow';

const WEATHER_ICONS: Record<IconType, string> = {
  'sunny': sun,
  'cloudy': cloudy,
  'rain': rainy,
  'storm': stormy,
  'snow': snowy
};

function getIconForCondition(code: number): IconType {
  // Clear sky
  if ([800].includes(code)) return 'sunny';
  // Clouds
  if ([801, 802, 803, 804].includes(code)) return 'cloudy';
  // Rain and drizzle
  if ([300, 301, 302, 310, 311, 312, 313, 314, 321, 500, 501, 502, 503, 504, 511, 520, 521, 522, 531].includes(code)) return 'rain';
  // Thunderstorm
  if ([200, 201, 202, 210, 211, 212, 221, 230, 231, 232].includes(code)) return 'storm';
  // Snow
  if ([600, 601, 602, 611, 612, 613, 615, 616, 620, 621, 622].includes(code)) return 'snow';

  return 'cloudy';
}

function getNextNewsletterDate(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7));
  return d.toISOString().split('T')[0];
}

function generateCacheKey(zipCode: string, newsletterDate: string, vKey?: string) {
  return `forecast-${zipCode}-${newsletterDate}-${vKey || ''}`;
}

async function fetchDailySummaries(zipCode: string, startDate: string, days: number, env: Env): Promise<Forecast> {
  const coordUrl = `http://api.openweathermap.org/geo/1.0/zip?zip=${zipCode},US&appid=${env.OPENWEATHER_API_KEY}`;
  const coordResponse = await fetch(coordUrl);
  if (!coordResponse.ok) {
    throw new Error('Geocoding API request failed: ' + await coordResponse.text());
  }
  const coordData = await coordResponse.json();

  // Helper to determine weather condition based on cloud cover and precipitation
  const getWeatherCode = (cloudCover: number, precipitation: number) => {
    if (precipitation > 30) return 500; // Rain
    if (precipitation > 0) return 300;  // Light rain/drizzle
    if (cloudCover > 80) return 804;    // Overcast
    if (cloudCover > 50) return 802;    // Scattered clouds
    if (cloudCover > 20) return 801;    // Few clouds
    return 800;                         // Clear sky
  };

  const getWeatherDescription = (cloudCover: number, precipitation: number) => {
    if (precipitation > 30) return "Rain";
    if (precipitation > 0) return "Light rain";
    if (cloudCover > 80) return "Overcast";
    if (cloudCover > 50) return "Partly cloudy";
    if (cloudCover > 20) return "Few clouds";
    return "Clear sky";
  };

  const dailyPromises = Array.from({ length: days }, async (_, i) => {
    const date = DateTime.fromISO(startDate).plus({ days: i }).toISODate();
    const url = `https://api.openweathermap.org/data/3.0/onecall/day_summary?lat=${coordData.lat}&lon=${coordData.lon}&date=${date}&appid=${env.OPENWEATHER_API_KEY}&units=imperial`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API request failed for ${date}: ${await response.text()}`);
    }
    return response.json();
  });

  const dailyData = await Promise.all(dailyPromises);

  return {
    zipCode,
    location: {
      name: coordData.name,
      region: coordData.state || '',
    },
    forecast: dailyData.map(day => {
      const weatherCode = getWeatherCode(day.cloud_cover.afternoon, day.precipitation.total);
      const weatherDesc = getWeatherDescription(day.cloud_cover.afternoon, day.precipitation.total);

      return {
        date: day.date,
        day: {
          maxtemp_f: day.temperature.max,
          mintemp_f: day.temperature.min,
          condition: {
            text: weatherDesc,
            code: weatherCode
          }
        }
      };
    })
  };
}

function generateForecastSVG(forecast: Forecast, width: number = 700, height: number = 150): string {
  const dayWidth = width / 7;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="blur">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
    </filter>
    <style>
      .weather-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .day { font-size: 18px; fill: #000; font-weight: bold; }
      .temp { font-size: 16px; fill: #000; }
      .description { font-size: 14px; fill: #000; text-transform: capitalize; }
      .am-weather-sun { animation: rotate 9s linear infinite; }
      @keyframes rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  </defs>
  ${forecast.forecast.map((day, i) => {
    const x = (i * dayWidth) + (dayWidth / 2);
    const date = DateTime.fromISO(day.date).toJSDate();
    const dayName = days[date.getDay()];
    const icon = WEATHER_ICONS[getIconForCondition(day.day.condition.code)];
    return `
  <!-- Day ${i + 1} -->
  <g transform="translate(${x - 50}, 20)">
    <text x="50" y="0" text-anchor="middle" class="weather-text day">
      ${dayName} ${date.getDate()}
    </text>
    <!-- Weather Icon -->
    <g transform="translate(10, 0) scale(1.25)">
      ${icon}
    </g>
    <text x="50" y="100" text-anchor="middle" class="weather-text temp">
      ${Math.round(day.day.maxtemp_f)}° / ${Math.round(day.day.mintemp_f)}°
    </text>
    <text x="50" y="120" text-anchor="middle" class="weather-text description">
      ${day.day.condition.text}
    </text>
  </g>`;
  }).join('')}
</svg>`;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const today = new Date();
    const nextNewsletterDate = getNextNewsletterDate(today);

    for (const zipCode of CONFIG.ZIP_CODES) {
      try {
        const forecast = await fetchDailySummaries(zipCode, nextNewsletterDate, 7, env);
        const svg = generateForecastSVG(
          forecast,
          CONFIG.DEFAULT_DIMENSIONS.width,
          CONFIG.DEFAULT_DIMENSIONS.height
        );

        await env.WEATHER_CACHE.put(
          generateCacheKey(zipCode, nextNewsletterDate),
          JSON.stringify({
            svg,
            forecast,
            generatedAt: Date.now()
          }),
          { expirationTtl: 3600 } // 1 hour cache
        );
      } catch (error) {
        console.error(`Failed to generate forecast for ${zipCode}:`, error);
      }
    }
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);
    const zipCode = url.searchParams.get('zip') || '';
    const issueDate = url.searchParams.get('issue') || new Date().toISOString().split('T')[0];
    const width = parseInt(url.searchParams.get('width') ?? String(CONFIG.DEFAULT_DIMENSIONS.width));
    const height = parseInt(url.searchParams.get('height') ?? String(CONFIG.DEFAULT_DIMENSIONS.height));
    const vKey = url.searchParams.get('v');

    //if (!zipCode) return new Response('Missing zip code', { status: 400 });
    if (!zipCode) {
      throw new Error('Missing zip code');
    }

    const cacheKey = generateCacheKey(zipCode, issueDate, vKey);
    const cachedData = await env.WEATHER_CACHE.get(cacheKey, 'json') as any;

    if (cachedData) {
      let svg = cachedData.svg;
      if (width !== CONFIG.DEFAULT_DIMENSIONS.width || height !== CONFIG.DEFAULT_DIMENSIONS.height) {
        svg = generateForecastSVG(cachedData.forecast, width, height);
      }
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=31536000',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    try {
      const forecast = await fetchDailySummaries(zipCode, issueDate, 7, env);
      const svg = generateForecastSVG(forecast, width, height);

      await env.WEATHER_CACHE.put(
        cacheKey,
        JSON.stringify({
          svg,
          forecast,
          generatedAt: Date.now()
        }),
        { expirationTtl: 3600 }
      );

      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=31536000',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error: any) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
};
