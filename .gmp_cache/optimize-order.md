# Optimize the Order of Stops on Your Route

## Overview

The Routes API `computeRoutes` method typically calculates a route through
intermediate waypoints in the exact order they are specified in the
`intermediates` array. By enabling the `optimizeWaypointOrder` option, the API
solves the Traveling Salesperson Problem (TSP) to rearrange the intermediate
stops into the most efficient order, minimizing overall travel time and distance
while keeping the `origin` and `destination` fixed.

## Prerequisites

*   An active Google Cloud project with the **Routes API** enabled.
*   A valid API key with permissions to call the Routes API.
*   At least one routing request capability configured (such as a basic
    `computeRoutes` setup).

## Implementation Steps

### 1. Define Origin, Destination, and Intermediate Waypoints

Set up your `origin` and `destination` locations, and include an `intermediates`
array containing at least two intermediate waypoints to optimize.

### 2. Enable Waypoint Optimization

Set the boolean property `"optimizeWaypointOrder": true` at the top level of the
JSON request body.

### 3. Configure the Response Field Mask

When `optimizeWaypointOrder` is set to `true`, you **must** include
`routes.optimizedIntermediateWaypointIndex` in the `X-Goog-FieldMask` header.
This field returns an array of 0-based indices indicating the new optimal order
of your original `intermediates` array. If you omit this field from the mask
while `optimizeWaypointOrder` is `true`, the API returns an error.

### 4. Include Usage Attribution Header

Include the required `X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1` header in
your REST call.

## Code Examples

### cURL Request

The following example requests an optimized route starting and ending in
Adelaide, South Australia, while rearranging four intermediate stops across the
Barossa Valley and surrounding areas.

```bash
curl -X POST -H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: YOUR_API_KEY' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
-H 'X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.optimizedIntermediateWaypointIndex,routes.legs' \
-d '{
  "origin": {
    "address": "Adelaide, SA"
  },
  "destination": {
    "address": "Adelaide, SA"
  },
  "intermediates": [
    {"address": "Barossa Valley, SA"},
    {"address": "Clare, SA"},
    {"address": "Connawarra, SA"},
    {"address": "McLaren Vale, SA"}
  ],
  "travelMode": "DRIVE",
  "optimizeWaypointOrder": true
}' \
'https://routes.googleapis.com/directions/v2:computeRoutes'
```

### Node.js (`fetch`) Example

```javascript
async function computeOptimizedRoute() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  const requestBody = {
    origin: {
      location: {
        latLng: { latitude: 37.419734, longitude: -122.0827784 } // Mountain View
      }
    },
    destination: {
      location: {
        latLng: { latitude: 37.774929, longitude: -122.419416 } // San Francisco
      }
    },
    intermediates: [
      {
        location: {
          latLng: { latitude: 37.338208, longitude: -121.886329 } // Index 0: San Jose
        }
      },
      {
        location: {
          latLng: { latitude: 37.441883, longitude: -122.143019 } // Index 1: Palo Alto
        }
      },
      {
        location: {
          latLng: { latitude: 37.562992, longitude: -122.325525 } // Index 2: San Mateo
        }
      }
    ],
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    optimizeWaypointOrder: true
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.optimizedIntermediateWaypointIndex'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Routes API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const route = data.routes[0];

  console.log('Total Distance (meters):', route.distanceMeters);
  console.log('Total Duration:', route.duration);
  console.log('Optimized Intermediate Waypoint Order:', route.optimizedIntermediateWaypointIndex);
}

computeOptimizedRoute().catch(console.error);
```

### Example Response

In the response, `optimizedIntermediateWaypointIndex` displays the optimal
traversal order using the original 0-based indices of the `intermediates` array
in the request. Note that the `legs` returned in the response are already
ordered according to this optimized sequence.

```json
{
  "routes": [
    {
      "distanceMeters": 119522,
      "duration": "5420s",
      "optimizedIntermediateWaypointIndex": [
        0,
        1,
        2
      ]
    }
  ]
}
```

If the original intermediate stops were `[Stop A (0), Stop B (1), Stop C (2),
Stop D (3)]` and the API returns:

```json
"optimizedIntermediateWaypointIndex": [3, 2, 0, 1]
```

The optimal visiting order is:

1.  `origin`
2.  Stop D (index 3)
3.  Stop C (index 2)
4.  Stop A (index 0)
5.  Stop B (index 1)
6.  `destination`

## Constraints & Limitations

When setting `"optimizeWaypointOrder": true`, your request must adhere to the
following rules or the API will return an error:

*   **Required Field Mask**: You must include
    `routes.optimizedIntermediateWaypointIndex` in the `X-Goog-FieldMask`
    header.
*   **Waypoint Count Limits**:
    *   You can specify up to **25** intermediate waypoints by default.
    *   If ANY intermediate waypoint is specified using a **Place ID** or
        **address** string, you can include up to **25** intermediate waypoints.
    *   If you specify `routingPreference: "TRAFFIC_AWARE_OPTIMAL"`, the limit
        is reduced to **15** intermediate waypoints.
*   **No Pass-Through Waypoints**: None of the intermediate waypoints can have
    `"via": true` (pass-through waypoints). All intermediate waypoints must be
    actual stops (`"via": false` or omitted).
*   **Supported Travel Modes**: `travelMode` must be `DRIVE`, `TWO_WHEELER`,
    `BICYCLE`, or `WALK`. `TRANSIT` does not support waypoint optimization.

## Billing Note

Enabling `optimizeWaypointOrder: true` increases the computational complexity of
the request and bills the request at a higher SKU tier (**Compute Routes:
Advanced** or **Compute Routes: Enterprise**, depending on other features used).
Refer to the
[Routes API Usage and Billing documentation](https://developers.google.com/maps/documentation/routes/usage-and-billing)
for exact pricing details.
