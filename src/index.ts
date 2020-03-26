import { createWorkerAddon } from '@watchedcom/sdk';
import vimeo from './vimeo';

export const vimeoAddon = createWorkerAddon({
  id: 'vimeo',
  name: 'Vimeo Games',
  version: '0.0.1',
  itemTypes: ['channel'],
  defaultDirectoryOptions: {
    imageShape: 'landscape',
    displayName: true,
  },
  defaultDirectoryFeatures: {
    search: { enabled: true },
  },
  dashboards: [
    {
      id: '',
      name: 'Vimeo Games',
    },
    {
      id: 'channels',
      name: 'Top Vimeo Channels',
    },
  ],
});

vimeoAddon.registerActionHandler('directory', async (input, ctx) => {
  if (input.id) {
    return await vimeo.getChannels(input);
  } else if (input.search) {
    return await vimeo.searchChannels(input);
  } else {
    return await vimeo.getCategories(input);
  }
});

vimeoAddon.registerActionHandler('item', async (input, ctx) => {
  return await vimeo.getChannel(input);
});

vimeoAddon.registerActionHandler('source', async (input, ctx) => {
  return [];
});
