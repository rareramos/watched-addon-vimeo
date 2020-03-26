import { testAddon } from '@watchedcom/test';
import { vimeoAddon } from './index';

// Depending on your addon, change the test timeout
jest.setTimeout(30000);

test(`Test addon "${vimeoAddon.getId()}"`, done => {
  testAddon(vimeoAddon)
    .then(done)
    .catch(done);
});
