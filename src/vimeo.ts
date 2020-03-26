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

const channelFilters: DirectoryFeatures['filter'] = [
  {
    name: 'Sort By',
    id: 'sort',
    values: [
      { key: 'alphabetical', value: 'alphabetical' },
      { key: 'date', value: 'date' },
      { key: 'followers', value: 'followers' },
      { key: 'videos', value: 'videos' },
    ],
  },
];

const videoFilters: DirectoryFeatures['filter'] = [
  {
    name: 'Sort By',
    id: 'sort',
    values: [
      { key: 'added', value: 'added' },
      { key: 'alphabetical', value: 'alphabetical' },
      { key: 'comments', value: 'comments' },
      { key: 'date', value: 'date' },
      { key: 'default', value: 'default' },
      { key: 'duration', value: 'duration' },
      { key: 'likes', value: 'likes' },
      { key: 'manual', value: 'manual' },
      { key: 'modified_time', value: 'modified_time' },
      { key: 'plays', value: 'plays' },
    ],
  },
];

class VimeoApi {
  async getChannels(input: DirectoryRequest) {
    const limit = 25;
    const filter = input.filter || {};
    const page: number = input.cursor === null ? 0 : <number>input.cursor || 0;
    return await this.get(`channels`, {
      ...filter,
      per_page: limit,
      page: page > 0 ? page : 1,
    }).then(({ total, data }) => {
      const items = Array.from(data || []).map<DirectoryItem>((channel: any) =>
        this.convertChannel(channel)
      );
      const nextCursor = total > limit * page ? page + 1 : null;
      return {
        nextCursor,
        items,
        features: {
          filter: channelFilters,
        },
      };
    });
  }

  async getChannelsByCategory(input: DirectoryRequest) {
    const limit = 25;
    const filter = input.filter || {};
    const page: number = input.cursor === null ? 0 : <number>input.cursor || 0;
    return await this.get(`categories/${filter.category}/channels`, {
      per_page: limit,
      page: page > 0 ? page : 1,
    }).then(({ total, data }) => {
      const items = Array.from(data || []).map<DirectoryItem>((channel: any) =>
        this.convertChannel(channel)
      );
      const nextCursor = total > limit * page ? page + 1 : null;
      return {
        nextCursor,
        items,
        features: {
          filter: channelFilters,
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
      const items = Array.from(data || []).map<DirectoryItem>((channel: any) =>
        this.convertChannel(channel)
      );
      const nextCursor = total > limit * page ? page + 1 : null;
      return {
        nextCursor,
        items,
        features: {
          filter: channelFilters,
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

  async getVideosByChannel(input: DirectoryRequest) {
    const limit = 25;
    const filter = input.filter || {};
    const page: number = input.cursor === null ? 0 : <number>input.cursor || 0;
    return await this.get(`channels/${filter.channel}/videos`, {
      sort: filter.sort || 'default',
      per_page: limit,
      page: page > 0 ? page : 1,
    }).then(({ total, data }) => {
      const items = Array.from(data || []).map<ChannelItem>((video: any) =>
        this.convertVideo(video)
      );
      const nextCursor = total > limit * page ? page + 1 : null;
      return {
        nextCursor,
        items,
        features: {
          filter: videoFilters,
        },
      };
    });
  }

  async getVideo({ ids }): Promise<ChannelItem> {
    let video: ChannelItem;
    let videoId = ids.id;
    const data = await this.get(`videos/${ids.id}`);
    if (data) {
      const result = await this.get(`https://player.vimeo.com/video/${ids.id}/config`);
      let { request: { files: { progressive = [] } = {} } = {} } = result;
      progressive = orderBy(progressive, ['width'], ['desc']);
      const v = progressive[0];
      if (v) {
        data.videoUrl = v.url;
      }
    }
    video = this.convertVideo(data);
    return video;
  }

  convertCategory(data: any): DirectoryItem {
    const id = data.uri.replace('/categories/', '');
    const picture = data.pictures.sizes.find(it => it.width === 640);
    const category: DirectoryItem = {
      id,
      type: 'directory',
      name: data.name,
      images: { poster: (picture && picture.link) || undefined },
      args: { filter: { category: id } },
    };
    return category;
  }

  convertChannel(data: any): DirectoryItem {
    const id = data.uri.replace('/channels/', '');
    const picture = data.pictures.sizes.find(it => it.width === 640);
    const channel: DirectoryItem = {
      id,
      type: 'directory',
      name: data.name,
      description: data.description,
      images: {
        poster: (picture && picture.link) || undefined,
      },
      args: { filter: { channel: id } },
    };
    return channel;
  }

  convertVideo(data: any): ChannelItem {
    const id = data.uri.replace('/videos/', '');
    const picture = data.pictures.sizes.find(it => it.width === 640);
    const video: ChannelItem = {
      id,
      type: 'channel',
      ids: { id },
      name: data.name,
      description: data.description,
      //releaseDate: data.created_time,
      images: {
        poster: (picture && picture.link) || undefined,
      },
      sources: [],
    };
    if (data.videoUrl) {
      video.sources?.push({
        id,
        name: video.name,
        type: 'url',
        url: data.videoUrl,
      });
    }
    return video;
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
