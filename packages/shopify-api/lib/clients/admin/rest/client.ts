import {
  AdminRestApiClient,
  createAdminRestApiClient,
} from '@shopify/admin-api-client';
import {Method} from '@shopify/network';

import {
  clientLoggerFactory,
  getUserAgent,
  throwFailedRequest,
} from '../../common';
import {abstractFetch} from '../../../../runtime';
import {ConfigInterface} from '../../../base-types';
import * as ShopifyErrors from '../../../error';
import {logger} from '../../../logger';
import {
  RestRequestReturn,
  PageInfo,
  RestClientParams,
  PageInfoParams,
} from '../types';
import type {
  RequestParams,
  GetRequestParams,
  PutRequestParams,
  PostRequestParams,
  DeleteRequestParams,
} from '../../types';

export interface RestClientClassParams {
  config: ConfigInterface;
}

export class RestClient {
  static LINK_HEADER_REGEXP = /<([^<]+)>; rel="([^"]+)"/;
  static DEFAULT_LIMIT = '50';

  public static config: ConfigInterface;

  readonly client: AdminRestApiClient;

  public constructor({session, apiVersion}: RestClientParams) {
    const config = this.restClass().config;

    if (!config.isCustomStoreApp && !session.accessToken) {
      throw new ShopifyErrors.MissingRequiredArgument(
        'Missing access token when creating REST client',
      );
    }

    if (apiVersion) {
      const message =
        apiVersion === config.apiVersion
          ? `REST client has a redundant API version override to the default ${apiVersion}`
          : `REST client overriding default API version ${config.apiVersion} with ${apiVersion}`;

      logger(config).debug(message);
    }

    const customStoreAppAccessToken =
      config.adminApiAccessToken ?? config.apiSecretKey;

    this.client = createAdminRestApiClient({
      scheme: config.hostScheme,
      storeDomain: session.shop,
      apiVersion: apiVersion ?? config.apiVersion,
      headers: {},
      accessToken: config.isCustomStoreApp
        ? customStoreAppAccessToken
        : session.accessToken!,
      customFetchApi: abstractFetch,
      logger: clientLoggerFactory(config),
      userAgentPrefix: getUserAgent(config),
    });
  }

  /**
   * Performs a GET request on the given path.
   */
  public async get<T = any>(params: GetRequestParams) {
    return this.request<T>({method: Method.Get, ...params});
  }

  /**
   * Performs a POST request on the given path.
   */
  public async post<T = any>(params: PostRequestParams) {
    return this.request<T>({method: Method.Post, ...params});
  }

  /**
   * Performs a PUT request on the given path.
   */
  public async put<T = any>(params: PutRequestParams) {
    return this.request<T>({method: Method.Put, ...params});
  }

  /**
   * Performs a DELETE request on the given path.
   */
  public async delete<T = any>(params: DeleteRequestParams) {
    return this.request<T>({method: Method.Delete, ...params});
  }

  private async request<T = any>(
    params: RequestParams,
  ): Promise<RestRequestReturn<T>> {
    const requestParams = {
      data: params.data ?? {},
      headers: params.extraHeaders,
      retries: params.tries ? params.tries - 1 : undefined,
      searchParams: new URLSearchParams(
        params.query ? JSON.parse(JSON.stringify(params.query)) : undefined,
      ),
    };

    let response: Response;
    switch (params.method) {
      case Method.Get:
        response = await this.client.get(params.path, requestParams);
        break;
      case Method.Put:
        response = await this.client.put(params.path, requestParams);
        break;
      case Method.Post:
        response = await this.client.post(params.path, requestParams);
        break;
      case Method.Delete:
        response = await this.client.delete(params.path, requestParams);
        break;
      default:
        throw new ShopifyErrors.InvalidRequestError(
          `Unsupported request method '${params.method}'`,
        );
    }

    const body = await response.text();
    const responseHeaders = Object.fromEntries(response.headers.entries());

    if (!response.ok) {
      throwFailedRequest(
        body,
        {
          statusCode: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        },
        false,
      );
    }

    const requestReturn: RestRequestReturn<T> = {
      body: JSON.parse(body),
      headers: responseHeaders,
    };

    const link = response.headers.get('Link');
    if (link !== undefined) {
      const pageInfo: PageInfo = {
        limit: params.query?.limit
          ? params.query?.limit.toString()
          : RestClient.DEFAULT_LIMIT,
      };

      if (link) {
        const links = link.split(', ');

        for (const link of links) {
          const parsedLink = link.match(RestClient.LINK_HEADER_REGEXP);
          if (!parsedLink) {
            continue;
          }

          const linkRel = parsedLink[2];
          const linkUrl = new URL(parsedLink[1]);
          const linkFields = linkUrl.searchParams.get('fields');
          const linkPageToken = linkUrl.searchParams.get('page_info');

          if (!pageInfo.fields && linkFields) {
            pageInfo.fields = linkFields.split(',');
          }

          if (linkPageToken) {
            switch (linkRel) {
              case 'previous':
                pageInfo.previousPageUrl = parsedLink[1];
                pageInfo.prevPage = this.buildRequestParams(parsedLink[1]);
                break;
              case 'next':
                pageInfo.nextPageUrl = parsedLink[1];
                pageInfo.nextPage = this.buildRequestParams(parsedLink[1]);
                break;
            }
          }
        }
      }

      requestReturn.pageInfo = pageInfo;
    }

    return requestReturn;
  }

  private restClass() {
    return this.constructor as typeof RestClient;
  }

  private buildRequestParams(newPageUrl: string): PageInfoParams {
    const pattern = `^/admin/api/[^/]+/(.*).json$`;

    const url = new URL(newPageUrl);
    const path = url.pathname.replace(new RegExp(pattern), '$1');
    return {
      path,
      query: Object.fromEntries(url.searchParams.entries()),
    };
  }
}

export function restClientClass(
  params: RestClientClassParams,
): typeof RestClient {
  const {config} = params;

  class NewRestClient extends RestClient {
    public static config = config;
    public static scheme = 'https';
  }

  Reflect.defineProperty(NewRestClient, 'name', {
    value: 'RestClient',
  });

  return NewRestClient as typeof RestClient;
}
