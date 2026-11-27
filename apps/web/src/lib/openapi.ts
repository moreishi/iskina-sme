/**
 * OpenAPI 3.1 description of the iskina-sme API.
 * The /docs page renders from this document; /api/openapi serves it raw.
 */

const errorResponse = {
  description: 'Structured error',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
}

const noContent = { description: 'Success' }

const sessionSecurity = [{ sessionCookie: [] }, { mobileBearer: [] }]
const channelSecurity = [{ channelKey: [] }, { platformKey: [] }]

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Iskina SME API',
    version: '0.1.0',
    description:
      'MSME operations core: tenancy, catalog, orders/bookings, themes, analytics and the HATOD channel. Auth is an HttpOnly session cookie (web), a bearer session (Flutter), a business channel key, or the platform channel key.',
  },
  servers: [
    { url: 'http://localhost:3008', description: 'Local development' },
    { url: 'https://sme.iskina.cc', description: 'Production' },
  ],
  tags: [
    { name: 'Health', description: 'Liveness and database readiness' },
    { name: 'Auth', description: 'OTP login and sessions' },
    { name: 'Onboarding', description: 'Create a tenant, business and owner' },
    { name: 'API keys', description: 'Business-scoped channel credentials' },
    { name: 'Catalog', description: 'Categories, items and item photos' },
    { name: 'Merchant', description: 'Order board, devices, analytics and themes' },
    { name: 'Channel', description: 'HATOD storefront discovery, quotes and orders' },
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'iskina_sme_session',
        description: 'Web dashboard session, set after OTP verification.',
      },
      mobileBearer: {
        type: 'http',
        scheme: 'bearer',
        description: 'Session token returned by verify with client=mobile.',
      },
      channelKey: {
        type: 'http',
        scheme: 'bearer',
        description: 'sk_test_/sk_live_ key from the dashboard, scoped per business.',
      },
      platformKey: {
        type: 'http',
        scheme: 'bearer',
        description: 'CHANNEL_PLATFORM_KEY, server-side only. Unlocks discovery.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string', examples: ['invalid_request'] },
              message: { type: 'string' },
              requestId: { type: 'string', format: 'uuid' },
              issues: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      Health: {
        type: 'object',
        properties: {
          service: { type: 'string', const: 'iskina-sme' },
          version: { type: 'string' },
          status: { type: 'string', enum: ['ok', 'degraded'] },
          database: { type: 'string', enum: ['ok', 'error'] },
          uptimeSeconds: { type: 'number' },
          checkedAt: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          phone: { type: 'string', examples: ['+639170000001'] },
          name: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
        },
      },
      Membership: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          tenantName: { type: 'string' },
          tenantSlug: { type: 'string' },
          businessId: { type: ['string', 'null'], format: 'uuid' },
          businessName: { type: ['string', 'null'] },
          businessSlug: { type: ['string', 'null'] },
          vertical: { type: ['string', 'null'], enum: ['food', 'aircon', 'lpg', null] },
          role: { type: 'string', enum: ['owner', 'manager', 'staff'] },
        },
      },
      ThemeTokens: {
        type: 'object',
        required: [
          'primary',
          'onPrimary',
          'accent',
          'onAccent',
          'surface',
          'surfaceMuted',
          'onSurface',
          'outline',
          'success',
          'warning',
          'danger',
          'radius',
          'font',
        ],
        properties: {
          primary: { type: 'string', examples: ['#D40000'] },
          onPrimary: { type: 'string' },
          accent: { type: 'string' },
          onAccent: { type: 'string' },
          surface: { type: 'string' },
          surfaceMuted: { type: 'string' },
          onSurface: { type: 'string' },
          outline: { type: 'string' },
          success: { type: 'string' },
          warning: { type: 'string' },
          danger: { type: 'string' },
          radius: { type: 'string', enum: ['sm', 'md', 'lg', 'full'] },
          font: { type: 'string', enum: ['sans', 'serif', 'rounded'] },
        },
      },
      ThemeManifest: {
        type: 'object',
        properties: {
          version: { type: 'integer', minimum: 1 },
          layout: { type: 'string', enum: ['grid', 'list', 'compact'] },
          tokens: {
            type: 'object',
            properties: {
              light: { $ref: '#/components/schemas/ThemeTokens' },
              dark: { $ref: '#/components/schemas/ThemeTokens' },
            },
          },
          assets: {
            type: 'object',
            properties: {
              logo: { type: ['string', 'null'] },
              banner: { type: ['string', 'null'] },
            },
          },
        },
      },
      CatalogItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          categoryId: { type: ['string', 'null'], format: 'uuid' },
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          priceCentavos: { type: 'integer', minimum: 0 },
          unit: { type: 'string' },
          imageUrl: { type: ['string', 'null'] },
          available: { type: 'boolean' },
          stockCount: { type: ['integer', 'null'] },
          metadata: { type: 'object' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          number: { type: 'string', examples: ['SME-20261127-A1'] },
          status: {
            type: 'string',
            enum: [
              'PLACED',
              'ACCEPTED',
              'PREPARING',
              'READY',
              'OUT_FOR_DELIVERY',
              'DELIVERED',
              'SCHEDULED',
              'IN_PROGRESS',
              'COMPLETED',
              'REJECTED',
              'CANCELLED',
              'EXPIRED',
            ],
          },
          kind: { type: 'string', enum: ['delivery', 'booking'] },
          subtotalCentavos: { type: 'integer' },
          deliveryFeeCentavos: { type: 'integer' },
          totalCentavos: { type: 'integer' },
          contactPhone: { type: 'string' },
          address: { type: ['string', 'null'] },
          scheduledAt: { type: ['string', 'null'], format: 'date-time' },
          cashReceivedAt: { type: ['string', 'null'], format: 'date-time' },
          placedAt: { type: 'string', format: 'date-time' },
        },
      },
      Quote: {
        type: 'object',
        properties: {
          subtotalCentavos: { type: 'integer' },
          deliveryFeeCentavos: { type: 'integer' },
          totalCentavos: { type: 'integer' },
          currency: { type: 'string', const: 'PHP' },
          meetsMinOrder: { type: 'boolean' },
          distanceKm: { type: 'number' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemId: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                unitPriceCentavos: { type: 'integer' },
                quantity: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Service and database health',
        security: [],
        responses: {
          200: {
            description: 'Healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } },
          },
          503: { description: 'Database unreachable' },
        },
      },
    },
    '/api/v1/auth/otp': {
      post: {
        tags: ['Auth'],
        summary: 'Request a phone OTP',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone'],
                properties: { phone: { type: 'string', examples: ['09171234567'] } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Challenge created. devCode only appears outside production.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    challengeId: { type: 'string', format: 'uuid' },
                    expiresAt: { type: 'string', format: 'date-time' },
                    channel: { type: 'string' },
                    devCode: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
          400: errorResponse,
          429: errorResponse,
          503: errorResponse,
        },
      },
    },
    '/api/v1/auth/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Verify the OTP and create a session',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['challengeId', 'code'],
                properties: {
                  challengeId: { type: 'string', format: 'uuid' },
                  code: { type: 'string', pattern: '^\\d{6}$' },
                  client: { type: 'string', enum: ['mobile'] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              'User and memberships. Web sets the session cookie; client=mobile also returns sessionToken.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    memberships: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Membership' },
                    },
                    needsOnboarding: { type: 'boolean' },
                    sessionToken: { type: 'string', description: 'Mobile clients only' },
                  },
                },
              },
            },
          },
          401: errorResponse,
          409: errorResponse,
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the current session',
        security: sessionSecurity,
        responses: { 200: noContent },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user and memberships',
        security: sessionSecurity,
        responses: {
          200: {
            description: 'Session context',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    memberships: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Membership' },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse,
        },
      },
    },
    '/api/v1/onboarding': {
      post: {
        tags: ['Onboarding'],
        summary: 'Create a tenant, business and owner membership',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessName', 'vertical'],
                properties: {
                  businessName: { type: 'string', maxLength: 80 },
                  slug: { type: 'string', maxLength: 40 },
                  vertical: { type: 'string', enum: ['food', 'aircon', 'lpg'] },
                  timezone: { type: 'string', examples: ['Asia/Manila'] },
                },
              },
            },
          },
        },
        responses: { 201: noContent, 400: errorResponse, 409: errorResponse },
      },
    },
    '/api/v1/api-keys': {
      get: {
        tags: ['API keys'],
        summary: 'List channel keys for a business',
        security: sessionSecurity,
        parameters: [{ name: 'tenantId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: noContent, 403: errorResponse },
      },
      post: {
        tags: ['API keys'],
        summary: 'Create a channel key (plaintext returned once)',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  tenantId: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  env: { type: 'string', enum: ['test', 'live'] },
                  scopes: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: noContent, 403: errorResponse },
      },
    },
    '/api/v1/api-keys/{id}/revoke': {
      post: {
        tags: ['API keys'],
        summary: 'Revoke a channel key',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: noContent, 404: errorResponse },
      },
    },
    '/api/v1/catalog': {
      get: {
        tags: ['Catalog'],
        summary: 'Read a business catalog with its vertical config',
        security: sessionSecurity,
        parameters: [
          {
            name: 'businessId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { 200: noContent, 403: errorResponse },
      },
    },
    '/api/v1/catalog/categories': {
      post: {
        tags: ['Catalog'],
        summary: 'Create a category',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessId', 'name'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  sortOrder: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 201: noContent, 409: errorResponse },
      },
    },
    '/api/v1/catalog/categories/{id}': {
      patch: {
        tags: ['Catalog'],
        summary: 'Rename or reorder a category',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: noContent, 404: errorResponse },
      },
      delete: {
        tags: ['Catalog'],
        summary: 'Delete a category (items become uncategorized)',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            name: 'businessId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { 200: noContent, 404: errorResponse },
      },
    },
    '/api/v1/catalog/items': {
      post: {
        tags: ['Catalog'],
        summary: 'Create an item',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessId', 'name', 'priceCentavos'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  categoryId: { type: ['string', 'null'], format: 'uuid' },
                  name: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  priceCentavos: { type: 'integer', minimum: 0 },
                  unit: { type: 'string' },
                  available: { type: 'boolean' },
                  stockCount: { type: ['integer', 'null'] },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { 201: noContent, 400: errorResponse },
      },
    },
    '/api/v1/catalog/items/{id}': {
      patch: {
        tags: ['Catalog'],
        summary: 'Update an item',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: noContent, 404: errorResponse },
      },
      delete: {
        tags: ['Catalog'],
        summary: 'Delete an item',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            name: 'businessId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { 200: noContent, 404: errorResponse },
      },
    },
    '/api/v1/catalog/items/{id}/image': {
      post: {
        tags: ['Catalog'],
        summary: 'Upload or replace an item photo',
        description:
          'Multipart: businessId + file. JPEG/PNG/WebP only, max 5 MB. The server strips EXIF, bounds the long edge to 1600px and stores WebP.',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['businessId', 'file'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: { 201: noContent, 400: errorResponse, 413: errorResponse, 503: errorResponse },
      },
      delete: {
        tags: ['Catalog'],
        summary: 'Remove an item photo',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            name: 'businessId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { 200: noContent, 404: errorResponse },
      },
    },
    '/api/v1/merchant/orders': {
      get: {
        tags: ['Merchant'],
        summary: 'Order board',
        security: sessionSecurity,
        parameters: [
          {
            name: 'businessId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', examples: ['PLACED,ACCEPTED'] },
          },
        ],
        responses: { 200: noContent, 403: errorResponse },
      },
    },
    '/api/v1/merchant/orders/{id}/transition': {
      post: {
        tags: ['Merchant'],
        summary: 'Move an order through the state machine',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessId', 'to'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  to: { type: 'string', examples: ['ACCEPTED'] },
                  note: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        responses: { 200: noContent, 409: errorResponse },
      },
    },
    '/api/v1/merchant/orders/{id}/cash-received': {
      post: {
        tags: ['Merchant'],
        summary: 'Confirm cash for a delivered/completed order',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: noContent, 409: errorResponse },
      },
    },
    '/api/v1/merchant/events': {
      get: {
        tags: ['Merchant'],
        summary: 'SSE stream of order changes',
        description:
          'Emits an `orders` event when the newest order updatedAt changes. Cookie or bearer session.',
        security: sessionSecurity,
        parameters: [
          {
            name: 'businessId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { 200: { description: 'text/event-stream' }, 403: errorResponse },
      },
    },
    '/api/v1/merchant/devices': {
      post: {
        tags: ['Merchant'],
        summary: 'Register a push device token',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessId', 'platform', 'token'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  platform: { type: 'string', enum: ['android', 'ios', 'web'] },
                  token: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: noContent, 403: errorResponse },
      },
    },
    '/api/v1/merchant/analytics': {
      get: {
        tags: ['Merchant'],
        summary: 'Sales and ops analytics',
        security: sessionSecurity,
        parameters: [
          {
            name: 'businessId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'days',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 365, default: 7 },
          },
        ],
        responses: { 200: noContent, 403: errorResponse },
      },
    },
    '/api/v1/merchant/theme': {
      get: {
        tags: ['Merchant'],
        summary: 'Current published theme and presets',
        security: sessionSecurity,
        parameters: [
          {
            name: 'businessId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { 200: noContent },
      },
    },
    '/api/v1/merchant/theme/publish': {
      post: {
        tags: ['Merchant'],
        summary: 'Publish the next immutable theme version',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessId'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  presetId: { type: 'string', examples: ['ferrari'] },
                  layout: { type: 'string', enum: ['grid', 'list', 'compact'] },
                  light: { type: 'object', additionalProperties: { type: 'string' } },
                  dark: { type: 'object', additionalProperties: { type: 'string' } },
                  assets: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { 201: noContent, 400: errorResponse },
      },
    },
    '/api/v1/channel/storefronts': {
      get: {
        tags: ['Channel'],
        summary: 'List active storefronts',
        security: [{ platformKey: [] }],
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }],
        responses: { 200: noContent, 401: errorResponse, 403: errorResponse },
      },
    },
    '/api/v1/channel/storefronts/{slug}': {
      get: {
        tags: ['Channel'],
        summary: 'Storefront detail: config, theme and available catalog',
        security: [{ platformKey: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: noContent, 404: errorResponse },
      },
    },
    '/api/v1/channel/theme': {
      get: {
        tags: ['Channel'],
        summary: 'Published theme or the default preset',
        security: channelSecurity,
        parameters: [
          { name: 'businessId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: noContent, 401: errorResponse },
      },
    },
    '/api/v1/channel/quotes': {
      post: {
        tags: ['Channel'],
        summary: 'Server-side cart price',
        security: channelSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['itemId', 'quantity'],
                      properties: {
                        itemId: { type: 'string', format: 'uuid' },
                        quantity: { type: 'integer', minimum: 1, maximum: 99 },
                      },
                    },
                  },
                  delivery: {
                    type: 'object',
                    properties: {
                      address: { type: 'string' },
                      lat: { type: 'number' },
                      lng: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Quote',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Quote' } } },
          },
          400: errorResponse,
        },
      },
    },
    '/api/v1/channel/orders': {
      post: {
        tags: ['Channel'],
        summary: 'Place an order or booking',
        security: channelSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items', 'customer'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  customer: {
                    type: 'object',
                    required: ['phone'],
                    properties: {
                      name: { type: ['string', 'null'] },
                      phone: { type: 'string' },
                      hatodUserId: { type: ['string', 'null'] },
                    },
                  },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        itemId: { type: 'string', format: 'uuid' },
                        quantity: { type: 'integer' },
                      },
                    },
                  },
                  delivery: { type: 'object' },
                  scheduledAt: { type: 'string', format: 'date-time' },
                  intake: { type: 'object' },
                  notes: { type: ['string', 'null'] },
                  idempotencyKey: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { order: { $ref: '#/components/schemas/Order' } },
                },
              },
            },
          },
          200: { description: 'Idempotent replay of an existing order' },
          400: errorResponse,
          409: errorResponse,
        },
      },
    },
    '/api/v1/channel/orders/{id}': {
      get: {
        tags: ['Channel'],
        summary: 'Order status and event timeline',
        security: channelSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'businessId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Order',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    order: { $ref: '#/components/schemas/Order' },
                    lines: { type: 'array', items: { type: 'object' } },
                    events: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          404: errorResponse,
        },
      },
    },
    '/api/v1/channel/orders/{id}/cancel': {
      post: {
        tags: ['Channel'],
        summary: 'Customer cancellation while the state machine allows it',
        security: channelSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: noContent, 404: errorResponse, 409: errorResponse },
      },
    },
  },
} as const

export type OpenApiDocument = typeof openApiDocument
