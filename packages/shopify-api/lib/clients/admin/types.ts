import {ApiVersion} from '../../types';
import {Session} from '../../session/session';
import {Headers} from '../../../runtime';

export type QueryParams =
  | string
  | number
  | string[]
  | number[]
  | {[key: string]: QueryParams};

export interface PageInfoParams {
  path: string;
  query: {[key: string]: QueryParams};
}

export interface PageInfo {
  limit: string;
  fields?: string[];
  previousPageUrl?: string;
  nextPageUrl?: string;
  prevPage?: PageInfoParams;
  nextPage?: PageInfoParams;
}

export interface RestRequestReturn<T = any> {
  body: T;
  headers: Headers;
  pageInfo?: PageInfo;
}

export interface RestClientParams {
  session: Session;
  apiVersion?: ApiVersion;
}
