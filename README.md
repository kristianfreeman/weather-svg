# OpenWeather Forecast Worker

A Cloudflare Worker that generates SVG weather forecasts using OpenWeatherMap's API. The worker caches forecast data in KV storage and supports customizable dimensions for the generated SVG.

## Features

- 7-day weather forecast visualization
- Custom SVG weather icons with animations
- Timezone-aware date handling (America/Chicago)
- Configurable dimensions
- Hourly caching using Cloudflare KV
- Scheduled updates every 6 hours

## Configuration

### Environment Variables

Required configuration in your `wrangler.json`:

```json
{
  "name": "weather-forecast",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-25",
  "vars": {
    "OPENWEATHER_API_KEY": "your-api-key"
  },
  "kv_namespaces": [
    {
      "binding": "WEATHER_CACHE",
      "id": "your-kv-namespace-id"
    }
  ],
  "triggers": {
    "crons": ["0 */6 * * *"]
  }
}
```

### Configuration Options

Update the `CONFIG` object in the code to customize:

```typescript
const CONFIG = {
  ZIP_CODES: [
    '78666',  // Add your zip codes here
  ],
  DEFAULT_DIMENSIONS: {
    width: 800,
    height: 200
  }
};
```

## API Usage

### Fetch a Forecast

```
GET /forecast?zip=78666&issue=2025-01-25
```

Query Parameters:
- `zip` (required): US ZIP code
- `issue` (optional): Date for the forecast (defaults to current date)
- `width` (optional): SVG width in pixels
- `height` (optional): SVG height in pixels
- `v` (optional): Version key for cache busting

### Response

Returns an SVG image with:
- Daily temperature highs and lows
- Weather condition icons
- Weather descriptions
- Week days and dates

## Weather Condition Logic

Weather conditions are determined using afternoon cloud cover and total precipitation:

- Rain: Precipitation > 30%
- Light rain: Precipitation > 0%
- Overcast: Cloud cover > 80%
- Partly cloudy: Cloud cover > 50%
- Few clouds: Cloud cover > 20%
- Clear sky: Default

## Caching

- Forecasts are cached for 1 hour in KV storage
- Cache keys include ZIP code, issue date, and optional version key
- Scheduled task runs every 6 hours to update cached forecasts
- Browser caching is set to 1 year for static assets

## Development

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
echo 'OPENWEATHER_API_KEY="your-api-key"' > .dev.vars
```

3. Create KV namespace:
```bash
wrangler kv:namespace create WEATHER_CACHE
```

4. Deploy:
```bash
wrangler deploy
```

## Testing Locally

Run the worker locally with:
```bash
wrangler dev
```

Test the scheduled task:
```bash
wrangler dev --test-scheduled
```
