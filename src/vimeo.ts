import { ChannelItem, DirectoryItem, DirectoryFeatures, DirectoryRequest } from '@watchedcom/sdk';
import fetch from 'node-fetch';
import { parse as parseUrl, format as formatUrl } from 'url';
import { orderBy } from 'lodash';
//import _locales from './locales';

// const locales = _locales.map(item => ({ key: item.code, value: item.name }));

const apiUrl = 'https://api.vimeo.com';

const logger = (...args) => {
  if (process.env.DEBUG) {
    console.log(`API `, ...args);
  }
};

const websiteFilters: DirectoryFeatures['filter'] = [
  /*
  {
    name: 'Language',
    id: 'broadcaster_language',
    values: locales,
  },
  */
  /*
  {
    name: 'Audience',
    id: 'audience',
    values: [
      { value: 'All', key: '' },
      ...['family', 'teen', '18+'].map(_ => ({
        value: capitalize(_),
        key: _,
      })),
    ],
  },
  */
];

class VimeoApi {
  async getChannels(input: DirectoryRequest) {
    const limit = 25;
    const filter = input.filter || {};
    const page: number = input.cursor === null ? 0 : <number>input.cursor || 0;
    if (filter.category) {
      return await this.get(`categories/${filter.category}/channels`, {
        per_page: limit,
        page: page > 0 ? page : 1,
      }).then(({ total, data }) => {
        const items = Array.from(data || []).map<ChannelItem>((channel: any) =>
          this.convertChannel(channel)
        );
        const nextCursor = total > limit * page ? page + 1 : null;
        console.log('nextCursor', nextCursor);
        return {
          nextCursor,
          items,
          features: {
            filter: websiteFilters,
          },
        };
      });
    }
    return await this.get(`channels`, {
      ...filter,
      per_page: limit,
      page: page > 0 ? page : 1,
    }).then(({ total, data }) => {
      const items = Array.from(data || []).map<ChannelItem>((channel: any) =>
        this.convertChannel(channel)
      );
      const nextCursor = total > limit * page ? page + 1 : null;
      console.log('nextCursor', nextCursor);
      return {
        nextCursor,
        items,
        features: {
          filter: websiteFilters,
        },
      };
    });
  }

  async searchChannels(input: DirectoryRequest) {
    const limit = 25;
    const page: number = input.cursor === null ? 0 : <number>input.cursor || 0;
    return await this.get('channels', {
      query: input.search,
      per_page: limit,
      page: page > 0 ? page : 1,
    }).then(({ total, data }) => {
      const items = Array.from(data || []).map<ChannelItem>((channel: any) =>
        this.convertChannel(channel)
      );
      const nextCursor = total > limit * page ? page + 1 : null;
      return {
        nextCursor,
        items,
        features: {
          filter: websiteFilters,
        },
      };
    });
  }

  async getCategories(input: DirectoryRequest) {
    const limit = 100;
    const page = (input.cursor === null ? 0 : <number>input.cursor || 0) + 1;
    return await this.get('categories', {
      per_page: limit,
      page,
    }).then(({ data }) => {
      const items = Array.from(data || []).map<DirectoryItem>((cat: any) =>
        this.convertCategory(cat)
      );
      const nextCursor = null;
      return {
        nextCursor,
        items,
      };
    });
  }

  async getChannel({ ids }): Promise<ChannelItem> {
    let channel: ChannelItem;
    const data = await this.get(`channels/${ids.id}`);
    let videos = await this.get(`channels/${ids.id}/videos`, {
      direction: 'desc',
      page: 1,
      per_page: 1,
      sort: 'added',
    });
    let video = videos.data && videos.data[0];
    if (video) {
      let videoId = String(video.uri).replace('/videos/', '');
      const result = await this.get(`https://player.vimeo.com/video/${videoId}/config`);
      let { request: { files: { progressive = [] } = {} } = {} } = result;
      progressive = orderBy(progressive, ['width'], ['desc']);
      const v = progressive[0];
      if (v) {
        data.videoUrl = v.url;
      }
    }
    channel = this.convertChannel(data);
    return channel;
  }

  convertCategory(data: any): DirectoryItem {
    const id = data.uri.replace('/categories/', '');
    const picture = data.pictures.sizes.find(it => it.width === 640);
    const category: DirectoryItem = {
      type: 'directory',
      name: data.name,
      images: { poster: (picture && picture.link) || undefined },
      id: id,
      args: { filter: { category: id } },
    };
    return category;
  }

