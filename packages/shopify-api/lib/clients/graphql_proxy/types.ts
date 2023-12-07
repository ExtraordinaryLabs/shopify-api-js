import {Session} from '../../session/session';
import type {RequestReturn} from '../types';

export interface GraphqlProxyParams {
  session: Session;
  rawBody: string | {[key: string]: any};
}

export type GraphqlProxy = (
  params: GraphqlProxyParams,
) => Promise<RequestReturn>;
