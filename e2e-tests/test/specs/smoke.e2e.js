import assert from 'node:assert/strict';

describe('Synnia Tauri smoke test', () => {
  it('launches and shows the app shell', async () => {
    const title = await browser.getTitle();
    assert.equal(title, 'Synnia');

    const hasRoot = await browser.execute(() => Boolean(document.getElementById('root')));
    assert.equal(hasRoot, true);
  });
});