  convertChannel(data: any): ChannelItem {
    const id = data.uri.replace('/channels/', '');
    const picture = data.pictures.sizes.find(it => it.width === 640);
    const channel: ChannelItem = {
      id,
      type: 'channel',
      ids: { id },
      name: data.name,
      description: data.description,
      releaseDate: data.created_time,
      images: {
        poster: (picture && picture.link) || undefined,
      },
      sources: [],
    };
    if (data.videoUrl) {
      channel.sources?.push({
        id,
        name: channel.name,
        type: 'url',
        url: data.videoUrl,
      });
    }
    if (data.externalUrl) {
      channel.sources?.push({
        id,
        name: channel.name,
        type: 'externalUrl',
        url: data.externalUrl,
      });
    }
    return channel;
  }

  async get(pathname = '', query = {}, options = {}) {
    return this.api({ pathname, query }, options);
  }

  async post(pathname, data = {}, query = {}, options = {}) {
    return this.api(
      { pathname, query },
      {
        ...options,
        method: 'post',
        body: data,
      }
    );
  }

  async put(pathname, data = {}, query = {}, options = {}) {
    return this.api(
      { pathname, query },
      {
        ...options,
        method: 'put',
        body: data,
      }
    );
  }

  async delete(pathname, query = {}, options = {}) {
    return this.api(
      { pathname, query },
      {
        ...options,
        method: 'delete',
      }
    );
  }

  async api(url, options: any = {}) {
    let { body, headers = {} } = options;
    const token = process.env.VIMEO_TOKEN;
    headers = {
      ...headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (body && typeof body === 'object') {
      if (headers['Content-Type'] === 'application/json') {
        body = this.handleBodyAsJson(body);
      } else if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        body = this.handleBodyAsFormUrlencoded(body);
      }
    }
    let opts = { ...options, body, headers };
    const apiUrl = this.apiUrl(url);
    logger('request', apiUrl, opts);
    const res = await fetch(apiUrl, opts);
    return this.handleResponse(res);
  }

  apiUrl(url: any = {}) {
    let { pathname, query = {}, ...other } = url;
    let parsedApiUrl = parseUrl(apiUrl);
    if (String(pathname).startsWith('http')) {
      parsedApiUrl = parseUrl(pathname);
      pathname = parsedApiUrl.pathname;
    }
    return formatUrl({
      ...parsedApiUrl,
      pathname,
      query,
      ...other,
    });
  }

  async handleResponse(res) {
    const contentType = res.headers.get('content-type') || 'text';
    if (contentType.includes('json')) {
      return this.handleResponseAsJson(res);
    }
    return this.handleResponseAsText(res);
  }

  handleBodyAsJson(data = {}) {
    return JSON.stringify(data);
  }

  handleBodyAsFormUrlencoded(body) {
    return Object.entries(body)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) =>
        Array.isArray(value) ? value.map(item => `${key}=${item}`).join('&') : `${key}=${value}`
      )
      .join('&');
  }

  async handleResponseAsJson(res) {
    if (res.status >= 400) {
      const error = await res.json();
      logger('error', error);
      throw error;
    }
    if (res.status === 204) {
      return null;
    }
    let data = await res.json();
    data = typeof data === 'string' ? JSON.parse(data) : data;
    //logger('response', res.url, res.status, res.headers.get('content-type'), data);
    return data;
  }

  async handleResponseAsText(res) {
    if (res.status >= 400) {
      const error = await res.text();
      logger('error', error);
      throw error;
    }
    if (res.status === 204) {
      return null;
    }
    const data = await res.text();
    //logger('response', res.url, res.status, res.headers.get('content-type'), data);
    return data;
  }
}

const client = new VimeoApi();

/*
async function boot() {
  await client.getChannel({ ids: { id: 41203135 } });
}
boot();
*/

export default client;

/*
import VimeoClient from 'twitch';

const clientId = process.env.TWITCH_CLIENT_ID as string;
const clientSecret = process.env.TWITCH_SECRET_KEY as string;
const twitchClient = VimeoClient.withClientCredentials(clientId, clientSecret);

export default twitchClient;
*/
