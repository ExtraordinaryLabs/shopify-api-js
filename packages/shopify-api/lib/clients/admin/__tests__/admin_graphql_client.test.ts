import * as ShopifyErrors from '../../../error';
import {
  ApiVersion,
  LATEST_API_VERSION,
  LogSeverity,
  ShopifyHeader,
} from '../../../types';
import {queueMockResponse} from '../../../__tests__/test-helper';
import {testConfig} from '../../../__tests__/test-config';
import {Session} from '../../../session/session';
import {JwtPayload} from '../../../session/types';
import {DataType, shopifyApi} from '../../..';

const domain = 'test-shop.myshopify.io';
const QUERY = `
{
  shop {
    name
  }
}
`;

const successResponse = {
  data: {
    shop: {
      name: 'Shoppity Shop',
    },
  },
};

const accessToken = 'dangit';
let session: Session;
let jwtPayload: JwtPayload;

describe('GraphQL client', () => {
  beforeEach(() => {
    jwtPayload = {
      iss: 'https://test-shop.myshopify.io/admin',
      dest: 'https://test-shop.myshopify.io',
      aud: 'test_key',
      sub: '1',
      exp: Date.now() / 1000 + 3600,
      nbf: 1234,
      iat: 1234,
      jti: '4321',
      sid: 'abc123',
    };

    session = new Session({
      id: `test-shop.myshopify.io_${jwtPayload.sub}`,
      shop: domain,
      state: 'state',
      isOnline: true,
      accessToken,
    });
  });

  it('can return response', async () => {
    const shopify = shopifyApi(testConfig());

    const client = new shopify.clients.Graphql({session});
    queueMockResponse(JSON.stringify(successResponse));

    const response = await client.query(QUERY);

    expect(response).toEqual(buildExpectedResponse(successResponse));
    expect({
      method: 'POST',
      domain,
      path: `/admin/api/${shopify.config.apiVersion}/graphql.json`,
      data: {query: QUERY},
    }).toMatchMadeHttpRequest();
  });

  it('merges custom headers with default', async () => {
    const shopify = shopifyApi(testConfig());

    const client = new shopify.clients.Graphql({session});
    const customHeader: {[key: string]: string} = {
      'X-Glib-Glob': 'goobers',
    };

    queueMockResponse(JSON.stringify(successResponse));

    await expect(
      client.query(QUERY, {extraHeaders: customHeader}),
    ).resolves.toEqual(buildExpectedResponse(successResponse));

    customHeader[ShopifyHeader.AccessToken] = accessToken;
    expect({
      method: 'POST',
      domain,
      path: `/admin/api/${shopify.config.apiVersion}/graphql.json`,
      headers: customHeader,
      data: {query: QUERY},
    }).toMatchMadeHttpRequest();
  });

  it('adapts to private app requests', async () => {
    const shopify = shopifyApi(
      testConfig({
        isCustomStoreApp: true,
        adminApiAccessToken: 'dangit-another-access-token',
      }),
    );

    const client = new shopify.clients.Graphql({session});
    queueMockResponse(JSON.stringify(successResponse));

    await expect(client.query(QUERY)).resolves.toEqual(
      buildExpectedResponse(successResponse),
    );

    const customHeaders: {[key: string]: string} = {};
    customHeaders[ShopifyHeader.AccessToken] =
      shopify.config.adminApiAccessToken;

    expect({
      method: 'POST',
      domain,
      path: `/admin/api/${shopify.config.apiVersion}/graphql.json`,
      data: {query: QUERY},
      headers: customHeaders,
    }).toMatchMadeHttpRequest();
  });

  it('fails to instantiate without access token', () => {
    const shopify = shopifyApi(testConfig());

    const sessionWithoutAccessToken = new Session({
      id: `test-shop.myshopify.io_${jwtPayload.sub}`,
      shop: domain,
      state: 'state',
      isOnline: true,
    });

    expect(
      () => new shopify.clients.Graphql({session: sessionWithoutAccessToken}),
    ).toThrow(ShopifyErrors.MissingRequiredArgument);
  });

  it('can handle queries with variables', async () => {
    const shopify = shopifyApi(testConfig());

    const client = new shopify.clients.Graphql({session});
    const query = `query FirstTwo($first: Int) {
      products(first: $first) {
        edges {
          node {
            id
          }
        }
      }
    }`;

    const variables = {
      first: 2,
    };

    const expectedResponse = {
      data: {
        products: {
          edges: [{node: {id: 'foo'}}, {node: {id: 'bar'}}],
        },
      },
    };

    queueMockResponse(JSON.stringify(expectedResponse));

    await expect(client.query(query, {variables})).resolves.toEqual(
      buildExpectedResponse(expectedResponse),
    );

    expect({
      method: 'POST',
      domain,
      path: `/admin/api/${shopify.config.apiVersion}/graphql.json`,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      data: {query, variables},
    }).toMatchMadeHttpRequest();
  });

  it('throws error when response contains an errors field', async () => {
    const shopify = shopifyApi(testConfig());

    const client = new shopify.clients.Graphql({session});
    const query = `query getProducts {
      products {
        edges {
          node {
            id
          }
        }
      }
    }`;

    const expectedHeaders = {
      'Content-Type': DataType.JSON.toString(),
      'X-Shopify-Access-Token': 'any_access_token',
    };

    const errorResponse = {
      data: null,
      errors: [
        {
          message: 'you must provide one of first or last',
          locations: [
            {
              line: 2,
              column: 3,
            },
          ],
          path: ['products'],
        },
      ],
      extensions: {
        cost: {
          requestedQueryCost: 2,
          actualQueryCost: 2,
          throttleStatus: {
            maximumAvailable: 1000,
            currentlyAvailable: 998,
            restoreRate: 50,
          },
        },
      },
      headers: expectedHeaders,
    };

    queueMockResponse(JSON.stringify(errorResponse));

    await expect(() => client.query(query)).rejects.toThrow(
      new ShopifyErrors.GraphqlQueryError({
        // Expect to throw the original error message
        message: 'you must provide one of first or last',
        response: errorResponse,
        headers: expectedHeaders,
      }),
    );

    expect({
      method: 'POST',
      domain,
      path: `/admin/api/${shopify.config.apiVersion}/graphql.json`,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      data: {query},
    }).toMatchMadeHttpRequest();
  });

  it('allows overriding the API version', async () => {
    const shopify = shopifyApi(testConfig());

    expect(shopify.config.apiVersion).not.toBe('2020-01');
    const client = new shopify.clients.Graphql({
      session,
      apiVersion: '2020-01' as any as ApiVersion,
    });

    queueMockResponse(JSON.stringify(successResponse));

    const response = await client.query(QUERY);

    expect(response).toEqual(buildExpectedResponse(successResponse));
    expect({
      method: 'POST',
      domain,
      path: `/admin/api/2020-01/graphql.json`,
      data: {query: QUERY},
    }).toMatchMadeHttpRequest();

    expect(shopify.config.logger.log).toHaveBeenCalledWith(
      LogSeverity.Debug,
      expect.stringContaining(
        `Admin client overriding default API version ${LATEST_API_VERSION} with 2020-01`,
      ),
    );
  });
});

function buildExpectedResponse(obj: any) {
  const expectedResponse = {
    body: obj,
    headers: expect.objectContaining({}),
  };
  return expect.objectContaining(expectedResponse);
}
