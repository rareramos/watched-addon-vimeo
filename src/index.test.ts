import { testAddon } from '@watchedcom/test';
import { twitchAddon } from './index';

// Depending on your addon, change the test timeout
jest.setTimeout(30000);

test(`Test addon "${twitchAddon.getId()}"`, done => {
  testAddon(twitchAddon)
    .then(done)
    .catch(done);
});
