import {Session} from '../auth/session';
import {ApiVersion} from '../base-types';
import {Context} from '../context';
import {RestResourceRequestError, RestResourceError} from '../error';
import * as mockAdapter from '../adapters/mock-adapter';
import {setAbstractFetchFunc, Response} from '../adapters/abstract-http';

import FakeResource from './fake-resource';
import FakeResourceWithCustomPrefix from './fake-resource-with-custom-prefix';

setAbstractFetchFunc(mockAdapter.abstractFetch);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeWithinSecondsOf(compareDate: number, seconds: number): R;
      toMatchMadeHttpRequest(): R;
    }
  }
}

describe('Base REST resource', () => {
  const domain = 'test-shop.myshopify.io';
  const prefix = '/admin/api/unstable';
  const headers = {'X-Shopify-Access-Token': 'access-token'};
  const session = new Session('1234', domain, '1234', true);
  session.accessToken = 'access-token';

  beforeEach(() => {
    mockAdapter.reset();
  });

  it('finds resource by id', async () => {
    const body = {fake_resource: {id: 1, attribute: 'attribute'}};
    queueMockResponse(JSON.stringify(body));

    const got = await FakeResource.find({id: 1, session} as any);

    expect([got!.id, got!.attribute]).toEqual([1, 'attribute']);
    expect({
      method: 'GET',
      domain,
      path: `${prefix}/fake_resources/1.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('finds resource with param', async () => {
    const body = {fake_resource: {id: 1, attribute: 'attribute'}};
    queueMockResponse(JSON.stringify(body));

    const got = await FakeResource.find({
      id: 1,
      session,
      params: {param: 'value'},
    } as any);

    expect([got!.id, got!.attribute]).toEqual([1, 'attribute']);
    expect({
      method: 'GET',
      domain,
      path: `${prefix}/fake_resources/1.json?param=value`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('finds resource and children by id', async () => {
    const body = {
      fake_resource: {
        id: 1,
        attribute: 'attribute1',
        has_one_attribute: {id: 2, attribute: 'attribute2'},
        has_many_attribute: [{id: 3, attribute: 'attribute3'}],
      },
    };
    queueMockResponse(JSON.stringify(body));

    const got = await FakeResource.find({id: 1, session} as any);

    expect([got!.id, got!.attribute]).toEqual([1, 'attribute1']);

    expect(got!.has_one_attribute!.constructor).toEqual(FakeResource);
    expect([
      got!.has_one_attribute!.id,
      got!.has_one_attribute!.attribute,
    ]).toEqual([2, 'attribute2']);

    expect(got!.has_many_attribute![0].constructor).toEqual(FakeResource);
    expect([
      got!.has_many_attribute![0].id,
      got!.has_many_attribute![0].attribute,
    ]).toEqual([3, 'attribute3']);

    expect({
      method: 'GET',
      domain,
      path: `${prefix}/fake_resources/1.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('fails on finding nonexistent resource by id', async () => {
    const body = {errors: 'Not Found'};
    queueMockResponse(JSON.stringify(body), {
      statusCode: 404,
      statusText: 'Not Found',
    });

    await expect(
      FakeResource.find({id: 1, session} as any),
    ).rejects.toThrowError(RestResourceRequestError);

    expect({
      method: 'GET',
      domain,
      path: `${prefix}/fake_resources/1.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('finds all resources', async () => {
    const body = {
      fake_resources: [
        {id: 1, attribute: 'attribute1'},
        {id: 2, attribute: 'attribute2'},
      ],
    };
    queueMockResponse(JSON.stringify(body));

    const got = await FakeResource.all({session});

    expect([got![0].id, got![0].attribute]).toEqual([1, 'attribute1']);
    expect([got![1].id, got![1].attribute]).toEqual([2, 'attribute2']);
    expect({
      method: 'GET',
      domain,
      path: `${prefix}/fake_resources.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('saves', async () => {
    const expectedRequestBody = {fake_resource: {attribute: 'attribute'}};
    const responseBody = {fake_resource: {id: 1, attribute: 'attribute'}};
    queueMockResponse(JSON.stringify(responseBody));

    const resource = new FakeResource({session});
    resource.attribute = 'attribute';
    await resource.save();

    expect(resource.id).toBeUndefined();
    expect({
      method: 'POST',
      domain,
      path: `${prefix}/fake_resources.json`,
      headers,
      data: JSON.stringify(expectedRequestBody),
    }).toMatchMadeHttpRequest();
  });

  it('saves and updates', async () => {
    const expectedRequestBody = {fake_resource: {attribute: 'attribute'}};
    const responseBody = {fake_resource: {id: 1, attribute: 'attribute'}};
    queueMockResponse(JSON.stringify(responseBody));

    const resource = new FakeResource({session});
    resource.attribute = 'attribute';
    await resource.saveAndUpdate();

    expect(resource.id).toEqual(1);
    expect({
      method: 'POST',
      domain,
      path: `${prefix}/fake_resources.json`,
      headers,
      data: JSON.stringify(expectedRequestBody),
    }).toMatchMadeHttpRequest();
  });

  it('saves existing resource', async () => {
    const expectedRequestBody = {
      fake_resource: {id: 1, attribute: 'attribute'},
    };
    const responseBody = {fake_resource: {id: 1, attribute: 'attribute'}};
    queueMockResponse(JSON.stringify(responseBody));

    const resource = new FakeResource({session});
    resource.id = 1;
    resource.attribute = 'attribute';
    await resource.save();

    expect(resource.id).toEqual(1);
    expect({
      method: 'PUT',
      domain,
      path: `${prefix}/fake_resources/1.json`,
      headers,
      data: JSON.stringify(expectedRequestBody),
    }).toMatchMadeHttpRequest();
  });

  it('saves with children', async () => {
    const expectedRequestBody = {
      fake_resource: {
        id: 1,
        attribute: 'attribute',
        has_one_attribute: {attribute: 'attribute1'},
        has_many_attribute: [{attribute: 'attribute2'}],
      },
    };
    queueMockResponse(JSON.stringify({}));

    const child1 = new FakeResource({session});
    child1.attribute = 'attribute1';

    const child2 = new FakeResource({session});
    child2.attribute = 'attribute2';

    const resource = new FakeResource({session});
    resource.id = 1;
    resource.attribute = 'attribute';
    resource.has_one_attribute = child1;
    resource.has_many_attribute = [child2];

    await resource.save();

    expect({
      method: 'PUT',
      domain,
      path: `${prefix}/fake_resources/1.json`,
      headers,
      data: JSON.stringify(expectedRequestBody),
    }).toMatchMadeHttpRequest();
  });

  it('saves with unknown attribute', async () => {
    const expectedRequestBody = {fake_resource: {unknown: 'some-value'}};
    queueMockResponse(JSON.stringify({}));

    const resource = new FakeResource({session});
    resource.unknown = 'some-value';
    await resource.save();

    expect({
      method: 'POST',
      domain,
      path: `${prefix}/fake_resources.json`,
      headers,
      data: JSON.stringify(expectedRequestBody),
    }).toMatchMadeHttpRequest();
  });

  it('saves forced null attributes', async () => {
    const expectedRequestBody = {
      fake_resource: {id: 1, has_one_attribute: null},
    };
    queueMockResponse(JSON.stringify({}));

    const resource = new FakeResource({session});
    resource.id = 1;
    resource.has_one_attribute = null;
    await resource.save();

    expect({
      method: 'PUT',
      domain,
      path: `${prefix}/fake_resources/1.json`,
      headers,
      data: JSON.stringify(expectedRequestBody),
    }).toMatchMadeHttpRequest();
  });

  it('deletes existing resource', async () => {
    queueMockResponse(JSON.stringify({}));

    const resource = new FakeResource({session});
    resource.id = 1;

    await resource.delete();

    expect({
      method: 'DELETE',
      domain,
      path: `${prefix}/fake_resources/1.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('deletes with other resource', async () => {
    queueMockResponse(JSON.stringify({}));

    const resource = new FakeResource({session});
    resource.id = 1;
    resource.other_resource_id = 2;

    await resource.delete();

    expect({
      method: 'DELETE',
      domain,
      path: `${prefix}/other_resources/2/fake_resources/1.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('fails to delete nonexistent resource', async () => {
    const body = {errors: 'Not Found'};
    queueMockResponse(JSON.stringify(body), {
      statusCode: 404,
      statusText: 'Not Found',
    });

    const resource = new FakeResource({session});
    resource.id = 1;

    await expect(resource.delete()).rejects.toThrowError(
      RestResourceRequestError,
    );

    expect({
      method: 'DELETE',
      domain,
      path: `${prefix}/fake_resources/1.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('makes custom request', async () => {
    const body = {fake_resource: {id: 1, attribute: 'attribute'}};
    queueMockResponse(JSON.stringify(body));

    const got = await FakeResource.custom({
      session,
      id: 1,
      other_resource_id: 2,
    });

    expect(got).toEqual(body);
    expect({
      method: 'GET',
      domain,
      path: `${prefix}/other_resources/2/fake_resources/1/custom.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('paginates requests', async () => {
    const previousUrl = `https://${domain}/admin/api/unstable/fake_resources.json?page_info=previousToken`;
    const nextUrl = `https://${domain}/admin/api/unstable/fake_resources.json?page_info=nextToken`;

    const body = {fake_resources: []};
    queueMockResponses(
      [JSON.stringify(body), {headers: {link: `<${nextUrl}>; rel="next"`}}],
      [
        JSON.stringify(body),
        {headers: {link: `<${previousUrl}>; rel="previous"`}},
      ],
      [JSON.stringify(body), {}],
    );

    await FakeResource.all({session});
    expect(FakeResource.NEXT_PAGE_INFO).not.toBeUndefined();
    expect(FakeResource.PREV_PAGE_INFO).toBeUndefined();

    await FakeResource.all({
      session,
      params: FakeResource.NEXT_PAGE_INFO?.query,
    });
    expect(FakeResource.NEXT_PAGE_INFO).toBeUndefined();
    expect(FakeResource.PREV_PAGE_INFO).not.toBeUndefined();

    await FakeResource.all({
      session,
      params: FakeResource.PREV_PAGE_INFO?.query,
    });
    expect(FakeResource.NEXT_PAGE_INFO).toBeUndefined();
    expect(FakeResource.PREV_PAGE_INFO).toBeUndefined();

    expect({
      method: 'GET',
      domain,
      path: `${prefix}/fake_resources.json`,
      headers,
    }).toMatchMadeHttpRequest();
    expect({
      method: 'GET',
      domain,
      path: `${prefix}/fake_resources.json?page_info=nextToken`,
      headers,
    }).toMatchMadeHttpRequest();
    expect({
      method: 'GET',
      domain,
      path: `${prefix}/fake_resources.json?page_info=previousToken`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('allows custom prefixes', async () => {
    const body = {
      fake_resource_with_custom_prefix: {id: 1, attribute: 'attribute'},
    };
    queueMockResponse(JSON.stringify(body));

    const got = await FakeResourceWithCustomPrefix.find({id: 1, session});

    expect([got!.id, got!.attribute]).toEqual([1, 'attribute']);
    expect({
      method: 'GET',
      domain,
      path: `/admin/custom_prefix/fake_resource_with_custom_prefix/1.json`,
      headers,
    }).toMatchMadeHttpRequest();
  });

  it('throws an error if the API versions mismatch', async () => {
    Context.API_VERSION = ApiVersion.January22;

    await expect(FakeResource.all({session})).rejects.toThrowError(
      new RestResourceError(
        `Current Context.API_VERSION '${ApiVersion.January22}' does not match resource version ${ApiVersion.Unstable}`,
      ),
    );
  });
});

function queueMockResponse(body: string, partial: Partial<Response> = {}) {
  mockAdapter.queueResponse({
    statusCode: 200,
    statusText: 'OK',
    headers: {},
    ...partial,
    body,
  });
}

function queueMockResponses(
  ...responses: Parameters<typeof queueMockResponse>[]
) {
  for (const [body, response] of responses) {
    queueMockResponse(body, response);
  }
}
